import { NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import StripeConnect from '@/db/models/StripeConnect';
import { resolveCompanyOwnerUserId } from '@/db/repository/company-owner';
import { stripe } from '@/lib/stripe';
import getMe from '@/utils/middlewares/useMe';

export const runtime = 'nodejs';

async function getStatus() {
  const me = await getMe(true);
  if (!me.success || !me.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  await ConnectDb();

  const connect = await StripeConnect.findOne({ userId: await resolveCompanyOwnerUserId({ userId: me.user.id, companyId: me.user.companyId }) });
  if (!connect) {
    return NextResponse.json({ connected: false, chargesEnabled: false, payoutsEnabled: false, onboardingComplete: false });
  }

  const account = await stripe.accounts.retrieve(connect.stripeAccountId);
  const chargesEnabled = account.charges_enabled;
  const payoutsEnabled = account.payouts_enabled;
  const onboardingComplete = chargesEnabled && payoutsEnabled;

  connect.chargesEnabled = chargesEnabled;
  connect.payoutsEnabled = payoutsEnabled;
  connect.onboardingComplete = onboardingComplete;
  await connect.save();

  return NextResponse.json({
    connected: true,
    chargesEnabled,
    payoutsEnabled,
    onboardingComplete,
  });
}

export async function GET() {
  try {
    return await getStatus();
  } catch {
    return NextResponse.json({ connected: false, message: 'Failed to retrieve Stripe Connect status' }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
