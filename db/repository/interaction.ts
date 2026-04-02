import mongoose from 'mongoose';

import ConnectDb from '@/db/connectDb';
import Interaction from '@/db/models/Interaction';
import Client from '@/db/models/Client';

export type InteractionType = 'call' | 'meeting' | 'email' | 'discussion';

export interface InteractionRecord {
  _id: string;
  user: string;
  clientId: string;
  type: InteractionType;
  title: string;
  notes?: string | null;
  date: Date;
  followUpDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInteractionDTO {
  type: InteractionType;
  title: string;
  notes?: string | null;
  date: string;
  followUpDate?: string | null;
}

export interface UpdateInteractionDTO {
  type?: InteractionType;
  title?: string;
  notes?: string | null;
  date?: string;
  followUpDate?: string | null;
}

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

export async function createInteraction(
  userId: string,
  clientId: string,
  payload: CreateInteractionDTO,
): Promise<InteractionRecord> {
  await ConnectDb();

  if (!isValidObjectId(clientId)) {
    throw new Error('Invalid client ID');
  }

  const client = await Client.exists({ _id: clientId, user: userId });
  if (!client) {
    throw new Error('Client not found');
  }

  const created = await Interaction.create({
    user: userId,
    clientId,
    type: payload.type,
    title: payload.title,
    notes: payload.notes ?? null,
    date: new Date(payload.date),
    followUpDate: payload.followUpDate ? new Date(payload.followUpDate) : null,
  });

  return created.toObject() as InteractionRecord;
}

export async function listClientInteractions(
  userId: string,
  clientId: string,
): Promise<InteractionRecord[]> {
  await ConnectDb();

  if (!isValidObjectId(clientId)) {
    return [];
  }

  const items = await Interaction.find({ user: userId, clientId })
    .sort({ date: -1 })
    .limit(200)
    .lean();

  return items as InteractionRecord[];
}

export async function deleteInteraction(
  userId: string,
  interactionId: string,
): Promise<boolean> {
  await ConnectDb();

  if (!isValidObjectId(interactionId)) {
    return false;
  }

  const result = await Interaction.deleteOne({ _id: interactionId, user: userId });
  return result.deletedCount > 0;
}
