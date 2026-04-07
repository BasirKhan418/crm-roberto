import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import { createActivityLog } from '@/db/repository/activity';
import { resolveStoredPaymentMethod } from '@/lib/payments';
import getMe from '@/utils/middlewares/useMe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
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

    const invoiceExists = await Invoice.exists({ _id: id, userId: me.user.id });
    if (!invoiceExists) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const payments = await Payment.find({
      invoiceId: id,
      userId: me.user.id,
      status: 'succeeded',
    })
      .sort({ paidAt: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: payments.map((payment) => ({
        ...payment,
        _id: String(payment._id),
        invoiceId: String(payment.invoiceId),
        userId: String(payment.userId),
      })),
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error loading payments: ${String(error)}` }, { status: 500 });
  }
}

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
      amount?: number;
      method?: string;
      customMethod?: string;
      paymentType?: 'full' | 'partial';
    };

    await ConnectDb();

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id }).select('_id invoiceNumber totalIncludingTax depositAmount status');
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ success: false, message: 'Invoice is already marked as paid' }, { status: 409 });
    }

    const amount = typeof body.amount === 'number' && Number.isFinite(body.amount)
      ? Math.max(0, Math.round(body.amount))
      : Math.max(0, Math.round(invoice.totalIncludingTax));

    const resolvedMethod = resolveStoredPaymentMethod(body.method, body.customMethod);
    if (!resolvedMethod.ok) {
      return NextResponse.json({ success: false, message: resolvedMethod.message }, { status: 400 });
    }

    const method = resolvedMethod.value;
    const userObjectId = new mongoose.Types.ObjectId(me.user.id);

    const existingTotals = await Payment.aggregate<{ _id: null; paidTotal: number }>([
      {
        $match: {
          userId: userObjectId,
          invoiceId: invoice._id,
          status: 'succeeded',
        },
      },
      { $group: { _id: null, paidTotal: { $sum: '$amount' } } },
    ]);
    const alreadyPaid = Math.max(0, Math.round(existingTotals[0]?.paidTotal ?? 0));
    const finalInvoiceTotal = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0));
    const configuredDeposit = Math.max(0, Math.round(invoice.depositAmount ?? 0));
    const remainingBeforePayment = Math.max(0, finalInvoiceTotal - alreadyPaid);
    const normalizedAmount = Math.min(amount, remainingBeforePayment || amount);
    const isSettlingAll = normalizedAmount >= remainingBeforePayment;
    const isExactConfiguredDeposit =
      alreadyPaid === 0 &&
      configuredDeposit > 0 &&
      normalizedAmount === Math.min(configuredDeposit, remainingBeforePayment);
    const recordedPaymentType: 'deposit' | 'full' | 'remaining_balance' = isSettlingAll
      ? 'full'
      : isExactConfiguredDeposit
        ? 'deposit'
        : 'remaining_balance';

    const payment = await Payment.create({
      userId: me.user.id,
      invoiceId: invoice._id,
      stripePaymentId: `manual_${invoice._id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      amount: normalizedAmount,
      currency: 'eur',
      type: recordedPaymentType,
      status: 'succeeded',
      method,
      paidAt: new Date(),
    });

    const totals = await Payment.aggregate<{ _id: null; paidTotal: number }>([
      {
        $match: {
          userId: userObjectId,
          invoiceId: invoice._id,
          status: 'succeeded',
        },
      },
      { $group: { _id: null, paidTotal: { $sum: '$amount' } } },
    ]);
    const totalPaid = Math.max(0, Math.round(totals[0]?.paidTotal ?? 0));

    if (totalPaid >= finalInvoiceTotal) {
      invoice.status = 'paid';
    } else if (totalPaid > 0) {
      invoice.status = 'partial_paid';
    } else {
      invoice.status = 'unpaid';
    }

    await invoice.save();

    await createActivityLog(me.user.id, {
      action: 'invoice_payment_received',
      entityType: 'invoice',
      entityName: invoice.invoiceNumber,
      entityId: String(invoice._id),
      metadata: {
        source: 'manual',
        amount: payment.amount,
        paymentType: payment.type,
        method: payment.method,
        invoiceStatus: invoice.status,
        totalPaid,
        invoiceTotal: finalInvoiceTotal,
        remainingAmount: Math.max(0, finalInvoiceTotal - totalPaid),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Payment added successfully',
      data: {
        payment: {
          ...payment.toObject(),
          _id: String(payment._id),
          invoiceId: String(payment.invoiceId),
          userId: String(payment.userId),
        },
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error creating payment: ${String(error)}` }, { status: 500 });
  }
}
