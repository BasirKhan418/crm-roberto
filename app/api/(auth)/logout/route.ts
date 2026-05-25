import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { createConnectionLog } from '@/db/repository/connection-log';
import { getClientIp } from '@/utils/api/request';
import getMe from '@/utils/middlewares/useMe';

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(true);
    const cookieStore = await cookies();
    cookieStore.delete('token');

    if (me.success && me.user) {
      void createConnectionLog({
        userId: me.user.id,
        companyId: me.user.companyId || null,
        role: me.user.role || null,
        eventType: 'logout',
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('user-agent'),
      });
    }

    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Logout failed: ${String(error)}` }, { status: 500 });
  }
}
