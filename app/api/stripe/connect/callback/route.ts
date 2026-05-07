import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import StripeConnect from '@/db/models/StripeConnect';
import { stripe } from '@/lib/stripe';
import getMe from '@/utils/middlewares/useMe';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    await ConnectDb();

    const connect = await StripeConnect.findOne({ userId: me.user.id });
    if (!connect) {
      return NextResponse.redirect(new URL('/settings/stripe?status=missing', request.url));
    }

    const account = await stripe.accounts.retrieve(connect.stripeAccountId);

    connect.chargesEnabled = account.charges_enabled;
    connect.payoutsEnabled = account.payouts_enabled;
    connect.onboardingComplete = account.charges_enabled && account.payouts_enabled;
    await connect.save();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    if (connect.onboardingComplete) {
      return NextResponse.redirect(new URL('/dashboard?stripe=complete', appUrl));
    }

    return NextResponse.redirect(new URL('/settings/stripe?status=pending', appUrl));
  } catch {
    return NextResponse.redirect(new URL('/settings/stripe?status=error', request.url));
  }
}
