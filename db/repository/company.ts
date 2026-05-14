import argon2 from "argon2";
import mongoose from "mongoose";

import ConnectDb from "@/db/connectDb";
import Company from "@/db/models/Company";
import CompanyProfile from "@/db/models/CompanyProfile";
import User from "@/db/models/User";
import { createInvitationExpiry, generateInvitationToken, hashInvitationToken } from "@/lib/invitation-token";
import { normalizeRole } from "@/lib/permissions";

function sanitizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

async function buildUniqueCompanySlug(name: string) {
  const base = sanitizeSlug(name) || "company";
  let candidate = base;
  let suffix = 0;

  while (await Company.exists({ slug: candidate })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

function objectIdOrNull(value?: string | null) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

export async function getCompanyInvitationBranding(companyId: string) {
  await ConnectDb();

  const companyObjectId = objectIdOrNull(companyId);
  if (!companyObjectId) {
    return { success: false as const, message: "Invalid company" };
  }

  const company = await Company.findById(companyObjectId)
    .select("name slug ownerUserId")
    .lean<
      | {
          name?: string;
          slug?: string;
          ownerUserId?: mongoose.Types.ObjectId | null;
        }
      | null
    >();

  if (!company) {
    return { success: false as const, message: "Company not found" };
  }

  let profileCompanyName: string | null = null;
  let profileLogoUrl: string | null = null;

  if (company.ownerUserId && mongoose.Types.ObjectId.isValid(String(company.ownerUserId))) {
    const companyProfile = await CompanyProfile.findOne({ user: company.ownerUserId })
      .select("companyName logoUrl")
      .lean<{ companyName?: string; logoUrl?: string | null } | null>();

    profileCompanyName = companyProfile?.companyName?.trim() || null;
    profileLogoUrl = companyProfile?.logoUrl?.trim() || null;
  }

  return {
    success: true as const,
    branding: {
      companyName: profileCompanyName || company.name?.trim() || null,
      companySlug: company.slug?.trim() || null,
      logoUrl: profileLogoUrl,
    },
  };
}

type CompanyScopedUser = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  email: string;
  role?: string;
  companyId?: mongoose.Types.ObjectId | null;
};

export async function ensureUserCompanyContext(params: {
  userId: string;
  fallbackName?: string | null;
  fallbackEmail?: string | null;
}) {
  await ConnectDb();

  const user = await User.findById(params.userId)
    .select("_id name email role companyId")
    .lean<CompanyScopedUser | null>();

  if (!user) {
    return { success: false, message: "User not found" as const };
  }

  if (user.companyId) {
    const normalizedRole = normalizeRole(user.role);

    if (normalizedRole !== "super_admin") {
      const company = await Company.findById(user.companyId)
        .select("ownerUserId")
        .lean<{ ownerUserId?: mongoose.Types.ObjectId | null } | null>();

      const isCompanyOwner = Boolean(
        company?.ownerUserId && String(company.ownerUserId) === String(user._id)
      );

      if (isCompanyOwner && normalizedRole !== "administrator") {
        await User.updateOne({ _id: user._id }, { $set: { role: "administrator" } });
        return {
          success: true,
          companyId: String(user.companyId),
          role: "administrator" as const,
        };
      }
    }

    return {
      success: true,
      companyId: String(user.companyId),
      role: normalizedRole,
    };
  }

  const ownerName = user.name || params.fallbackName || user.email.split("@")[0] || "Company";
  const slug = await buildUniqueCompanySlug(ownerName);

  const company = await Company.create({
    name: ownerName,
    slug,
    status: "active",
    ownerUserId: user._id,
  });

  const existingRole = normalizeRole(user.role);
  const role = existingRole === "super_admin" ? "super_admin" : "administrator";

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        companyId: company._id,
        role,
        invitationStatus: "accepted",
      },
    }
  );

  return {
    success: true,
    companyId: String(company._id),
    role,
  };
}

export async function createCompanyOwnerAccount(params: {
  companyName: string;
  ownerName: string;
  email: string;
  passwordHash: string;
  locale?: "en" | "fr";
}) {
  await ConnectDb();

  const normalizedEmail = params.email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail }).select("_id").lean();
  if (existingUser) {
    return { success: false, message: "A user already exists with this email" as const };
  }

  const companyName = params.companyName.trim();
  const ownerName = params.ownerName.trim();
  const slug = await buildUniqueCompanySlug(companyName || ownerName || normalizedEmail);

  const ownerUser = await User.create({
    name: ownerName,
    email: normalizedEmail,
    password: params.passwordHash,
    locale: params.locale || "fr",
    isEmailVerified: true,
    account_status: "active",
    role: "administrator",
    invitationStatus: "accepted",
    isOnboardingComplete: false,
  });

  try {
    const company = await Company.create({
      name: companyName,
      slug,
      status: "active",
      ownerUserId: ownerUser._id,
    });

    ownerUser.companyId = company._id;
    await ownerUser.save();

    return {
      success: true as const,
      message: "Company owner account created",
      user: {
        _id: ownerUser._id,
        name: ownerUser.name,
        email: ownerUser.email,
        locale: ownerUser.locale,
        isOnboardingComplete: ownerUser.isOnboardingComplete,
        isEmailVerified: ownerUser.isEmailVerified,
        role: ownerUser.role,
        companyId: String(company._id),
      },
    };
  } catch (error) {
    await User.deleteOne({ _id: ownerUser._id });
    return {
      success: false,
      message: `Failed to create company workspace: ${String(error)}`,
    };
  }
}

export async function listCompanyUsers(companyId: string) {
  await ConnectDb();
  const companyObjectId = objectIdOrNull(companyId);
  if (!companyObjectId) {
    return { success: false, message: "Invalid company", users: [] };
  }

  const users = await User.find({ companyId: companyObjectId })
    .select(
      "name email role account_status invitationStatus isEmailVerified createdAt lastLoginAt accessRevokedAt"
    )
    .sort({ createdAt: -1 })
    .lean();

  return { success: true, users };
}

export async function createCompanyInvitation(params: {
  companyId: string;
  invitedByUserId: string;
  email: string;
  role: string;
  name?: string;
}) {
  await ConnectDb();

  const companyObjectId = objectIdOrNull(params.companyId);
  const invitedByObjectId = objectIdOrNull(params.invitedByUserId);

  if (!companyObjectId || !invitedByObjectId) {
    return { success: false, message: "Invalid invitation context" };
  }

  const existing = await User.findOne({ email: params.email }).select(
    "_id email companyId invitationStatus account_status"
  );

  const token = generateInvitationToken();
  const invitationTokenHash = hashInvitationToken(token);
  const invitationExpiresAt = createInvitationExpiry();

  if (existing && String(existing.companyId || "") !== String(companyObjectId)) {
    return { success: false, message: "This email already belongs to another company" };
  }

  if (existing) {
    existing.role = normalizeRole(params.role);
    existing.companyId = companyObjectId;
    existing.invitedBy = invitedByObjectId;
    existing.invitationStatus = "pending";
    existing.invitationTokenHash = invitationTokenHash;
    existing.invitationExpiresAt = invitationExpiresAt;
    existing.accessRevokedAt = null;
    if (existing.account_status !== "suspended") {
      existing.account_status = "active";
    }
    await existing.save();

    return {
      success: true,
      message: "Invitation created",
      token,
      userId: String(existing._id),
      invitationExpiresAt,
    };
  }

  const placeholderPassword = await argon2.hash(
    `${generateInvitationToken()}${process.env.PASSWORD_PEPPER || ""}`
  );

  const invitedUser = await User.create({
    name: params.name || params.email.split("@")[0],
    email: params.email,
    password: placeholderPassword,
    isEmailVerified: false,
    role: normalizeRole(params.role),
    companyId: companyObjectId,
    invitationStatus: "pending",
    invitedBy: invitedByObjectId,
    invitationTokenHash,
    invitationExpiresAt,
    account_status: "active",
  });

  return {
    success: true,
    message: "Invitation created",
    token,
    userId: String(invitedUser._id),
    invitationExpiresAt,
  };
}

export async function acceptCompanyInvitation(params: {
  token: string;
  passwordHash: string;
  name?: string;
}) {
  await ConnectDb();

  const invitationTokenHash = hashInvitationToken(params.token);

  const invitedUser = await User.findOne({ invitationTokenHash }).select(
    "+invitationTokenHash name email invitationStatus invitationExpiresAt role companyId account_status"
  );

  if (!invitedUser) {
    return { success: false, message: "Invalid invitation token" };
  }

  if (invitedUser.invitationStatus !== "pending") {
    return { success: false, message: "Invitation is no longer valid" };
  }

  const isExpired = !invitedUser.invitationExpiresAt || invitedUser.invitationExpiresAt < new Date();
  if (isExpired) {
    invitedUser.invitationStatus = "expired";
    await invitedUser.save();
    return { success: false, message: "Invitation expired" };
  }

  invitedUser.password = params.passwordHash;
  if (params.name) {
    invitedUser.name = params.name;
  }
  invitedUser.isEmailVerified = true;
  invitedUser.account_status = "active";
  invitedUser.invitationStatus = "accepted";
  invitedUser.isOnboardingComplete = true;
  invitedUser.invitationTokenHash = null;
  invitedUser.invitationExpiresAt = null;
  invitedUser.failedLoginCount = 0;
  invitedUser.lockedUntil = null;
  invitedUser.accessRevokedAt = null;

  await invitedUser.save();

  const ensured = await ensureUserCompanyContext({
    userId: String(invitedUser._id),
    fallbackName: invitedUser.name,
    fallbackEmail: invitedUser.email,
  });

  if (!ensured.success) {
    return { success: false, message: ensured.message };
  }

  return {
    success: true,
    message: "Invitation accepted",
    user: {
      _id: invitedUser._id,
      name: invitedUser.name,
      email: invitedUser.email,
      isOnboardingComplete: invitedUser.isOnboardingComplete,
      isEmailVerified: invitedUser.isEmailVerified,
      role: ensured.role,
      companyId: ensured.companyId,
      locale: invitedUser.locale,
    },
  };
}

export async function getInvitationByToken(token: string) {
  await ConnectDb();

  const invitationTokenHash = hashInvitationToken(token);
  const user = await User.findOne({ invitationTokenHash })
    .select("name email role invitationStatus invitationExpiresAt companyId")
    .lean<
      | {
          name?: string;
          email: string;
          role?: string;
          invitationStatus?: string;
          invitationExpiresAt?: Date | null;
          companyId?: mongoose.Types.ObjectId | string | null;
        }
      | null
    >();

  if (!user) {
    return { success: false, message: "Invalid invitation token" };
  }

  if (user.invitationStatus !== "pending") {
    return { success: false, message: "Invitation is no longer valid" };
  }

  if (!user.invitationExpiresAt || user.invitationExpiresAt < new Date()) {
    return { success: false, message: "Invitation expired" };
  }

  const brandingResult = user.companyId
    ? await getCompanyInvitationBranding(String(user.companyId))
    : null;
  const branding = brandingResult?.success ? brandingResult.branding : null;

  return {
    success: true,
    invitation: {
      email: user.email,
      name: user.name,
      role: normalizeRole(user.role),
      invitationExpiresAt: user.invitationExpiresAt,
      companyName: branding?.companyName || null,
      companySlug: branding?.companySlug || null,
      companyLogoUrl: branding?.logoUrl || null,
    },
  };
}

export async function updateCompanyUser(params: {
  companyId: string;
  userId: string;
  role?: string;
  account_status?: "active" | "suspended";
  revokeAccess?: boolean;
}) {
  await ConnectDb();

  const companyObjectId = objectIdOrNull(params.companyId);
  const userObjectId = objectIdOrNull(params.userId);
  if (!companyObjectId || !userObjectId) {
    return { success: false, message: "Invalid user context" };
  }

  const user = await User.findOne({ _id: userObjectId, companyId: companyObjectId });
  if (!user) {
    return { success: false, message: "User not found" };
  }

  if (params.role) {
    user.role = normalizeRole(params.role);
  }

  if (params.account_status) {
    user.account_status = params.account_status;
  }

  if (params.revokeAccess) {
    const now = new Date();
    user.accessRevokedAt = now;
    user.forceLogoutAfter = now;
    user.invitationStatus = user.invitationStatus === "pending" ? "revoked" : user.invitationStatus;
  }

  await user.save();

  return {
    success: true,
    message: "User updated",
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      account_status: user.account_status,
      invitationStatus: user.invitationStatus,
      accessRevokedAt: user.accessRevokedAt,
    },
  };
}
