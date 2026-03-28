import mongoose from 'mongoose';

import ConnectDb from '@/db/connectDb';
import CatalogueItem from '@/db/models/Catelogue';
import type { CreateCatalogueItemDTO, UpdateCatalogueItemDTO } from '@/validators/catalogue.schema';
import type { ListQueryOptions, PaginationMeta } from '@/utils/api/query';
import { buildPagination } from '@/utils/api/query';

export type CatalogueType = 'product' | 'service';

export interface CatalogueRecord {
  _id: string;
  user: string;
  name: string;
  description?: string | null;
  priceExcludingTax: number;
  vatRate: number;
  type: CatalogueType;
  createdAt: Date;
  updatedAt: Date;
}

export interface CatalogueListResult {
  items: CatalogueRecord[];
  pagination: PaginationMeta;
}

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

export const createCatalogueItem = async (
  userId: string,
  payload: CreateCatalogueItemDTO
): Promise<CatalogueRecord> => {
  await ConnectDb();

  const created = await CatalogueItem.create({
    ...payload,
    user: userId,
  });

  return created.toObject() as CatalogueRecord;
};

export const listCatalogueItems = async (
  userId: string,
  options: ListQueryOptions,
  filters?: { type?: CatalogueType }
): Promise<CatalogueListResult> => {
  await ConnectDb();

  const query: Record<string, unknown> = { user: userId };

  if (filters?.type) {
    query.type = filters.type;
  }

  if (options.search) {
    query.$or = [
      { name: { $regex: options.search, $options: 'i' } },
      { description: { $regex: options.search, $options: 'i' } },
      { type: { $regex: options.search, $options: 'i' } },
    ];
  }

  const sortDirection = options.sortOrder === 'asc' ? 1 : -1;
  const skip = (options.page - 1) * options.limit;

  const [items, total] = await Promise.all([
    CatalogueItem.find(query)
      .sort({ [options.sortBy]: sortDirection })
      .skip(skip)
      .limit(options.limit)
      .lean(),
    CatalogueItem.countDocuments(query),
  ]);

  return {
    items: items as CatalogueRecord[],
    pagination: buildPagination(options.page, options.limit, total),
  };
};

export const getCatalogueItemById = async (userId: string, itemId: string): Promise<CatalogueRecord | null> => {
  await ConnectDb();

  if (!isValidObjectId(itemId)) {
    return null;
  }

  const item = await CatalogueItem.findOne({ _id: itemId, user: userId }).lean();
  return (item as CatalogueRecord | null) || null;
};

export const updateCatalogueItemById = async (
  userId: string,
  itemId: string,
  payload: UpdateCatalogueItemDTO
): Promise<CatalogueRecord | null> => {
  await ConnectDb();

  if (!isValidObjectId(itemId)) {
    return null;
  }

  const updated = await CatalogueItem.findOneAndUpdate({ _id: itemId, user: userId }, payload, {
    new: true,
    runValidators: true,
  }).lean();

  return (updated as CatalogueRecord | null) || null;
};

export const deleteCatalogueItemById = async (userId: string, itemId: string): Promise<CatalogueRecord | null> => {
  await ConnectDb();

  if (!isValidObjectId(itemId)) {
    return null;
  }

  // Quotes keep item snapshots, so removing a catalogue item does not alter historical quotes.
  const deleted = await CatalogueItem.findOneAndDelete({ _id: itemId, user: userId }).lean();
  return (deleted as CatalogueRecord | null) || null;
};
