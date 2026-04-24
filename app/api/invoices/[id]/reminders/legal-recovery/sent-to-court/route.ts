import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import { createActivityLog } from '@/db/repository/activity';
import getMe from '@/utils/middlewares/useMe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type InvoiceDoc = {
  _id: mongoose.Types.ObjectId;
  invoiceNumber: string;
  reminderState?: {
    legalRecoveryInitiatedAt?: Date | null;
    legalRecoverySentToCourtAt?: Date | null;
  } | null;
} | null;

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
      .select('_id invoiceNumber reminderState')
      .lean<InvoiceDoc>();

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    if (!invoice.reminderState?.legalRecoveryInitiatedAt) {
      return NextResponse.json(
        {
          success: false,
          message: 'Generate a legal recovery document before marking it as sent to court.',
        },
        { status: 409 }
      );
    }

    if (invoice.reminderState?.legalRecoverySentToCourtAt) {
      return NextResponse.json({
        success: true,
        data: {
          sentToCourtAt: invoice.reminderState.legalRecoverySentToCourtAt,
          firstTime: false,
        },
      });
    }

    const now = new Date();
    const updateResult = await Invoice.updateOne(
      {
        _id: id,
        userId: me.user.id,
        $or: [
          { 'reminderState.legalRecoverySentToCourtAt': null },
          { 'reminderState.legalRecoverySentToCourtAt': { $exists: false } },
        ],
      },
      {
        $set: {
          'reminderState.legalRecoverySentToCourtAt': now,
        },
      }
    );

    const firstTime = (updateResult.modifiedCount ?? 0) > 0;
    const sentToCourtAt = firstTime
      ? now
      : (
          await Invoice.findOne({ _id: id, userId: me.user.id })
            .select('reminderState.legalRecoverySentToCourtAt')
            .lean<{ reminderState?: { legalRecoverySentToCourtAt?: Date | null } | null } | null>()
        )?.reminderState?.legalRecoverySentToCourtAt ?? now;

    if (firstTime) {
      await createActivityLog(me.user.id, {
        action: 'invoice_legal_recovery_sent_to_court',
        entityType: 'invoice',
        entityName: invoice.invoiceNumber,
        entityId: String(invoice._id),
        metadata: {
          generatedAt: invoice.reminderState?.legalRecoveryInitiatedAt ?? null,
          sentToCourtAt,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        sentToCourtAt,
        firstTime,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error updating legal recovery court status: ${String(error)}` },
      { status: 500 }
    );
  }
}