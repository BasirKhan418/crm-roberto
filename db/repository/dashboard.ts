import ConnectDb from '@/db/connectDb';
import ActivityLog from '@/db/models/Activity';
import Client from '@/db/models/Client';
import Note from '@/db/models/Note';
import Quote from '@/db/models/Quote';
import Supplier from '@/db/models/Supplier';
import mongoose from 'mongoose';

export interface DashboardStats {
  totalClients: number;
  totalSuppliers: number;
  notesThisWeek: number;
  quotesThisMonth: number;
  acceptedQuotesValue: number;
}

export interface DashboardActivityItem {
  _id: string;
  action: string;
  entityType: string;
  entityName: string;
  createdAt: Date;
}

export interface DashboardFollowUpItem {
  _id: string;
  title: string;
  followUpDate: Date;
  linkedType: 'client' | 'supplier' | string;
  linkedId: string | {
    _id?: string;
    fullName?: string;
  } | null;
}

interface LinkedEntityRecord {
  _id: string;
  fullName?: string;
}

async function hydrateFollowUps(userId: string, rows: DashboardFollowUpItem[]): Promise<DashboardFollowUpItem[]> {
  const clientIds = new Set<string>();
  const supplierIds = new Set<string>();

  for (const row of rows) {
    if (!row.linkedId) {
      continue;
    }

    const linkedId = String(row.linkedId);
    if (!linkedId) {
      continue;
    }

    if (row.linkedType === 'client') {
      clientIds.add(linkedId);
    } else if (row.linkedType === 'supplier') {
      supplierIds.add(linkedId);
    }
  }

  const [clients, suppliers] = await Promise.all([
    clientIds.size > 0
      ? Client.find({ user: userId, _id: { $in: Array.from(clientIds) } }).select('_id fullName').lean()
      : Promise.resolve([]),
    supplierIds.size > 0
      ? Supplier.find({ user: userId, _id: { $in: Array.from(supplierIds) } }).select('_id fullName').lean()
      : Promise.resolve([]),
  ]);

  const clientMap = new Map<string, LinkedEntityRecord>();
  const supplierMap = new Map<string, LinkedEntityRecord>();

  for (const client of clients as LinkedEntityRecord[]) {
    clientMap.set(String(client._id), { _id: String(client._id), fullName: client.fullName });
  }

  for (const supplier of suppliers as LinkedEntityRecord[]) {
    supplierMap.set(String(supplier._id), { _id: String(supplier._id), fullName: supplier.fullName });
  }

  return rows.map((row) => {
    if (!row.linkedId) {
      return row;
    }

    const linkedId = String(row.linkedId);
    const linkedEntity = row.linkedType === 'client' ? clientMap.get(linkedId) : supplierMap.get(linkedId);

    return {
      ...row,
      linkedId: linkedEntity ?? { _id: linkedId, fullName: undefined },
    };
  });
}

function getStartOfWeek(referenceDate: Date): Date {
  const start = new Date(referenceDate);
  const dayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayOffset);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getStartOfToday(referenceDate: Date): Date {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  return today;
}

function getStartOfMonth(referenceDate: Date): Date {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1, 0, 0, 0, 0);
}

export const getDashboardStats = async (userId: string): Promise<DashboardStats> => {
  await ConnectDb();

  const now = new Date();
  const weekStart = getStartOfWeek(now);
  const monthStart = getStartOfMonth(now);

  const [totalClients, totalSuppliers, notesThisWeek, quotesThisMonth, acceptedTotals] = await Promise.all([
    Client.countDocuments({ user: userId }),
    Supplier.countDocuments({ user: userId }),
    Note.countDocuments({ user: userId, createdAt: { $gte: weekStart, $lte: now } }),
    Quote.countDocuments({ user: userId, date: { $gte: monthStart, $lte: now } }),
    Quote.aggregate<{ total: number }>([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          status: 'accepted',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalIncludingTax' },
        },
      },
    ]),
  ]);

  const acceptedQuotesValue = acceptedTotals[0]?.total ?? 0;

  return {
    totalClients,
    totalSuppliers,
    notesThisWeek,
    quotesThisMonth,
    acceptedQuotesValue,
  };
};

export const getDashboardActivity = async (userId: string): Promise<DashboardActivityItem[]> => {
  await ConnectDb();

  const rows = await ActivityLog.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('_id action entityType entityName createdAt')
    .lean();

  return rows as DashboardActivityItem[];
};

export const getDashboardFollowUps = async (userId: string): Promise<DashboardFollowUpItem[]> => {
  await ConnectDb();

  const todayStart = getStartOfToday(new Date());

  const rows = await Note.find({
    user: userId,
    followUpDate: { $ne: null, $gte: todayStart },
  })
    .sort({ followUpDate: 1 })
    .select('_id title followUpDate linkedType linkedId')
    .lean();

  return hydrateFollowUps(userId, rows as DashboardFollowUpItem[]);
};
