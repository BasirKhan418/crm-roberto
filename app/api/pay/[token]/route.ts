import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import StripeConnect from '@/db/models/StripeConnect';
import { stripe } from '@/lib/stripe';
import { isTokenExpired } from '@/lib/tokens';

export const runtime = 'nodejs';

type CheckoutType = 'full' | 'partial' | 'deposit';

interface RouteParams {
  params: Promise<{ token: string }>;
}

interface TokenCheckoutBody {
  type?: CheckoutType;
  amount?: number;
  idempotencyKey?: string;
}

async function findInvoiceByPaymentToken(token: string) {
  return Invoice.findOne({ paymentToken: token })
    .select('_id userId invoiceNumber totalIncludingTax depositAmount status paymentTokenExpiry')
    .lean<{
      _id: mongoose.Types.ObjectId;
      userId: mongoose.Types.ObjectId;
      invoiceNumber: string;
      totalIncludingTax: number;
      depositAmount?: number;
      status?: string;
      paymentTokenExpiry?: Date | null;
    } | null>();
}

async function computePaidAndRemaining(invoiceId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId, totalIncludingTax: number) {
  const totals = await Payment.aggregate<{ _id: null; paidTotal: number }>([
    {
      $match: {
        userId,
        invoiceId,
        status: 'succeeded',
      },
    },
    { $group: { _id: null, paidTotal: { $sum: '$amount' } } },
  ]);

  const totalPaid = Math.max(0, Math.round(totals[0]?.paidTotal ?? 0));
  const totalAmount = Math.max(0, Math.round(totalIncludingTax));
  const remainingAmount = Math.max(0, totalAmount - totalPaid);

  return { totalPaid, totalAmount, remainingAmount };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  await ConnectDb();

  const { token } = await params;
  const invoice = await findInvoiceByPaymentToken(token);
  if (!invoice || isTokenExpired(invoice.paymentTokenExpiry ?? null)) {
    return NextResponse.json({ message: 'Invalid or expired payment link' }, { status: 404 });
  }

  const { totalPaid, totalAmount, remainingAmount } = await computePaidAndRemaining(
    invoice._id,
    invoice.userId,
    invoice.totalIncludingTax
  );

  return NextResponse.json({
    success: true,
    data: {
      invoiceId: String(invoice._id),
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      totalAmount,
      depositAmount: Math.max(0, Math.round(invoice.depositAmount ?? 0)),
      totalPaid,
      remainingAmount,
      canPay: remainingAmount > 0 && invoice.status !== 'paid',
    },
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ConnectDb();

    const { token } = await params;
    const invoice = await findInvoiceByPaymentToken(token);
    if (!invoice || isTokenExpired(invoice.paymentTokenExpiry ?? null)) {
      return NextResponse.json({ message: 'Invalid or expired payment link' }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as TokenCheckoutBody;
    const paymentType = body.type;
    const requestedAmount =
      typeof body.amount === 'number' && Number.isFinite(body.amount)
        ? Math.max(0, Math.round(body.amount))
        : null;
    const requestedIdempotencyKey =
      typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim().slice(0, 120)
        : null;

    if (paymentType !== 'full' && paymentType !== 'partial' && paymentType !== 'deposit') {
      return NextResponse.json({ message: 'Invalid payment type' }, { status: 400 });
    }

    const connect = await StripeConnect.findOne({ userId: invoice.userId })
      .select('stripeAccountId chargesEnabled')
      .lean<{ stripeAccountId?: string; chargesEnabled?: boolean } | null>();

    if (!connect?.chargesEnabled || !connect?.stripeAccountId) {
      return NextResponse.json({ message: 'Payments are not available for this invoice yet' }, { status: 422 });
    }

    const { totalPaid, remainingAmount } = await computePaidAndRemaining(invoice._id, invoice.userId, invoice.totalIncludingTax);

    if (remainingAmount <= 0 || invoice.status === 'paid') {
      return NextResponse.json({ message: 'Invoice is already fully paid' }, { status: 422 });
    }

    const configuredDeposit = Math.max(0, Math.round(invoice.depositAmount ?? 0));
    const defaultAmount =
      paymentType === 'deposit'
        ? Math.min(configuredDeposit, remainingAmount)
        : paymentType === 'full'
          ? remainingAmount
          : 0;

    if (paymentType === 'partial' && requestedAmount === null) {
      return NextResponse.json({ message: 'Partial payment amount is required' }, { status: 400 });
    }

    if (paymentType === 'full' && requestedAmount !== null && requestedAmount !== remainingAmount) {
      return NextResponse.json({ message: 'Full payment must match remaining balance' }, { status: 422 });
    }

    const amount = requestedAmount ?? defaultAmount;

    if (requestedAmount !== null && requestedAmount > remainingAmount) {
      return NextResponse.json({ message: 'Requested amount exceeds remaining balance' }, { status: 422 });
    }

    if (amount <= 0) {
      return NextResponse.json({ message: 'Invoice amount must be greater than zero' }, { status: 422 });
    }

    if (paymentType === 'partial' && amount >= remainingAmount) {
      return NextResponse.json({ message: 'Partial payment must be less than remaining balance' }, { status: 422 });
    }

    const isSettlingAll = amount >= remainingAmount;
    const isConfiguredDeposit = totalPaid === 0 && amount === Math.min(configuredDeposit, remainingAmount) && configuredDeposit > 0;
    const recordedPaymentType: 'deposit' | 'full' | 'remaining_balance' = isSettlingAll
      ? 'full'
      : isConfiguredDeposit
        ? 'deposit'
        : 'remaining_balance';

    const label =
      recordedPaymentType === 'deposit'
        ? `Deposit for invoice ${invoice.invoiceNumber}`
        : recordedPaymentType === 'full'
          ? `Invoice ${invoice.invoiceNumber}`
          : `Partial payment for invoice ${invoice.invoiceNumber}`;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'eur',
              unit_amount: amount,
              product_data: { name: label },
            },
            quantity: 1,
          },
        ],
        metadata: {
          invoiceId: String(invoice._id),
          paymentType: recordedPaymentType,
          paymentSource: 'invoice_token',
        },
        success_url: `${appUrl}/pay/${token}?status=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/pay/${token}?status=cancelled`,
        payment_intent_data: {
          application_fee_amount: 0,
          transfer_data: { destination: connect.stripeAccountId },
        },
      },
      {
        idempotencyKey:
          requestedIdempotencyKey ??
          `invoice:${String(invoice._id)}:token:${recordedPaymentType}:${amount}:${remainingAmount}`,
      }
    );

    return NextResponse.json({ checkoutUrl: checkoutSession.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    return NextResponse.json({ message }, { status: 500 });
  }
}
