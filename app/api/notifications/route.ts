import { NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Notification from '@/db/models/Notification';
import getMe from '@/utils/middlewares/useMe';

export async function GET() {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    await ConnectDb();

    const [items, unreadCount] = await Promise.all([
      Notification.find({ userId: me.user.id })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Notification.countDocuments({ userId: me.user.id, isRead: false }),
    ]);

    return NextResponse.json({
      success: true,
      data: items,
      unreadCount,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching notifications: ${String(error)}` },
      { status: 500 }
    );
  }
}
