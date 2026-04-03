import type Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';

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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
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

    if (stripePaymentId) {
      try {
        await Payment.create({
          userId: invoice.userId,
          invoiceId: invoice._id,
          stripePaymentId,
          amount: session.amount_total ?? 0,
          currency: session.currency ?? 'eur',
          type: paymentType === 'deposit' ? 'deposit' : 'full',
          status: 'succeeded',
          method: session.payment_method_types?.[0] ?? 'card',
          paidAt: new Date(),
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
      }
    }

    invoice.status = paymentType === 'deposit' ? 'deposit_paid' : 'paid';
    await invoice.save();
  }

  return NextResponse.json({ received: true });
}
