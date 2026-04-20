import type Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import { createActivityLog } from '@/db/repository/activity';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';

const SUCCESSFUL_CHECKOUT_EVENTS = new Set<Stripe.Event.Type>([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
]);

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeMongo = error as { code?: number };
  return maybeMongo.code === 11000;
}

export async function POST(req: NextRequest) {
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeWebhookSecret) {
    return NextResponse.json({ error: 'Webhook secret is not configured' }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  await ConnectDb();

  if (SUCCESSFUL_CHECKOUT_EVENTS.has(event.type)) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ received: true });
    }

    const invoiceId = session.metadata?.invoiceId;
    const paymentType = session.metadata?.paymentType;

    if (!invoiceId) {
      return NextResponse.json({ received: true });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return NextResponse.json({ received: true });
    }

    const stripePaymentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    let paymentInserted = false;
    let paymentRecord: {
      amount: number;
      type: 'deposit' | 'full' | 'remaining_balance';
      method: string;
    } | null = null;

    if (stripePaymentId) {
      try {
        const created = await Payment.create({
          userId: invoice.userId,
          invoiceId: invoice._id,
          stripePaymentId,
          amount: session.amount_total ?? 0,
          currency: session.currency ?? 'eur',
          type:
            paymentType === 'deposit'
              ? 'deposit'
              : paymentType === 'remaining_balance'
                ? 'remaining_balance'
                : 'full',
          status: 'succeeded',
          method: session.payment_method_types?.[0] ?? 'card',
          source: 'stripe',
          paidAt: new Date(),
        });
        paymentInserted = true;
        paymentRecord = {
          amount: created.amount,
          type: created.type,
          method: created.method,
        };
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
      }
    }

    const totals = await Payment.aggregate<{ _id: null; paidTotal: number }>([
      {
        $match: {
          userId: invoice.userId,
          invoiceId: invoice._id,
          status: 'succeeded',
        },
      },
      { $group: { _id: null, paidTotal: { $sum: '$amount' } } },
    ]);

    const totalPaid = Math.max(0, Math.round(totals[0]?.paidTotal ?? 0));
    const invoiceTotal = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0));

    if (totalPaid >= invoiceTotal) {
      invoice.status = 'paid';
    } else if (totalPaid > 0) {
      invoice.status = 'partial_paid';
    } else {
      invoice.status = 'unpaid';
    }

    await invoice.save();

    if (paymentInserted && paymentRecord) {
      await createActivityLog(String(invoice.userId), {
        action: 'invoice_payment_received',
        entityType: 'invoice',
        entityName: invoice.invoiceNumber,
        entityId: String(invoice._id),
        metadata: {
          source: 'stripe',
          amount: paymentRecord.amount,
          paymentType: paymentRecord.type,
          method: paymentRecord.method,
          invoiceStatus: invoice.status,
          totalPaid,
          invoiceTotal,
          remainingAmount: Math.max(0, invoiceTotal - totalPaid),
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
