import { NextResponse } from 'next/server';

import { getDashboardFollowUps } from '@/db/repository/dashboard';
import getMe from '@/utils/middlewares/useMe';

export async function GET() {
  try {
    const me = await getMe(true);

    if (!me.success || !me.user) {
      return NextResponse.json({ message: me.message || 'Unauthorized', success: false }, { status: 401 });
    }

    const followUps = await getDashboardFollowUps(me.user.id);
    return NextResponse.json(followUps);
  } catch (error) {
    return NextResponse.json(
      { message: `Error loading dashboard follow-ups: ${String(error)}`, success: false },
      { status: 500 }
    );
  }
}
