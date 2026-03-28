import mongoose from 'mongoose';

import ConnectDb from '@/db/connectDb';
import ActivityLog from '@/db/models/Activity';
import type { CreateActivityDTO, UpdateActivityDTO } from '@/validators/activity.schema';
import type { ListQueryOptions, PaginationMeta } from '@/utils/api/query';
import { buildPagination } from '@/utils/api/query';

export interface ActivityRecord {
  _id: string;
  action: string;
  entityType: 'client' | 'supplier' | 'note' | 'product' | 'quote';
  entityName: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityListResult {
  items: ActivityRecord[];
  pagination: PaginationMeta;
}

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

export const createActivityLog = async (userId: string, payload: CreateActivityDTO): Promise<ActivityRecord> => {
  await ConnectDb();

  const created = await ActivityLog.create({
    ...payload,
    user: userId,
  });

  return created.toObject() as ActivityRecord;
};

export const listActivities = async (userId: string, options: ListQueryOptions): Promise<ActivityListResult> => {
  await ConnectDb();

  const query: Record<string, unknown> = { user: userId };

  if (options.search) {
    query.$or = [
      { entityName: { $regex: options.search, $options: 'i' } },
      { action: { $regex: options.search, $options: 'i' } },
      { entityType: { $regex: options.search, $options: 'i' } },
    ];
  }

  const sortDirection = options.sortOrder === 'asc' ? 1 : -1;
  const skip = (options.page - 1) * options.limit;

  const [items, total] = await Promise.all([
    ActivityLog.find(query)
      .sort({ [options.sortBy]: sortDirection })
      .skip(skip)
      .limit(options.limit)
      .lean(),
    ActivityLog.countDocuments(query),
  ]);

  return {
    items: items as ActivityRecord[],
    pagination: buildPagination(options.page, options.limit, total),
  };
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

  const updated = await ActivityLog.findOneAndUpdate({ _id: activityId, user: userId }, payload, {
    new: true,
    runValidators: true,
  }).lean();

  return (updated as ActivityRecord | null) || null;
};

export const deleteActivityById = async (userId: string, activityId: string): Promise<boolean> => {
  await ConnectDb();

  if (!isValidObjectId(activityId)) {
    return false;
  }

  const result = await ActivityLog.deleteOne({ _id: activityId, user: userId });
  return result.deletedCount === 1;
};
