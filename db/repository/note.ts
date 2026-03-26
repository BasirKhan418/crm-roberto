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

  const withLinked = await Note.findById(created._id).populate({ path: 'linkedId', select: '_id fullName' }).lean();
  return (withLinked as NoteRecord | null) || null;
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
      .populate({ path: 'linkedId', select: '_id fullName' })
      .lean(),
    Note.countDocuments(query),
  ]);

  return {
    items: items as NoteRecord[],
    pagination: buildPagination(options.page, options.limit, total),
  };
};

export const getNoteById = async (userId: string, noteId: string): Promise<NoteRecord | null> => {
  await ConnectDb();

  if (!isValidObjectId(noteId)) {
    return null;
  }

  const note = await Note.findOne({ _id: noteId, user: userId })
    .populate({ path: 'linkedId', select: '_id fullName' })
    .lean();

  return (note as NoteRecord | null) || null;
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

  const updated = await Note.findOneAndUpdate({ _id: noteId, user: userId }, payload, {
    new: true,
    runValidators: true,
  })
    .populate({ path: 'linkedId', select: '_id fullName' })
    .lean();

  return (updated as NoteRecord | null) || null;
};

export const deleteNoteById = async (userId: string, noteId: string): Promise<boolean> => {
  await ConnectDb();

  if (!isValidObjectId(noteId)) {
    return false;
  }

  const result = await Note.deleteOne({ _id: noteId, user: userId });
  return result.deletedCount === 1;
};
