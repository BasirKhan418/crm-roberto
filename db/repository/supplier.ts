import mongoose from 'mongoose';

import ConnectDb from '@/db/connectDb';
import Note from '@/db/models/Note';
import Supplier from '@/db/models/Supplier';
import type { CreateSupplierDTO, UpdateSupplierDTO } from '@/validators/supplier.schema';
import type { ListQueryOptions, PaginationMeta } from '@/utils/api/query';
import { buildPagination } from '@/utils/api/query';

export interface SupplierRecord {
  _id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  companyName?: string | null;
  vatNumber?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimelineNoteRecord {
  _id: string;
  title: string;
  description: string;
  linkedType: 'supplier';
  linkedId: string;
  followUpDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierListResult {
  items: SupplierRecord[];
  pagination: PaginationMeta;
}

export interface SupplierTimelineResult {
  notes: TimelineNoteRecord[];
  pagination: PaginationMeta;
}

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

export const createSupplier = async (userId: string, payload: CreateSupplierDTO): Promise<SupplierRecord> => {
  await ConnectDb();

  const created = await Supplier.create({
    ...payload,
    user: userId,
  });

  return created.toObject() as SupplierRecord;
};

export const listSuppliers = async (userId: string, options: ListQueryOptions): Promise<SupplierListResult> => {
  await ConnectDb();

  const query: Record<string, unknown> = { user: userId };

  if (options.search) {
    query.$or = [
      { fullName: { $regex: options.search, $options: 'i' } },
      { email: { $regex: options.search, $options: 'i' } },
      { phone: { $regex: options.search, $options: 'i' } },
      { address: { $regex: options.search, $options: 'i' } },
      { companyName: { $regex: options.search, $options: 'i' } },
      { vatNumber: { $regex: options.search, $options: 'i' } },
    ];
  }

  const sortDirection = options.sortOrder === 'asc' ? 1 : -1;
  const skip = (options.page - 1) * options.limit;

  const [items, total] = await Promise.all([
    Supplier.find(query)
      .sort({ [options.sortBy]: sortDirection })
      .skip(skip)
      .limit(options.limit)
      .lean(),
    Supplier.countDocuments(query),
  ]);

  return {
    items: items as SupplierRecord[],
    pagination: buildPagination(options.page, options.limit, total),
  };
};

export const getSupplierById = async (userId: string, supplierId: string): Promise<SupplierRecord | null> => {
  await ConnectDb();

  if (!isValidObjectId(supplierId)) {
    return null;
  }

  const supplier = await Supplier.findOne({ _id: supplierId, user: userId }).lean();
  return (supplier as SupplierRecord | null) || null;
};

export const updateSupplierById = async (
  userId: string,
  supplierId: string,
  payload: UpdateSupplierDTO
): Promise<SupplierRecord | null> => {
  await ConnectDb();

  if (!isValidObjectId(supplierId)) {
    return null;
  }

  const updated = await Supplier.findOneAndUpdate({ _id: supplierId, user: userId }, payload, {
    new: true,
    runValidators: true,
  }).lean();

  return (updated as SupplierRecord | null) || null;
};

export const deleteSupplierById = async (userId: string, supplierId: string): Promise<boolean> => {
  await ConnectDb();

  if (!isValidObjectId(supplierId)) {
    return false;
  }

  await Note.deleteMany({ user: userId, linkedType: 'supplier', linkedId: supplierId });
  const result = await Supplier.deleteOne({ _id: supplierId, user: userId });
  return result.deletedCount === 1;
};

export const listSupplierTimelineNotes = async (
  userId: string,
  supplierId: string,
  options: Pick<ListQueryOptions, 'page' | 'limit' | 'search'>
): Promise<SupplierTimelineResult> => {
  await ConnectDb();

  if (!isValidObjectId(supplierId)) {
    return {
      notes: [],
      pagination: buildPagination(options.page, options.limit, 0),
    };
  }

  const query: Record<string, unknown> = {
    user: userId,
    linkedType: 'supplier',
    linkedId: supplierId,
  };

  if (options.search) {
    query.$or = [
      { title: { $regex: options.search, $options: 'i' } },
      { description: { $regex: options.search, $options: 'i' } },
    ];
  }

  const skip = (options.page - 1) * options.limit;

  const [items, total] = await Promise.all([
    Note.find(query).sort({ createdAt: -1 }).skip(skip).limit(options.limit).lean(),
    Note.countDocuments(query),
  ]);

  return {
    notes: items as TimelineNoteRecord[],
    pagination: buildPagination(options.page, options.limit, total),
  };
};
