import mongoose from "mongoose";

import ConnectDb from "@/db/connectDb";
import Company from "@/db/models/Company";
import User from "@/db/models/User";

type IdLike = string | mongoose.Types.ObjectId;

/**
 * Company-level records — the company profile, the Stripe Connect account and the
 * reminder settings — are stored against the company owner's user ID
 * (`Company.ownerUserId`). Invited members (manager, secretary, …) must read and write
 * those records through this resolver rather than using their own user ID.
 *
 * `userId` can be any member of the company. When `companyId` is omitted it is looked
 * up from the user. Falls back to `userId` when there is no company context.
 */
export async function resolveCompanyOwnerUserId(params: {
  userId: IdLike;
  companyId?: IdLike | null;
}): Promise<string> {
  const userId = String(params.userId);
  await ConnectDb();

  let companyId = params.companyId ? String(params.companyId) : null;
  if (!companyId && mongoose.Types.ObjectId.isValid(userId)) {
    const user = await User.findById(userId)
      .select("companyId")
      .lean<{ companyId?: mongoose.Types.ObjectId | null } | null>();
    companyId = user?.companyId ? String(user.companyId) : null;
  }

  if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
    return userId;
  }

  const company = await Company.findById(companyId)
    .select("ownerUserId")
    .lean<{ ownerUserId?: mongoose.Types.ObjectId | null } | null>();

  return company?.ownerUserId ? String(company.ownerUserId) : userId;
}

/**
 * Returns the IDs of every user in the same company as `userId` (falls back to just
 * `userId` when there is no company context). Used where a background job or public
 * route only knows a record's creator and needs the company-wide scope.
 */
export async function resolveCompanyMemberUserIds(params: {
  userId: IdLike;
  companyId?: IdLike | null;
}): Promise<mongoose.Types.ObjectId[]> {
  const userId = String(params.userId);
  await ConnectDb();

  let companyId = params.companyId ? String(params.companyId) : null;
  if (!companyId && mongoose.Types.ObjectId.isValid(userId)) {
    const user = await User.findById(userId)
      .select("companyId")
      .lean<{ companyId?: mongoose.Types.ObjectId | null } | null>();
    companyId = user?.companyId ? String(user.companyId) : null;
  }

  const fallback = mongoose.Types.ObjectId.isValid(userId) ? [new mongoose.Types.ObjectId(userId)] : [];
  if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
    return fallback;
  }

  const ids = await User.find({ companyId: new mongoose.Types.ObjectId(companyId) }).distinct("_id");
  const members = ids.map((id) => new mongoose.Types.ObjectId(String(id)));
  return members.length > 0 ? members : fallback;
}
