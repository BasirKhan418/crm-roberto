import mongoose from 'mongoose';

import ConnectDb from '@/db/connectDb';
import ActivityLog from '@/db/models/Activity';
import Invoice from '@/db/models/Invoice';
import Quote from '@/db/models/Quote';
import { emitActivityChanged } from '@/lib/activity-events';
import type { CreateActivityDTO, UpdateActivityDTO } from '@/validators/activity.schema';
import type { ListQueryOptions, PaginationMeta } from '@/utils/api/query';
import { buildPagination } from '@/utils/api/query';

interface ActivityListQueryOptions extends ListQueryOptions {
  isRead?: boolean;
}

export interface ActivityRecord {
  _id: string;
  action: string;
  entityType: 'client' | 'supplier' | 'note' | 'product' | 'quote' | 'invoice';
  entityName: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  isRead?: boolean;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityListResult {
  items: ActivityRecord[];
  pagination: PaginationMeta;
  unreadCount: number;
}

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

export const createActivityLog = async (userId: string, payload: CreateActivityDTO): Promise<ActivityRecord> => {
  await ConnectDb();

  if (!payload?.action) {
    throw new Error('Action not initialized');
  }

  const created = await ActivityLog.create({
    ...payload,
    user: userId,
  });

  emitActivityChanged({
    userId,
    type: 'created',
    activityId: String(created._id),
  });

  return created.toObject() as ActivityRecord;
};

export const listActivities = async (userId: string, options: ActivityListQueryOptions): Promise<ActivityListResult> => {
  await ConnectDb();

  const query: Record<string, unknown> = { user: userId };

  if (typeof options.isRead === 'boolean') {
    query.isRead = options.isRead;
  }

  if (options.search) {
    query.$or = [
      { entityName: { $regex: options.search, $options: 'i' } },
      { action: { $regex: options.search, $options: 'i' } },
      { entityType: { $regex: options.search, $options: 'i' } },
    ];
  }

  const sortDirection = options.sortOrder === 'asc' ? 1 : -1;
  const skip = (options.page - 1) * options.limit;

  const [items, total, unreadCount] = await Promise.all([
    ActivityLog.find(query)
      .sort({ [options.sortBy]: sortDirection })
      .skip(skip)
      .limit(options.limit)
      .lean(),
    ActivityLog.countDocuments(query),
    ActivityLog.countDocuments({ user: userId, isRead: false }),
  ]);

  return {
    items: items as ActivityRecord[],
    pagination: buildPagination(options.page, options.limit, total),
    unreadCount,
  };
};

export const listClientActivities = async (userId: string, clientId: string, limit = 200): Promise<ActivityRecord[]> => {
  await ConnectDb();

  if (!isValidObjectId(clientId)) {
    return [];
  }

  const clientObjectId = new mongoose.Types.ObjectId(clientId);

  const [invoiceIds, quoteIds] = await Promise.all([
    Invoice.find({ userId, clientId: clientObjectId }).distinct('_id'),
    Quote.find({ user: userId, clientId: clientObjectId }).distinct('_id'),
  ]);

  const orClauses: Record<string, unknown>[] = [
    { entityType: 'client', entityId: clientObjectId },
    { 'metadata.clientId': clientId },
  ];

  const relatedEntityIds = [...invoiceIds, ...quoteIds];
  if (relatedEntityIds.length > 0) {
    orClauses.push({ entityId: { $in: relatedEntityIds } });
  }

  const items = await ActivityLog.find({ user: userId, $or: orClauses })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(limit, 500)))
    .lean();

  return items as ActivityRecord[];
};

export const getActivityById = async (userId: string, activityId: string): Promise<ActivityRecord | null> => {
  await ConnectDb();

  if (!isValidObjectId(activityId)) {
    return null;
  }

  const item = await ActivityLog.findOne({ _id: activityId, user: userId }).lean();
  return (item as ActivityRecord | null) || null;
};

export const updateActivityById = async (
  userId: string,
  activityId: string,
  payload: UpdateActivityDTO
): Promise<ActivityRecord | null> => {
  await ConnectDb();

  if (!isValidObjectId(activityId)) {
    return null;
  }

  const normalizedPayload = {
    ...payload,
    ...(typeof payload.readAt === 'string' ? { readAt: new Date(payload.readAt) } : {}),
  };

  const updated = await ActivityLog.findOneAndUpdate({ _id: activityId, user: userId }, normalizedPayload, {
    returnDocument: 'after',
    runValidators: true,
  }).lean();

  if (updated) {
    emitActivityChanged({
      userId,
      type: 'updated',
      activityId: String(activityId),
    });
  }

  return (updated as ActivityRecord | null) || null;
};

export const markAllActivitiesAsRead = async (userId: string): Promise<number> => {
  await ConnectDb();

  const result = await ActivityLog.updateMany(
    { user: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  if (result.modifiedCount > 0) {
    emitActivityChanged({
      userId,
      type: 'read_all',
      activityId: null,
    });
  }

  return result.modifiedCount;
};

export const deleteActivityById = async (userId: string, activityId: string): Promise<boolean> => {
  await ConnectDb();

  if (!isValidObjectId(activityId)) {
    return false;
  }

  const result = await ActivityLog.deleteOne({ _id: activityId, user: userId });

  if (result.deletedCount === 1) {
    emitActivityChanged({
      userId,
      type: 'deleted',
      activityId,
    });
  }

  return result.deletedCount === 1;
};
