import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

import ConnectDb from '@/db/connectDb';
import ActivityLog from '@/db/models/Activity';
import Invoice from '@/db/models/Invoice';
import ReminderLog from '@/db/models/ReminderLog';
import getMe from '@/utils/middlewares/useMe';

type LevelBucket = {
  _id: number | null;
  count: number;
};

type SentLevelBucket = {
  _id: number | null;
  count: number;
};

// Keep legacy partial-payment statuses to avoid dropping historical invoices
// from dashboard collection counters.
const COLLECTION_STATUSES = ['unpaid', 'partial_paid', 'overdue', 'deposit_paid', 'initial_paid'] as unknown as string[];

export async function GET() {
  try {
    const me = await getMe(true);

    if (!me.success || !me.user) {
      return NextResponse.json({ message: me.message || 'Unauthorized', success: false }, { status: 401 });
    }

    await ConnectDb();

    const userObjectId = new mongoose.Types.ObjectId(me.user.id);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const inFourteenDays = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const [
      levelBuckets,
      paused,
      overdueCount,
      upcomingRecurrences,
      sentLast30Days,
      sentAllTime,
      sentLevelBuckets,
      sentLevel1FromActivity,
      sentLevel2FromActivity,
      sentLevel3FromActivity,
      sentLevel4FromActivity,
    ] = await Promise.all([
      Invoice.aggregate<LevelBucket>([
        {
          $match: {
            userId: userObjectId,
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
      } as mongoose.FilterQuery<unknown>),
      Invoice.countDocuments({
        userId: me.user.id,
        status: { $in: ['unpaid', 'partial_paid', 'deposit_paid', 'initial_paid'] },
        'reminderState.formalNoticeDeadline': { $lt: now },
      } as mongoose.FilterQuery<unknown>),
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
      ReminderLog.countDocuments({
        userId: me.user.id,
        status: 'sent',
        sentAt: { $gte: thirtyDaysAgo },
      }),
      ReminderLog.countDocuments({
        userId: me.user.id,
        status: 'sent',
      }),
      ReminderLog.aggregate<SentLevelBucket>([
        {
          $match: {
            userId: userObjectId,
            status: 'sent',
          },
        },
        {
          $group: {
            _id: '$level',
            count: { $sum: 1 },
          },
        },
      ]),
      ActivityLog.countDocuments({
        user: me.user.id,
        action: 'invoice_reminder_sent',
        'metadata.level': { $in: [1, '1'] },
      }),
      ActivityLog.countDocuments({
        user: me.user.id,
        action: 'invoice_reminder_sent',
        'metadata.level': { $in: [2, '2'] },
      }),
      ActivityLog.countDocuments({
        user: me.user.id,
        action: 'invoice_reminder_sent',
        'metadata.level': { $in: [3, '3'] },
      }),
      ActivityLog.countDocuments({
        user: me.user.id,
        action: 'invoice_formal_notice_sent',
      }),
    ]);

    const counts = {
      level0: 0,
      level1: 0,
      level2: 0,
      level3: 0,
      level4: 0,
    };

    const sentByLevel = {
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

    for (const bucket of sentLevelBuckets) {
      const level = Number(bucket._id ?? 0);
      if (level >= 1 && level <= 4) {
        sentByLevel[`level${level}` as keyof typeof sentByLevel] = bucket.count;
      }
    }

    // Fallback for legacy logs where ReminderLog entries exist with missing/invalid level values.
    // We keep the higher value to avoid undercounting while preventing obvious double counting.
    sentByLevel.level1 = Math.max(sentByLevel.level1, sentLevel1FromActivity);
    sentByLevel.level2 = Math.max(sentByLevel.level2, sentLevel2FromActivity);
    sentByLevel.level3 = Math.max(sentByLevel.level3, sentLevel3FromActivity);
    sentByLevel.level4 = Math.max(sentByLevel.level4, sentLevel4FromActivity);

    return NextResponse.json({
      success: true,
      data: {
        ...counts,
        paused: paused,
        overdueCount,
        sentLast30Days,
        sentAllTime,
        sentByLevel,
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
