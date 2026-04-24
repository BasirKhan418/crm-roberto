import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import ReminderLog from '@/db/models/ReminderLog';
import { appendLegalRecoveryTrackingEntries, type ReminderLogEntry } from '@/lib/reminders/legal-recovery';
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

    const [invoice, rawLogs] = await Promise.all([
      Invoice.findOne({ _id: id, userId: me.user.id })
        .select('reminderState')
        .lean<{
          reminderState?: {
            legalRecoveryInitiatedAt?: Date | null;
            legalRecoverySentToCourtAt?: Date | null;
          } | null;
        } | null>(),
      ReminderLog.find({ userId: me.user.id, invoiceId: id }).sort({ sentAt: -1 }).lean<ReminderLogEntry[]>(),
    ]);

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const mergedItems = appendLegalRecoveryTrackingEntries(rawLogs, invoice.reminderState);
    const items = mergedItems.slice(skip, skip + limit);
    const total = mergedItems.length;

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
