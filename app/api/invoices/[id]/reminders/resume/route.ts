import dayjs from 'dayjs';
import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import ReminderSettings from '@/db/models/ReminderSettings';
import { createActivityLog } from '@/db/repository/activity';
import { normalizeOffsets } from '@/lib/reminders/core';
import getMe from '@/utils/middlewares/useMe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id })
      .select('_id invoiceNumber dueDate reminderState')
      .lean<{
        _id: mongoose.Types.ObjectId;
        invoiceNumber: string;
        dueDate?: Date | null;
        reminderState?: { level?: number | null } | null;
      } | null>();

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const settings = await ReminderSettings.findOne({ userId: me.user.id }).select('offsets').lean<{
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
      { _id: id, userId: me.user.id },
      {
        $set: {
          'reminderState.isPaused': false,
          'reminderState.nextScheduledAt': nextScheduledAt,
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    await createActivityLog(me.user.id, {
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
