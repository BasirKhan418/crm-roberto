import { NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Notification from '@/db/models/Notification';
import getMe from '@/utils/middlewares/useMe';

export async function POST() {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    await ConnectDb();

    const result = await Notification.updateMany(
      { userId: me.user.id, isRead: false },
      { $set: { isRead: true } }
    );

    return NextResponse.json({
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error marking all notifications as read: ${String(error)}` },
      { status: 500 }
    );
  }
}
