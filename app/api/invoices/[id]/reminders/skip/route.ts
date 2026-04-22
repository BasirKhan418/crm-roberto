import dayjs from 'dayjs';
import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import ReminderLog from '@/db/models/ReminderLog';
import ReminderSettings from '@/db/models/ReminderSettings';
import { createActivityLog } from '@/db/repository/activity';
import { normalizeOffsets } from '@/lib/reminders/core';
import getMe from '@/utils/middlewares/useMe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const DEFAULT_REMINDER_STATE = {
  level: 0,
  lastSentAt: null,
  nextScheduledAt: null,
  isPaused: false,
  lateFeeAmount: 0,
  formalNoticeSentAt: null,
  formalNoticeDeadline: null,
};

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    await ConnectDb();

    await Invoice.updateOne(
      {
        _id: id,
        userId: me.user.id,
        $or: [{ reminderState: null }, { reminderState: { $exists: false } }],
      },
      { $set: { reminderState: DEFAULT_REMINDER_STATE } }
    );

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id })
      .select('_id invoiceNumber dueDate clientSnapshot reminderState')
      .lean<{
        _id: mongoose.Types.ObjectId;
        invoiceNumber: string;
        dueDate?: Date | null;
        clientSnapshot?: { email?: string | null } | null;
        reminderState?: { level?: number | null; lateFeeAmount?: number | null } | null;
      } | null>();

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const currentLevel = Math.max(0, Math.min(4, Math.round(invoice.reminderState?.level ?? 0)));
    if (currentLevel >= 4) {
      return NextResponse.json({ success: false, message: 'No next reminder to skip' }, { status: 400 });
    }

    const skippedLevel = Math.min(4, currentLevel + 1);

    const settings = await ReminderSettings.findOne({ userId: me.user.id }).select('offsets').lean<{
      offsets?: { soft?: number; medium?: number; firm?: number; formalNotice?: number };
    } | null>();

    const offsets = normalizeOffsets(settings?.offsets);

    const nextLevelAfterSkip = Math.min(4, skippedLevel + 1);
    const nextOffset =
      nextLevelAfterSkip === 1
        ? offsets.soft
        : nextLevelAfterSkip === 2
          ? offsets.medium
          : nextLevelAfterSkip === 3
            ? offsets.firm
            : null;

    const nextScheduledAt = invoice.dueDate && nextOffset !== null ? dayjs(invoice.dueDate).add(nextOffset, 'day').toDate() : null;

    const now = new Date();

    const updated = await Invoice.findOneAndUpdate(
      { _id: id, userId: me.user.id },
      {
        $set: {
          'reminderState.level': skippedLevel,
          'reminderState.nextScheduledAt': nextScheduledAt,
          'reminderState.isPaused': false,
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const recipientEmail = invoice.clientSnapshot?.email?.trim() || '';

    const log = await ReminderLog.create({
      userId: me.user.id,
      invoiceId: invoice._id,
      level: skippedLevel,
      channel: 'email',
      status: 'skipped',
      skippedReason: 'Manually skipped from collection tab',
      subject: '',
      bodyPreview: '',
      recipientEmail,
      lateFeeAmount: Math.max(0, Math.round(invoice.reminderState?.lateFeeAmount ?? 0)),
      error: null,
      sentAt: now,
      pdfAttached: false,
    });

    await createActivityLog(me.user.id, {
      action: 'invoice_reminder_skipped',
      entityType: 'invoice',
      entityName: invoice.invoiceNumber,
      entityId: String(invoice._id),
      metadata: {
        skippedLevel,
        nextScheduledAt: nextScheduledAt?.toISOString() ?? null,
      },
    });

    return NextResponse.json({ success: true, data: updated, log });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error skipping reminder: ${String(error)}` }, { status: 500 });
  }
}
