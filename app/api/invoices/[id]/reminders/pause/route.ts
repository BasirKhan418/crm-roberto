import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import { createActivityLog } from '@/db/repository/activity';
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

    const invoice = await Invoice.findOneAndUpdate(
      { _id: id, userId: me.user.id },
      {
        $set: {
          'reminderState.isPaused': true,
          'reminderState.nextScheduledAt': null,
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    await createActivityLog(me.user.id, {
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
