import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';

import ConnectDb from '@/db/connectDb';
import StripeConnect from '@/db/models/StripeConnect';
import { stripe } from '@/lib/stripe';
import getMe from '@/utils/middlewares/useMe';

export const runtime = 'nodejs';

async function createConnectedAccountWithFallback() {
  try {
    return await stripe.accounts.create({ type: 'standard' } as Stripe.AccountCreateParams);
  } catch (error) {
    throw error;
  }
}

async function startConnectOnboarding(request: NextRequest) {
  const me = await getMe(true);
  if (!me.success || !me.user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  await ConnectDb();

  let connect = await StripeConnect.findOne({ userId: me.user.id });

  if (!connect) {
    const account = await createConnectedAccountWithFallback();
    connect = await StripeConnect.create({
      userId: me.user.id,
      stripeAccountId: account.id,
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const accountLink = await stripe.accountLinks.create({
    account: connect.stripeAccountId,
    refresh_url: `${appUrl}/settings/stripe?status=refresh`,
    return_url: `${appUrl}/api/stripe/connect/callback`,
    type: 'account_onboarding',
  });

  return NextResponse.redirect(accountLink.url);
}

export async function GET(request: NextRequest) {
  try {
    return await startConnectOnboarding(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start Stripe onboarding';
    console.error('[stripe/connect] ERROR COMPLETO:', error);
    console.error('[stripe/connect] MENSAGEM:', message);

    const isConnectNotEnabled = message.toLowerCase().includes('signed up for connect');
    const isIndiaLossLiabilityRestriction =
      message.toLowerCase().includes('platforms in in') && message.toLowerCase().includes('loss-liable');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    const encodedMsg = encodeURIComponent(message.slice(0, 200));

    if (isConnectNotEnabled) {
      return NextResponse.redirect(new URL(`/settings/stripe?status=connect_not_enabled&msg=${encodedMsg}`, appUrl));
    }

    if (isIndiaLossLiabilityRestriction) {
      return NextResponse.redirect(new URL('/settings/stripe?status=india_restricted', appUrl));
    }

    return NextResponse.redirect(new URL(`/settings/stripe?status=connect_error&msg=${encodedMsg}`, appUrl));
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

export async function DELETE() {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await ConnectDb();
    await StripeConnect.deleteOne({ userId: me.user.id });

    return NextResponse.json({ success: true, message: 'Stripe disconnected' });
  } catch {
    return NextResponse.json({ success: false, message: 'Failed to disconnect Stripe' }, { status: 500 });
  }
}
