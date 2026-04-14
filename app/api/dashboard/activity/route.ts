import { NextResponse } from 'next/server';

import { getDashboardActivity } from '@/db/repository/dashboard';
import getMe from '@/utils/middlewares/useMe';

export async function GET() {
  try {
    const me = await getMe(true);

    if (!me.success || !me.user) {
      return NextResponse.json({ message: me.message || 'Unauthorized', success: false }, { status: 401 });
    }

    const activity = await getDashboardActivity(me.user.id);
    return NextResponse.json(activity);
  } catch (error) {
    return NextResponse.json(
      { message: `Error loading dashboard activity: ${String(error)}`, success: false },
      { status: 500 }
    );
  }
}
