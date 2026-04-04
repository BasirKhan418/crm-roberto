import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import User from '@/db/models/User';
import getMe from '@/utils/middlewares/useMe';

const PAGE_KEY_PATTERN = /^[a-z0-9/_-]{1,120}$/i;

function normalizePageKey(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim().toLowerCase();
  if (!trimmed || !PAGE_KEY_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export async function GET() {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    await ConnectDb();

    const user = await User.findById(me.user.id)
      .select('onboardingGuideSeenPages')
      .lean<{ onboardingGuideSeenPages?: string[] } | null>();

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        seenPages: Array.isArray(user.onboardingGuideSeenPages) ? user.onboardingGuideSeenPages : [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching onboarding guide state: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as { pageKey?: unknown };
    const pageKey = normalizePageKey(body.pageKey);

    if (!pageKey) {
      return NextResponse.json({ success: false, message: 'Invalid pageKey' }, { status: 400 });
    }

    await ConnectDb();

    await User.findByIdAndUpdate(me.user.id, {
      $addToSet: { onboardingGuideSeenPages: pageKey },
    });

    return NextResponse.json({ success: true, message: 'Onboarding guide progress saved' });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error saving onboarding guide state: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    await ConnectDb();

    await User.findByIdAndUpdate(me.user.id, {
      $set: { onboardingGuideSeenPages: [] },
    });

    return NextResponse.json({ success: true, message: 'Onboarding guide progress reset' });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error resetting onboarding guide state: ${String(error)}` },
      { status: 500 }
    );
  }
}
