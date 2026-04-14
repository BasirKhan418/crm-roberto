import { NextResponse } from 'next/server';

import { getDashboardStats } from '@/db/repository/dashboard';
import getMe from '@/utils/middlewares/useMe';

export async function GET() {
  try {
    const me = await getMe(true);

    if (!me.success || !me.user) {
      return NextResponse.json({ message: me.message || 'Unauthorized', success: false }, { status: 401 });
    }

    const stats = await getDashboardStats(me.user.id);
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { message: `Error loading dashboard stats: ${String(error)}`, success: false },
      { status: 500 }
    );
  }
}
