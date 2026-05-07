import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import { createActivityLog } from '@/db/repository/activity';
import { isInvoiceDueOnOrBeforeToday } from '@/lib/invoices/overdue';
import { sendPaymentReceiptForSucceededPayment } from '@/lib/payments/sendPaymentReceiptForSucceededPayment';
import { resolveStoredPaymentMethod } from '@/lib/payments';
import getMe from '@/utils/middlewares/useMe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function parseAmountToCents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const cents = Math.round(value);
  if (cents <= 0) {
    return null;
  }

  return cents;
}

function parsePaidAtDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function isManualPayment(source: unknown, stripePaymentId: unknown): boolean {
  if (typeof source === 'string' && source.toLowerCase() === 'manual') {
    return true;
  }

  return typeof stripePaymentId === 'string' && stripePaymentId.startsWith('manual_');
}

function computeInvoiceStatus(invoiceTotal: number, totalPaid: number, dueDate?: Date | null): 'paid' | 'partial_paid' | 'unpaid' | 'overdue' {
  if (totalPaid >= invoiceTotal) {
    return 'paid';
  }

  if (isInvoiceDueOnOrBeforeToday(dueDate)) {
    return 'overdue';
  }

  if (totalPaid > 0) {
    return 'partial_paid';
  }

  return 'unpaid';
}

function serializePayment(payment: Record<string, unknown>) {
  return {
    ...payment,
    _id: String(payment._id),
    invoiceId: String(payment.invoiceId),
    userId: String(payment.userId),
    source: isManualPayment(payment.source, payment.stripePaymentId) ? 'manual' : 'stripe',
  };
}

async function recomputeInvoiceState(userId: string, invoice: {
  _id: mongoose.Types.ObjectId;
  totalIncludingTax?: number;
  dueDate?: Date | null;
  status: 'paid' | 'partial_paid' | 'unpaid' | 'overdue';
  paymentToken?: string | null;
  paymentTokenExpiry?: Date | null;
  save: () => Promise<unknown>;
}) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

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
  const invoiceTotal = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0));
  invoice.status = computeInvoiceStatus(invoiceTotal, totalPaid, invoice.dueDate ?? null);
  if (invoice.status === 'paid') {
    invoice.paymentToken = null;
    invoice.paymentTokenExpiry = null;
  }
  await invoice.save();

  return {
    totalPaid,
    invoiceTotal,
    remainingAmount: Math.max(0, invoiceTotal - totalPaid),
    invoiceStatus: invoice.status,
  };
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
      data: payments.map((payment) => serializePayment(payment as unknown as Record<string, unknown>)),
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

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id }).select('_id invoiceNumber totalIncludingTax depositAmount status paymentToken paymentTokenExpiry');
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
      source: 'manual',
      paidAt: new Date(),
    });

    const invoiceSnapshot = await recomputeInvoiceState(me.user.id, invoice);

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
        invoiceStatus: invoiceSnapshot.invoiceStatus,
        totalPaid: invoiceSnapshot.totalPaid,
        invoiceTotal: finalInvoiceTotal,
        remainingAmount: invoiceSnapshot.remainingAmount,
      },
    });

    let receiptEmailResult: { sent: boolean; reason?: string } = { sent: false };
    try {
      receiptEmailResult = await sendPaymentReceiptForSucceededPayment({ paymentId: String(payment._id) });
    } catch (receiptError) {
      console.error('Failed to send payment receipt:', receiptError);
    }

    return NextResponse.json({
      success: true,
      message: 'Payment added successfully',
      data: {
        payment: serializePayment(payment.toObject() as unknown as Record<string, unknown>),
        receiptEmailSent: receiptEmailResult.sent,
        receiptEmailStatus: receiptEmailResult.reason ?? (receiptEmailResult.sent ? 'sent' : 'error'),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error creating payment: ${String(error)}` }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
      paymentId?: string;
      amount?: number;
      method?: string;
      customMethod?: string;
      paidAt?: string;
    };

    if (!body.paymentId || !mongoose.Types.ObjectId.isValid(body.paymentId)) {
      return NextResponse.json({ success: false, message: 'Payment not found' }, { status: 404 });
    }

    const nextAmount = parseAmountToCents(body.amount);
    if (nextAmount === null) {
      return NextResponse.json({ success: false, message: 'Amount must be greater than zero' }, { status: 400 });
    }

    const nextPaidAt = parsePaidAtDate(body.paidAt);
    if (!nextPaidAt) {
      return NextResponse.json({ success: false, message: 'Payment date is invalid' }, { status: 400 });
    }

    const resolvedMethod = resolveStoredPaymentMethod(body.method, body.customMethod);
    if (!resolvedMethod.ok) {
      return NextResponse.json({ success: false, message: resolvedMethod.message }, { status: 400 });
    }

    await ConnectDb();

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id }).select('_id invoiceNumber totalIncludingTax dueDate status paymentToken paymentTokenExpiry');
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const payment = await Payment.findOne({
      _id: body.paymentId,
      invoiceId: invoice._id,
      userId: me.user.id,
      status: 'succeeded',
    });

    if (!payment) {
      return NextResponse.json({ success: false, message: 'Payment not found' }, { status: 404 });
    }

    if (!isManualPayment(payment.source, payment.stripePaymentId)) {
      return NextResponse.json({ success: false, message: 'Stripe payments cannot be edited manually' }, { status: 403 });
    }

    const previous = {
      amount: Math.max(0, Math.round(payment.amount ?? 0)),
      method: payment.method,
      paidAt: payment.paidAt,
    };

    payment.amount = nextAmount;
    payment.method = resolvedMethod.value;
    payment.paidAt = nextPaidAt;
    payment.source = 'manual';
    await payment.save();

    const invoiceSnapshot = await recomputeInvoiceState(me.user.id, invoice);

    await createActivityLog(me.user.id, {
      action: 'invoice_payment_updated',
      entityType: 'invoice',
      entityName: invoice.invoiceNumber,
      entityId: String(invoice._id),
      metadata: {
        source: 'manual',
        paymentId: String(payment._id),
        previousAmount: previous.amount,
        previousMethod: previous.method,
        previousPaidAt: previous.paidAt,
        amount: payment.amount,
        method: payment.method,
        paidAt: payment.paidAt,
        invoiceStatus: invoiceSnapshot.invoiceStatus,
        totalPaid: invoiceSnapshot.totalPaid,
        invoiceTotal: invoiceSnapshot.invoiceTotal,
        remainingAmount: invoiceSnapshot.remainingAmount,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Payment updated successfully',
      data: {
        payment: serializePayment(payment.toObject() as unknown as Record<string, unknown>),
        invoice: invoiceSnapshot,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error updating payment: ${String(error)}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as { paymentId?: string };
    if (!body.paymentId || !mongoose.Types.ObjectId.isValid(body.paymentId)) {
      return NextResponse.json({ success: false, message: 'Payment not found' }, { status: 404 });
    }

    await ConnectDb();

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id }).select('_id invoiceNumber totalIncludingTax dueDate status paymentToken paymentTokenExpiry');
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const payment = await Payment.findOne({
      _id: body.paymentId,
      invoiceId: invoice._id,
      userId: me.user.id,
      status: 'succeeded',
    });

    if (!payment) {
      return NextResponse.json({ success: false, message: 'Payment not found' }, { status: 404 });
    }

    if (!isManualPayment(payment.source, payment.stripePaymentId)) {
      return NextResponse.json({ success: false, message: 'Stripe payments cannot be deleted manually' }, { status: 403 });
    }

    const removedPayment = {
      paymentId: String(payment._id),
      amount: Math.max(0, Math.round(payment.amount ?? 0)),
      method: payment.method,
      paidAt: payment.paidAt,
      type: payment.type,
    };

    await payment.deleteOne();
    const invoiceSnapshot = await recomputeInvoiceState(me.user.id, invoice);

    await createActivityLog(me.user.id, {
      action: 'invoice_payment_deleted',
      entityType: 'invoice',
      entityName: invoice.invoiceNumber,
      entityId: String(invoice._id),
      metadata: {
        source: 'manual',
        ...removedPayment,
        invoiceStatus: invoiceSnapshot.invoiceStatus,
        totalPaid: invoiceSnapshot.totalPaid,
        invoiceTotal: invoiceSnapshot.invoiceTotal,
        remainingAmount: invoiceSnapshot.remainingAmount,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Payment deleted successfully',
      data: {
        invoice: invoiceSnapshot,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error deleting payment: ${String(error)}` }, { status: 500 });
  }
}
