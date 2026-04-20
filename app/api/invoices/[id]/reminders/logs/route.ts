import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import ReminderLog from '@/db/models/ReminderLog';
import getMe from '@/utils/middlewares/useMe';
import { logsQuerySchema } from '@/validators/reminder-actions.schema';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const parsed = logsQuerySchema.safeParse({
      page: request.nextUrl.searchParams.get('page') ?? 1,
      limit: request.nextUrl.searchParams.get('limit') ?? 20,
    });

    if (!parsed.success) {
      return NextResponse.json({ success: false, message: 'Invalid pagination query' }, { status: 400 });
    }

    await ConnectDb();

    const page = parsed.data.page;
    const limit = parsed.data.limit;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      ReminderLog.find({ userId: me.user.id, invoiceId: id }).sort({ sentAt: -1 }).skip(skip).limit(limit).lean(),
      ReminderLog.countDocuments({ userId: me.user.id, invoiceId: id }),
    ]);

    return NextResponse.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error loading reminder logs: ${String(error)}` }, { status: 500 });
  }
}
