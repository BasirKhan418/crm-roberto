import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import StripeConnect from '@/db/models/StripeConnect';
import { resolveLocaleFromValue } from '@/lib/i18n/locale';
import { getCheckoutLineItemLabel } from '@/lib/payments';
import { stripe } from '@/lib/stripe';
import { resolveCompanyOwnerUserId } from '@/db/repository/company-owner';
import { authorizeCompanyRoute } from '@/lib/company-route-access';

export const runtime = 'nodejs';

type CheckoutType = 'full' | 'deposit';

interface CheckoutBody {
  invoiceId?: string;
  type?: CheckoutType;
  amount?: number;
  idempotencyKey?: string;
  locale?: string;
}

export async function POST(req: NextRequest) {
  try {
    const access = await authorizeCompanyRoute({ moduleKey: 'invoices', action: 'manage' });
    if (!access.success) {
      return access.response;
    }
    const { user } = access;

    const body = (await req.json()) as CheckoutBody;
    const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId.trim() : '';
    const paymentType = body.type;
    const requestedAmount =
      typeof body.amount === 'number' && Number.isFinite(body.amount)
        ? Math.max(0, Math.round(body.amount))
        : null;
    const requestedIdempotencyKey =
      typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim().slice(0, 120)
        : null;
    const locale = resolveLocaleFromValue(body.locale, resolveLocaleFromValue(user.locale, 'fr'));

    if (!invoiceId || (paymentType !== 'full' && paymentType !== 'deposit')) {
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
    }

    await ConnectDb();

    const invoice = await Invoice.findOne({ _id: invoiceId, ...access.scope('userId') })
      .select('_id userId invoiceNumber totalIncludingTax depositAmount status')
      .lean<{
        _id: string;
        userId: string;
        invoiceNumber: string;
        totalIncludingTax: number;
        depositAmount?: number;
        status?: string;
      } | null>();

    if (!invoice) {
      return NextResponse.json({ message: 'Invoice not found' }, { status: 404 });
    }

    const connect = await StripeConnect.findOne({ userId: await resolveCompanyOwnerUserId({ userId: user.id, companyId: user.companyId }) })
      .select('stripeAccountId chargesEnabled')
      .lean<{ stripeAccountId?: string; chargesEnabled?: boolean } | null>();

    if (!connect?.chargesEnabled || !connect?.stripeAccountId) {
      return NextResponse.json({ message: 'Stripe not connected or not verified yet' }, { status: 422 });
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

    const paidTotal = Math.max(0, Math.round(totals[0]?.paidTotal ?? 0));
    const totalAmount = Math.max(0, Math.round(invoice.totalIncludingTax));
    const remainingAmount = Math.max(0, totalAmount - paidTotal);
    if (remainingAmount <= 0 || invoice.status === 'paid') {
      return NextResponse.json({ message: 'Invoice is already fully paid' }, { status: 422 });
    }

    const configuredDeposit = Math.max(0, Math.round(invoice.depositAmount ?? 0));
    const defaultAmount = paymentType === 'deposit' ? Math.min(configuredDeposit, remainingAmount) : remainingAmount;
    const amount = requestedAmount ?? defaultAmount;

    if (requestedAmount !== null && requestedAmount > remainingAmount) {
      return NextResponse.json({ message: 'Requested amount exceeds remaining balance' }, { status: 422 });
    }

    if (amount <= 0) {
      return NextResponse.json({ message: 'Invoice amount must be greater than zero' }, { status: 422 });
    }

    const isSettlingAll = amount >= remainingAmount;
    const isConfiguredDeposit = paidTotal === 0 && amount === Math.min(configuredDeposit, remainingAmount) && configuredDeposit > 0;
    const recordedPaymentType: 'deposit' | 'full' | 'remaining_balance' = isSettlingAll
      ? 'full'
      : isConfiguredDeposit
        ? 'deposit'
        : 'remaining_balance';

    const label = getCheckoutLineItemLabel(locale, recordedPaymentType, invoice.invoiceNumber);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    const checkoutSession = await stripe.checkout.sessions.create({
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
        paymentSource: 'owner_portal',
      },
      success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/invoices/${invoice._id}`,
      payment_intent_data: {
        application_fee_amount: 0,
        transfer_data: { destination: connect.stripeAccountId },
      },
    }, {
      idempotencyKey:
        requestedIdempotencyKey ??
        `invoice:${String(invoice._id)}:owner:${recordedPaymentType}:${amount}:${remainingAmount}`,
    });

    return NextResponse.json({ checkoutUrl: checkoutSession.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    return NextResponse.json({ message }, { status: 500 });
  }
}
