import mongoose from "mongoose";

import ConnectDb from "@/db/connectDb";
import User from "@/db/models/User";

function objectIdOrNull(value?: string | null) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

export async function getCompanyUserObjectIds(params: {
  companyId?: string | null;
  fallbackUserId: string;
}): Promise<mongoose.Types.ObjectId[]> {
  await ConnectDb();

  const fallbackUserObjectId = objectIdOrNull(params.fallbackUserId);
  const companyObjectId = objectIdOrNull(params.companyId);

  if (!companyObjectId) {
    return fallbackUserObjectId ? [fallbackUserObjectId] : [];
  }

  const userIds = await User.find({ companyId: companyObjectId }).distinct("_id");
  const normalized = userIds
    .map((value) => objectIdOrNull(String(value)))
    .filter((value): value is mongoose.Types.ObjectId => Boolean(value));

  if (normalized.length > 0) {
    return normalized;
  }

  return fallbackUserObjectId ? [fallbackUserObjectId] : [];
}

export async function getCompanyUserIdStrings(params: {
  companyId?: string | null;
  fallbackUserId: string;
}): Promise<string[]> {
  const objectIds = await getCompanyUserObjectIds(params);
  return objectIds.map((value) => String(value));
}

export function buildUserScopeQuery(field: string, userIds: mongoose.Types.ObjectId[] | string[]) {
  if (userIds.length === 1) {
    return { [field]: userIds[0] };
  }

  return { [field]: { $in: userIds } };
}