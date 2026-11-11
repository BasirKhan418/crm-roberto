import dayjs from 'dayjs';
import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import ReminderLog from '@/db/models/ReminderLog';
import ReminderSettings from '@/db/models/ReminderSettings';
import { createActivityLog } from '@/db/repository/activity';
import { normalizeOffsets } from '@/lib/reminders/core';
import { resolveCompanyOwnerUserId } from '@/db/repository/company-owner';
import { authorizeCompanyRoute } from '@/lib/company-route-access';

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
    const access = await authorizeCompanyRoute({ moduleKey: 'invoices', action: 'manage' });
    if (!access.success) {
      return access.response;
    }
    const { user } = access;
    const invoiceScope = access.scope('userId');

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    await ConnectDb();

    await Invoice.updateOne(
      {
        _id: id,
        ...invoiceScope,
        $or: [{ reminderState: null }, { reminderState: { $exists: false } }],
      },
      { $set: { reminderState: DEFAULT_REMINDER_STATE } }
    );

    const invoice = await Invoice.findOne({ _id: id, ...invoiceScope })
      .select('_id userId invoiceNumber dueDate clientSnapshot reminderState')
      .lean<{
        _id: mongoose.Types.ObjectId;
        userId: mongoose.Types.ObjectId;
        invoiceNumber: string;
        dueDate?: Date | null;
        clientSnapshot?: { email?: string | null } | null;
        reminderState?: { level?: number | null; lateFeeAmount?: number | null } | null;
      } | null>();

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const settings = await ReminderSettings.findOne({ userId: await resolveCompanyOwnerUserId({ userId: user.id, companyId: user.companyId }) }).select('offsets').lean<{
      offsets?: { soft?: number; medium?: number; firm?: number; formalNotice?: number };
    } | null>();

    const offsets = normalizeOffsets(settings?.offsets);
    const currentLevel = Math.max(0, Math.min(4, Math.round(invoice.reminderState?.level ?? 0)));

    const nextOffset =
      currentLevel <= 0
        ? offsets.soft
        : currentLevel === 1
          ? offsets.medium
          : currentLevel === 2
            ? offsets.firm
            : null;

    const nextScheduledAt = invoice.dueDate && nextOffset !== null ? dayjs(invoice.dueDate).add(nextOffset, 'day').toDate() : null;

    const updated = await Invoice.findOneAndUpdate(
      { _id: invoice._id, userId: invoice.userId },
      {
        $set: {
          'reminderState.isPaused': false,
          'reminderState.nextScheduledAt': nextScheduledAt,
        },
      },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const now = new Date();
    const resumeLevel = Math.max(1, currentLevel || 1) as 1 | 2 | 3 | 4;

    await ReminderLog.create({
      userId: invoice.userId,
      invoiceId: invoice._id,
      level: resumeLevel,
      channel: 'email',
      status: 'resumed',
      skippedReason: 'Resumed by user',
      subject: '',
      bodyPreview: '',
      recipientEmail: invoice.clientSnapshot?.email?.trim() || '',
      lateFeeAmount: Math.max(0, Math.round(Number(invoice.reminderState?.lateFeeAmount ?? 0))),
      error: null,
      sentAt: now,
      pdfAttached: false,
    });

    await createActivityLog(user.id, {
      action: 'invoice_reminder_resumed',
      entityType: 'invoice',
      entityName: invoice.invoiceNumber,
      entityId: String(invoice._id),
      metadata: {
        nextScheduledAt: nextScheduledAt ? nextScheduledAt.toISOString() : null,
        channel: 'email',
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error resuming reminders: ${String(error)}` }, { status: 500 });
  }
}
