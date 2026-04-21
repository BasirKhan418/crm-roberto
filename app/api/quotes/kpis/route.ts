import mongoose from 'mongoose';
import { NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Quote from '@/db/models/Quote';
import getMe from '@/utils/middlewares/useMe';

export async function GET() {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    await ConnectDb();

    const userObjectId = new mongoose.Types.ObjectId(me.user.id);

    const [result] = await Quote.aggregate<{
      all: Array<{ count: number; totalTTC: number }>;
      accepted: Array<{ count: number; totalTTC: number }>;
      pending: Array<{ count: number; totalTTC: number }>;
      rejected: Array<{ count: number; totalTTC: number }>;
      totals: Array<{ totalHT: number; totalVat: number; totalTTC: number }>;
    }>([
      { $match: { user: userObjectId } },
      {
        $facet: {
          all: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalTTC: { $sum: { $ifNull: ['$totalIncludingTax', 0] } },
              },
            },
          ],
          accepted: [
            { $match: { status: 'accepted' } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalTTC: { $sum: { $ifNull: ['$totalIncludingTax', 0] } },
              },
            },
          ],
          pending: [
            { $match: { status: { $in: ['draft', 'sent'] } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalTTC: { $sum: { $ifNull: ['$totalIncludingTax', 0] } },
              },
            },
          ],
          rejected: [
            { $match: { status: { $in: ['rejected', 'refused'] } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalTTC: { $sum: { $ifNull: ['$totalIncludingTax', 0] } },
              },
            },
          ],
          totals: [
            {
              $group: {
                _id: null,
                totalHT: { $sum: { $ifNull: ['$totalExcludingTax', 0] } },
                totalVat: { $sum: { $ifNull: ['$totalVat', 0] } },
                totalTTC: { $sum: { $ifNull: ['$totalIncludingTax', 0] } },
              },
            },
          ],
        },
      },
    ]);

    const all = result?.all[0] ?? { count: 0, totalTTC: 0 };
    const accepted = result?.accepted[0] ?? { count: 0, totalTTC: 0 };
    const pending = result?.pending[0] ?? { count: 0, totalTTC: 0 };
    const rejected = result?.rejected[0] ?? { count: 0, totalTTC: 0 };
    const totals = result?.totals[0] ?? { totalHT: 0, totalVat: 0, totalTTC: 0 };

    return NextResponse.json({
      success: true,
      data: {
        all,
        accepted,
        pending,
        rejected,
        totals: {
          totalHT: totals.totalHT,
          totalVat: totals.totalVat,
          totalTTC: totals.totalTTC,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching quote KPIs: ${String(error)}` },
      { status: 500 },
    );
  }
}
