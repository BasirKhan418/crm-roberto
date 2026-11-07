import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';

import ConnectDb from '@/db/connectDb';
import StripeConnect from '@/db/models/StripeConnect';
import { getCompanyOwnerAccess } from '@/lib/company-owner-access';
import { stripe } from '@/lib/stripe';
import getMe from '@/utils/middlewares/useMe';

export const runtime = 'nodejs';

async function createConnectedAccountWithFallback() {
  try {
    return await stripe.accounts.create({ type: 'express' });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const isIndiaLossLiabilityRestriction =
      message.includes('platforms in in') && message.includes('loss-liable');

    if (!isIndiaLossLiabilityRestriction) {
      throw error;
    }

    // India platforms can be restricted from loss-liable Connect setups.
    // Fallback to Standard connected accounts where Stripe handles liability.
    return stripe.accounts.create({ type: 'standard' } as Stripe.AccountCreateParams);
  }
}

async function startConnectOnboarding(request: NextRequest) {
  const me = await getMe(true);
  if (!me.success || !me.user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { ownerUserId, canManageCompany } = await getCompanyOwnerAccess(me.user);
  if (!canManageCompany) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    return NextResponse.redirect(new URL('/settings/stripe?status=forbidden', appUrl));
  }

  await ConnectDb();

  // One Stripe account per company, held against the company owner.
  let connect = await StripeConnect.findOne({ userId: ownerUserId });

  if (!connect) {
    const account = await createConnectedAccountWithFallback();
    connect = await StripeConnect.create({
      userId: ownerUserId,
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
    const isConnectNotEnabled = message.toLowerCase().includes('signed up for connect');
    const isIndiaLossLiabilityRestriction =
      message.toLowerCase().includes('platforms in in') && message.toLowerCase().includes('loss-liable');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    if (isConnectNotEnabled) {
      return NextResponse.redirect(new URL('/settings/stripe?status=connect_not_enabled', appUrl));
    }

    if (isIndiaLossLiabilityRestriction) {
      return NextResponse.redirect(new URL('/settings/stripe?status=india_restricted', appUrl));
    }

    return NextResponse.redirect(new URL('/settings/stripe?status=connect_error', appUrl));
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

    const { ownerUserId, canManageCompany } = await getCompanyOwnerAccess(me.user);
    if (!canManageCompany) {
      return NextResponse.json({ success: false, message: 'Only company administrators can change company settings' }, { status: 403 });
    }

    await ConnectDb();
    await StripeConnect.deleteOne({ userId: ownerUserId });

    return NextResponse.json({ success: true, message: 'Stripe disconnected' });
  } catch {
    return NextResponse.json({ success: false, message: 'Failed to disconnect Stripe' }, { status: 500 });
  }
}
