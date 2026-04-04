import { NextResponse } from 'next/server';

import { markAllActivitiesAsRead } from '@/db/repository/activity';
import getMe from '@/utils/middlewares/useMe';

export async function PATCH() {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const modifiedCount = await markAllActivitiesAsRead(me.user.id);

    return NextResponse.json({
      success: true,
      message: 'Notifications marked as read',
      modifiedCount,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error marking notifications as read: ${String(error)}` }, { status: 500 });
  }
}
