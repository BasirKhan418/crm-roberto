import mongoose from 'mongoose';
import { NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Notification from '@/db/models/Notification';
import getMe from '@/utils/middlewares/useMe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(_request: Request, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Notification not found' }, { status: 404 });
    }

    await ConnectDb();

    const updated = await Notification.findOneAndUpdate(
      { _id: id, userId: me.user.id },
      { $set: { isRead: true } },
      { returnDocument: 'after' }
    ).lean();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error marking notification as read: ${String(error)}` },
      { status: 500 }
    );
  }
}
