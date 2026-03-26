import mongoose from 'mongoose';

import ConnectDb from '@/db/connectDb';
import Client from '@/db/models/Client';
import Note from '@/db/models/Note';
import type { CreateClientDTO, UpdateClientDTO } from '@/validators/client.schema';
import type { ListQueryOptions, PaginationMeta } from '@/utils/api/query';
import { buildPagination } from '@/utils/api/query';

export interface ClientRecord {
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
  linkedType: 'client';
  linkedId: string;
  followUpDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientListResult {
  items: ClientRecord[];
  pagination: PaginationMeta;
}

export interface ClientTimelineResult {
  notes: TimelineNoteRecord[];
  pagination: PaginationMeta;
}

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

export const createClient = async (userId: string, payload: CreateClientDTO): Promise<ClientRecord> => {
  await ConnectDb();

  const created = await Client.create({
    ...payload,
    user: userId,
  });

  return created.toObject() as ClientRecord;
};

export const listClients = async (userId: string, options: ListQueryOptions): Promise<ClientListResult> => {
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
    Client.find(query)
      .sort({ [options.sortBy]: sortDirection })
      .skip(skip)
      .limit(options.limit)
      .lean(),
    Client.countDocuments(query),
  ]);

  return {
    items: items as ClientRecord[],
    pagination: buildPagination(options.page, options.limit, total),
  };
};

export const getClientById = async (userId: string, clientId: string): Promise<ClientRecord | null> => {
  await ConnectDb();

  if (!isValidObjectId(clientId)) {
    return null;
  }

  const client = await Client.findOne({ _id: clientId, user: userId }).lean();
  return (client as ClientRecord | null) || null;
};

export const updateClientById = async (
  userId: string,
  clientId: string,
  payload: UpdateClientDTO
): Promise<ClientRecord | null> => {
  await ConnectDb();

  if (!isValidObjectId(clientId)) {
    return null;
  }

  const updated = await Client.findOneAndUpdate({ _id: clientId, user: userId }, payload, {
    new: true,
    runValidators: true,
  }).lean();

  return (updated as ClientRecord | null) || null;
};

export const deleteClientById = async (userId: string, clientId: string): Promise<boolean> => {
  await ConnectDb();

  if (!isValidObjectId(clientId)) {
    return false;
  }

  await Note.deleteMany({ user: userId, linkedType: 'client', linkedId: clientId });
  const result = await Client.deleteOne({ _id: clientId, user: userId });
  return result.deletedCount === 1;
};

export const listClientTimelineNotes = async (
  userId: string,
  clientId: string,
  options: Pick<ListQueryOptions, 'page' | 'limit' | 'search'>
): Promise<ClientTimelineResult> => {
  await ConnectDb();

  if (!isValidObjectId(clientId)) {
    return {
      notes: [],
      pagination: buildPagination(options.page, options.limit, 0),
    };
  }

  const query: Record<string, unknown> = {
    user: userId,
    linkedType: 'client',
    linkedId: clientId,
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
