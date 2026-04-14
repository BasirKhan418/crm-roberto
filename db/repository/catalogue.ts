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
  priceIncludingTax: number;
  vatRate: number;
  currency: 'EUR';
  attachmentUrl?: string | null;
  attachmentKey?: string | null;
  attachmentMimeType?: string | null;
  attachmentName?: string | null;
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

function toPriceIncludingTax(priceExcludingTax: number, vatRate: number): number {
  return Math.round(priceExcludingTax * (1 + vatRate / 100));
}

export const createCatalogueItem = async (
  userId: string,
  payload: CreateCatalogueItemDTO
): Promise<CatalogueRecord> => {
  await ConnectDb();

  const priceIncludingTax = toPriceIncludingTax(payload.priceExcludingTax, payload.vatRate);

  const created = await CatalogueItem.create({
    ...payload,
    currency: payload.currency ?? 'EUR',
    priceIncludingTax,
    user: userId,
  });

  return created.toObject() as CatalogueRecord;
};

export const listCatalogueItems = async (
  userId: string,
  options: ListQueryOptions,
  filters?: { type?: CatalogueType; minPriceExcludingTax?: number; maxPriceExcludingTax?: number }
): Promise<CatalogueListResult> => {
  await ConnectDb();

  const query: Record<string, unknown> = { user: userId };

  if (filters?.type) {
    query.type = filters.type;
  }

  if (typeof filters?.minPriceExcludingTax === 'number' || typeof filters?.maxPriceExcludingTax === 'number') {
    const priceFilter: { $gte?: number; $lte?: number } = {};

    if (typeof filters?.minPriceExcludingTax === 'number') {
      priceFilter.$gte = Math.max(0, Math.round(filters.minPriceExcludingTax));
    }

    if (typeof filters?.maxPriceExcludingTax === 'number') {
      priceFilter.$lte = Math.max(0, Math.round(filters.maxPriceExcludingTax));
    }

    query.priceExcludingTax = priceFilter;
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

  const existing = await CatalogueItem.findOne({ _id: itemId, user: userId })
    .select('priceExcludingTax vatRate')
    .lean();

  if (!existing) {
    return null;
  }

  const nextPriceExcludingTax = payload.priceExcludingTax ?? (existing as { priceExcludingTax: number }).priceExcludingTax;
  const nextVatRate = payload.vatRate ?? (existing as { vatRate: number }).vatRate;

  const nextPayload: Record<string, unknown> = {
    ...payload,
    currency: payload.currency ?? 'EUR',
    priceIncludingTax: toPriceIncludingTax(nextPriceExcludingTax, nextVatRate),
  };

  const updated = await CatalogueItem.findOneAndUpdate({ _id: itemId, user: userId }, nextPayload, {
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
