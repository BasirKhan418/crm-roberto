import { NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Quote from '@/db/models/Quote';
import getMe from '@/utils/middlewares/useMe';

/**
 * GET /api/quotes/action-counts
 *
 * Returns two actionable counts that drive sidebar badges and page banners:
 *  - pendingInvoice:          accepted quotes not yet converted to an invoice
 *  - unacknowledgedRejected:  rejected quotes the user hasn't reviewed yet
 *
 * These counts only decrease through specific actions, giving the user a clear
 * signal of what to do to dismiss each indicator.
 */
export async function GET() {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    await ConnectDb();

    const userId = me.user.id;

    const [pendingInvoice, unacknowledgedRejected] = await Promise.all([
      // Accepted quotes where the invoice hasn't been created yet
      Quote.countDocuments({
        user: userId,
        status: 'accepted',
        convertedToInvoice: { $ne: true },
      }),
      // Rejected (or refused) quotes the user has not acknowledged
      Quote.countDocuments({
        user: userId,
        status: { $in: ['rejected', 'refused'] },
        rejectionAcknowledgedAt: null,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { pendingInvoice, unacknowledgedRejected },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching action counts: ${String(error)}` },
      { status: 500 }
    );
  }
}
