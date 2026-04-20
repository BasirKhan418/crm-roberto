import { NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import getMe from '@/utils/middlewares/useMe';

type LevelBucket = {
  _id: number | null;
  count: number;
};

const COLLECTION_STATUSES = ['unpaid', 'partial_paid', 'overdue'] as const;

export async function GET() {
  try {
    const me = await getMe(true);

    if (!me.success || !me.user) {
      return NextResponse.json({ message: me.message || 'Unauthorized', success: false }, { status: 401 });
    }

    await ConnectDb();

    const now = new Date();
    const inFourteenDays = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const [levelBuckets, paused, overdueCount, upcomingRecurrences] = await Promise.all([
      Invoice.aggregate<LevelBucket>([
        {
          $match: {
            userId: me.user.id,
            status: { $in: COLLECTION_STATUSES },
          },
        },
        {
          $group: {
            _id: { $ifNull: ['$reminderState.level', 0] },
            count: { $sum: 1 },
          },
        },
      ]),
      Invoice.countDocuments({
        userId: me.user.id,
        status: { $in: COLLECTION_STATUSES },
        'reminderState.isPaused': true,
      }),
      Invoice.countDocuments({
        userId: me.user.id,
        status: { $in: ['unpaid', 'partial_paid'] },
        'reminderState.formalNoticeDeadline': { $lt: now },
      }),
      Invoice.find({
        userId: me.user.id,
        'recurrence.isActive': true,
        'recurrence.nextOccurrenceAt': {
          $gte: now,
          $lte: inFourteenDays,
        },
      })
        .sort({ 'recurrence.nextOccurrenceAt': 1 })
        .limit(5)
        .select('_id invoiceNumber clientSnapshot.fullName recurrence.nextOccurrenceAt')
        .lean<Array<{
          _id: string;
          invoiceNumber?: string;
          clientSnapshot?: { fullName?: string | null } | null;
          recurrence?: { nextOccurrenceAt?: Date | null } | null;
        }>>(),
    ]);

    const counts = {
      level0: 0,
      level1: 0,
      level2: 0,
      level3: 0,
      level4: 0,
    };

    for (const bucket of levelBuckets) {
      const level = Number(bucket._id ?? 0);
      if (level >= 0 && level <= 4) {
        counts[`level${level}` as keyof typeof counts] = bucket.count;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...counts,
        paused: paused,
        overdueCount,
        upcomingRecurrences: upcomingRecurrences.map((item) => ({
          id: String(item._id),
          invoiceNumber: item.invoiceNumber ?? '-',
          clientName: item.clientSnapshot?.fullName ?? '-',
          nextOccurrenceAt: item.recurrence?.nextOccurrenceAt ?? null,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: `Error loading dashboard collection data: ${String(error)}`, success: false },
      { status: 500 }
    );
  }
}
