import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import ReminderLog from '@/db/models/ReminderLog';
import { createActivityLog } from '@/db/repository/activity';
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

    const invoice = await Invoice.findOneAndUpdate(
      { _id: id, ...invoiceScope },
      {
        $set: {
          'reminderState.isPaused': true,
          'reminderState.nextScheduledAt': null,
        },
      },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const currentLevel = Math.max(
      1,
      Math.min(4, Math.round(Number(invoice.reminderState?.level ?? 0)) || 1)
    ) as 1 | 2 | 3 | 4;

    const now = new Date();

    await ReminderLog.create({
      userId: invoice.userId,
      invoiceId: invoice._id,
      level: currentLevel,
      channel: 'email',
      status: 'paused',
      skippedReason: 'Paused by user',
      subject: '',
      bodyPreview: '',
      recipientEmail: invoice.clientSnapshot?.email?.trim() || '',
      lateFeeAmount: Math.max(0, Math.round(Number(invoice.reminderState?.lateFeeAmount ?? 0))),
      error: null,
      sentAt: now,
      pdfAttached: false,
    });

    await createActivityLog(user.id, {
      action: 'invoice_reminder_paused',
      entityType: 'invoice',
      entityName: invoice.invoiceNumber,
      entityId: String(invoice._id),
      metadata: {
        channel: 'email',
      },
    });

    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error pausing reminders: ${String(error)}` }, { status: 500 });
  }
}
