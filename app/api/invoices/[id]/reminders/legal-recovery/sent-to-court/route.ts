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
    legalRecoveryRegisteredMailNumber?: string | null;
    legalRecoveryRegisteredMailDate?: Date | null;
  } | null;
} | null;

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      registeredMailNumber?: unknown;
      registeredMailDate?: unknown;
    };

    const rawNumber = typeof body.registeredMailNumber === 'string' ? body.registeredMailNumber.trim() : '';
    const rawDate = typeof body.registeredMailDate === 'string' ? body.registeredMailDate.trim() : '';

    if (!rawNumber) {
      return NextResponse.json(
        { success: false, message: 'Registered mail number is required.' },
        { status: 400 }
      );
    }
    if (rawNumber.length > 64) {
      return NextResponse.json(
        { success: false, message: 'Registered mail number is too long.' },
        { status: 400 }
      );
    }
    if (!rawDate) {
      return NextResponse.json(
        { success: false, message: 'Registered mail date is required.' },
        { status: 400 }
      );
    }

    const parsedDate = new Date(rawDate);
    if (!Number.isFinite(parsedDate.getTime())) {
      return NextResponse.json(
        { success: false, message: 'Invalid registered mail date.' },
        { status: 400 }
      );
    }
    const now = new Date();
    if (parsedDate.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { success: false, message: 'Registered mail date cannot be in the future.' },
        { status: 400 }
      );
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
          registeredMailNumber: invoice.reminderState.legalRecoveryRegisteredMailNumber ?? null,
          registeredMailDate: invoice.reminderState.legalRecoveryRegisteredMailDate ?? null,
          firstTime: false,
        },
      });
    }

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
          'reminderState.legalRecoveryRegisteredMailNumber': rawNumber,
          'reminderState.legalRecoveryRegisteredMailDate': parsedDate,
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
          registeredMailNumber: rawNumber,
          registeredMailDate: parsedDate,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        sentToCourtAt,
        registeredMailNumber: rawNumber,
        registeredMailDate: parsedDate,
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