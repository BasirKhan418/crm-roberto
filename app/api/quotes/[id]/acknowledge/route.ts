import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Quote from '@/db/models/Quote';
import getMe from '@/utils/middlewares/useMe';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/quotes/:id/acknowledge
 *
 * Marks a rejected quote as reviewed by the user, setting
 * rejectionAcknowledgedAt to the current timestamp. This causes the sidebar
 * badge and the page banner to stop counting this quote.
 *
 * The indicator disappears only through this explicit action so the user is
 * always in control of when they consider a rejection handled.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid quote ID' }, { status: 400 });
    }

    await ConnectDb();

    const updated = await Quote.findOneAndUpdate(
      {
        _id: id,
        user: me.user.id,
        status: { $in: ['rejected', 'refused'] },
        rejectionAcknowledgedAt: null, // Only acknowledge if not already done
      },
      { $set: { rejectionAcknowledgedAt: new Date() } },
      { returnDocument: 'after' }
    )
      .select('_id rejectionAcknowledgedAt')
      .lean();

    if (!updated) {
      // Either not found, wrong owner, wrong status, or already acknowledged — all safe to treat as success
      return NextResponse.json({ success: true, alreadyAcknowledged: true });
    }

    return NextResponse.json({ success: true, alreadyAcknowledged: false });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error acknowledging quote: ${String(error)}` },
      { status: 500 }
    );
  }
}
