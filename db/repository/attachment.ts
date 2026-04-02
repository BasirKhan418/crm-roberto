import mongoose from 'mongoose';

import ConnectDb from '@/db/connectDb';
import ClientAttachment from '@/db/models/ClientAttachment';
import Client from '@/db/models/Client';

export interface AttachmentRecord {
  _id: string;
  user: string;
  clientId: string;
  fileName: string;
  fileUrl: string;
  fileType?: string | null;
  fileSize?: number | null;
  s3Key?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAttachmentDTO {
  fileName: string;
  fileUrl: string;
  fileType?: string | null;
  fileSize?: number | null;
  s3Key?: string | null;
}

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

export async function createAttachment(
  userId: string,
  clientId: string,
  payload: CreateAttachmentDTO,
): Promise<AttachmentRecord> {
  await ConnectDb();

  if (!isValidObjectId(clientId)) {
    throw new Error('Invalid client ID');
  }

  const client = await Client.exists({ _id: clientId, user: userId });
  if (!client) {
    throw new Error('Client not found');
  }

  const created = await ClientAttachment.create({
    user: userId,
    clientId,
    fileName: payload.fileName,
    fileUrl: payload.fileUrl,
    fileType: payload.fileType ?? null,
    fileSize: payload.fileSize ?? null,
    s3Key: payload.s3Key ?? null,
  });

  return created.toObject() as AttachmentRecord;
}

export async function listClientAttachments(
  userId: string,
  clientId: string,
): Promise<AttachmentRecord[]> {
  await ConnectDb();

  if (!isValidObjectId(clientId)) {
    return [];
  }

  const items = await ClientAttachment.find({ user: userId, clientId })
    .sort({ createdAt: -1 })
    .lean();

  return items as AttachmentRecord[];
}

export async function deleteAttachment(
  userId: string,
  attachmentId: string,
): Promise<boolean> {
  await ConnectDb();

  if (!isValidObjectId(attachmentId)) {
    return false;
  }

  const result = await ClientAttachment.deleteOne({ _id: attachmentId, user: userId });
  return result.deletedCount > 0;
}

export async function getAttachmentById(
  userId: string,
  attachmentId: string,
): Promise<AttachmentRecord | null> {
  await ConnectDb();

  if (!isValidObjectId(attachmentId)) {
    return null;
  }

  const item = await ClientAttachment.findOne({ _id: attachmentId, user: userId }).lean();
  return item ? (item as AttachmentRecord) : null;
}
