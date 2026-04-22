import type Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import { finalizeStripeInvoiceCheckoutSession } from '@/lib/payments/finalizeStripeInvoiceCheckoutSession';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';

const SUCCESSFUL_CHECKOUT_EVENTS = new Set<Stripe.Event.Type>([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
]);

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
    await finalizeStripeInvoiceCheckoutSession(session, { sendReceipt: true });
  }

  return NextResponse.json({ received: true });
}
