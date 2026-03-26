import ConnectDb from '@/db/connectDb';
import ActivityLog from '@/db/models/Activity';
import Client from '@/db/models/Client';
import Note from '@/db/models/Note';
import Supplier from '@/db/models/Supplier';

export interface DashboardStats {
  totalClients: number;
  totalSuppliers: number;
  notesThisWeek: number;
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
  linkedId: {
    _id?: string;
    fullName?: string;
  } | null;
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

export const getDashboardStats = async (userId: string): Promise<DashboardStats> => {
  await ConnectDb();

  const now = new Date();
  const weekStart = getStartOfWeek(now);

  const [totalClients, totalSuppliers, notesThisWeek] = await Promise.all([
    Client.countDocuments({ user: userId }),
    Supplier.countDocuments({ user: userId }),
    Note.countDocuments({ user: userId, createdAt: { $gte: weekStart, $lte: now } }),
  ]);

  return {
    totalClients,
    totalSuppliers,
    notesThisWeek,
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
    .populate({ path: 'linkedId', select: '_id fullName' })
    .lean();

  return rows as DashboardFollowUpItem[];
};
