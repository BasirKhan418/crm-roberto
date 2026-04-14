import mongoose from 'mongoose';

import Client from '@/db/models/Client';
import ConnectDb from '@/db/connectDb';
import Note from '@/db/models/Note';
import Supplier from '@/db/models/Supplier';
import type { CreateNoteDTO, UpdateNoteDTO } from '@/validators/note.schema';
import type { ListQueryOptions, PaginationMeta } from '@/utils/api/query';
import { buildPagination } from '@/utils/api/query';

export interface NoteRecord {
  _id: string;
  title: string;
  description: string;
  linkedType: 'client' | 'supplier';
  linkedId: {
    _id?: string;
    fullName?: string;
  } | string;
  followUpDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteListResult {
  items: NoteRecord[];
  pagination: PaginationMeta;
}

interface LinkedEntityRecord {
  _id: string;
  fullName?: string;
}

interface RawNoteRecord extends Omit<NoteRecord, 'linkedId'> {
  linkedId: string;
}

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

async function ensureLinkedEntityExists(userId: string, linkedType: 'client' | 'supplier', linkedId: string): Promise<boolean> {
  if (!isValidObjectId(linkedId)) {
    return false;
  }

  if (linkedType === 'client') {
    const exists = await Client.exists({ _id: linkedId, user: userId });
    return Boolean(exists);
  }

  const exists = await Supplier.exists({ _id: linkedId, user: userId });
  return Boolean(exists);
}

async function hydrateNotesWithLinkedEntities(userId: string, rawNotes: RawNoteRecord[]): Promise<NoteRecord[]> {
  const clientIds = new Set<string>();
  const supplierIds = new Set<string>();

  for (const note of rawNotes) {
    if (!note.linkedId) {
      continue;
    }

    const linkedId = String(note.linkedId);
    if (!linkedId) {
      continue;
    }

    if (note.linkedType === 'client') {
      clientIds.add(linkedId);
    } else {
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

  return rawNotes.map((note) => {
    const linkedId = String(note.linkedId);
    const linkedEntity = note.linkedType === 'client' ? clientMap.get(linkedId) : supplierMap.get(linkedId);

    return {
      ...note,
      linkedId: linkedEntity ?? { _id: linkedId, fullName: undefined },
    };
  });
}

export const createNote = async (userId: string, payload: CreateNoteDTO): Promise<NoteRecord | null> => {
  await ConnectDb();

  const linkedExists = await ensureLinkedEntityExists(userId, payload.linkedType, payload.linkedId);
  if (!linkedExists) {
    return null;
  }

  const created = await Note.create({
    ...payload,
    user: userId,
  });

  const raw = (await Note.findById(created._id).lean()) as RawNoteRecord | null;
  if (!raw) {
    return null;
  }

  const hydrated = await hydrateNotesWithLinkedEntities(userId, [raw]);
  return hydrated[0] ?? null;
};

export const listNotes = async (
  userId: string,
  options: ListQueryOptions & { linkedType?: 'client' | 'supplier'; linkedId?: string }
): Promise<NoteListResult> => {
  await ConnectDb();

  const query: Record<string, unknown> = { user: userId };

  if (options.search) {
    query.$or = [
      { title: { $regex: options.search, $options: 'i' } },
      { description: { $regex: options.search, $options: 'i' } },
    ];
  }

  if (options.linkedType) {
    query.linkedType = options.linkedType;
  }

  if (options.linkedId && isValidObjectId(options.linkedId)) {
    query.linkedId = options.linkedId;
  }

  const sortDirection = options.sortOrder === 'asc' ? 1 : -1;
  const skip = (options.page - 1) * options.limit;

  const [items, total] = await Promise.all([
    Note.find(query)
      .sort({ [options.sortBy]: sortDirection })
      .skip(skip)
      .limit(options.limit)
      .lean(),
    Note.countDocuments(query),
  ]);

  const hydratedItems = await hydrateNotesWithLinkedEntities(userId, items as RawNoteRecord[]);

  return {
    items: hydratedItems,
    pagination: buildPagination(options.page, options.limit, total),
  };
};

export const getNoteById = async (userId: string, noteId: string): Promise<NoteRecord | null> => {
  await ConnectDb();

  if (!isValidObjectId(noteId)) {
    return null;
  }

  const note = (await Note.findOne({ _id: noteId, user: userId }).lean()) as RawNoteRecord | null;
  if (!note) {
    return null;
  }

  const hydrated = await hydrateNotesWithLinkedEntities(userId, [note]);
  return hydrated[0] ?? null;
};

export const updateNoteById = async (
  userId: string,
  noteId: string,
  payload: UpdateNoteDTO
): Promise<NoteRecord | null> => {
  await ConnectDb();

  if (!isValidObjectId(noteId)) {
    return null;
  }

  if (payload.linkedType && payload.linkedId) {
    const linkedExists = await ensureLinkedEntityExists(userId, payload.linkedType, payload.linkedId);
    if (!linkedExists) {
      return null;
    }
  }

  const updated = (await Note.findOneAndUpdate({ _id: noteId, user: userId }, payload, {
    new: true,
    runValidators: true,
  })
    .lean()) as RawNoteRecord | null;

  if (!updated) {
    return null;
  }

  const hydrated = await hydrateNotesWithLinkedEntities(userId, [updated]);
  return hydrated[0] ?? null;
};

export const deleteNoteById = async (userId: string, noteId: string): Promise<boolean> => {
  await ConnectDb();

  if (!isValidObjectId(noteId)) {
    return false;
  }

  const result = await Note.deleteOne({ _id: noteId, user: userId });
  return result.deletedCount === 1;
};
