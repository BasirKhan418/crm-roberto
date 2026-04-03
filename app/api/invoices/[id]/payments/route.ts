import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
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
    };

    await ConnectDb();

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id }).select('_id totalIncludingTax status');
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ success: false, message: 'Invoice is already marked as paid' }, { status: 409 });
    }

    const amount = typeof body.amount === 'number' && Number.isFinite(body.amount)
      ? Math.max(0, Math.round(body.amount))
      : Math.max(0, Math.round(invoice.totalIncludingTax));

    const method = typeof body.method === 'string' && body.method.trim() ? body.method.trim() : 'manual_offline';

    const payment = await Payment.create({
      userId: me.user.id,
      invoiceId: invoice._id,
      stripePaymentId: `manual_${invoice._id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      amount,
      currency: 'eur',
      type: 'full',
      status: 'succeeded',
      method,
      paidAt: new Date(),
    });

    invoice.status = 'paid';
    await invoice.save();

    return NextResponse.json({
      success: true,
      message: 'Invoice marked as paid',
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
