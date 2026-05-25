import mongoose from "mongoose";

import ConnectDb from "@/db/connectDb";
import AuditLog from "@/db/models/AuditLog";
import Company from "@/db/models/Company";
import ConnectionLog from "@/db/models/ConnectionLog";
import User from "@/db/models/User";
import { recordAuditLog } from "@/db/repository/audit";
import type { CompanyFeatureFlagsDTO } from "@/validators/super-admin.schema";
import { buildPagination } from "@/utils/api/query";

type MaybeObjectId = string | mongoose.Types.ObjectId | null | undefined;

function isValidObjectId(value: MaybeObjectId): boolean {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
}

function toObjectId(value: string) {
  return new mongoose.Types.ObjectId(value);
}

function normalizeFeatureFlags(flags?: Partial<CompanyFeatureFlagsDTO> | null) {
  return {
    expenses: flags?.expenses ?? true,
    tickets: flags?.tickets ?? true,
    financialDashboard: flags?.financialDashboard ?? true,
    accountantPortal: flags?.accountantPortal ?? true,
    exports: flags?.exports ?? true,
    advancedRoles: flags?.advancedRoles ?? false,
  };
}

export async function getPlatformStats() {
  await ConnectDb();

  const [companyCount, activeCompanies, activeUsers, activeAccountants, recentAuditEvents, moduleUsage] = await Promise.all([
    Company.countDocuments({ deletedAt: null }),
    Company.countDocuments({ status: "active", deletedAt: null }),
    User.countDocuments({ account_status: "active" }),
    User.countDocuments({ role: "external_accountant", account_status: "active" }),
    AuditLog.find({}).sort({ performedAt: -1 }).limit(8).populate("performedBy", "name email").lean(),
    Company.aggregate<Array<{ _id: null; expenses: number; tickets: number; financialDashboard: number; accountantPortal: number; exports: number; advancedRoles: number }>>([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: null,
          expenses: { $sum: { $cond: ["$featureFlags.expenses", 1, 0] } },
          tickets: { $sum: { $cond: ["$featureFlags.tickets", 1, 0] } },
          financialDashboard: { $sum: { $cond: ["$featureFlags.financialDashboard", 1, 0] } },
          accountantPortal: { $sum: { $cond: ["$featureFlags.accountantPortal", 1, 0] } },
          exports: { $sum: { $cond: ["$featureFlags.exports", 1, 0] } },
          advancedRoles: { $sum: { $cond: ["$featureFlags.advancedRoles", 1, 0] } },
        },
      },
    ]),
  ]);

  return {
    success: true as const,
    data: {
      companyCount,
      activeCompanies,
      activeUsers,
      activeAccountants,
      recentAuditEvents,
      moduleUsage: moduleUsage[0] || {
        expenses: 0,
        tickets: 0,
        financialDashboard: 0,
        accountantPortal: 0,
        exports: 0,
        advancedRoles: 0,
      },
    },
  };
}

export async function listCompanies(params: {
  search?: string;
  status?: "all" | "active" | "suspended";
  page?: number;
  limit?: number;
}) {
  await ConnectDb();

  const page = params.page || 1;
  const limit = params.limit || 12;
  const query: Record<string, unknown> = { deletedAt: null };

  if (params.status && params.status !== "all") {
    query.status = params.status;
  }

  if (params.search?.trim()) {
    query.$or = [
      { name: { $regex: params.search.trim(), $options: "i" } },
      { slug: { $regex: params.search.trim(), $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Company.find(query)
      .populate("ownerUserId", "name email account_status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Company.countDocuments(query),
  ]);

  const companyIds = items.map((item) => item._id);
  const userCounts = await User.aggregate<{ _id: mongoose.Types.ObjectId; totalUsers: number; activeUsers: number; accountantUsers: number }>([
    { $match: { companyId: { $in: companyIds } } },
    {
      $group: {
        _id: "$companyId",
        totalUsers: { $sum: 1 },
        activeUsers: { $sum: { $cond: [{ $eq: ["$account_status", "active"] }, 1, 0] } },
        accountantUsers: { $sum: { $cond: [{ $eq: ["$role", "external_accountant"] }, 1, 0] } },
      },
    },
  ]);

  const countsByCompanyId = new Map(userCounts.map((entry) => [String(entry._id), entry]));

  return {
    success: true as const,
    data: {
      items: items.map((item) => {
        const counts = countsByCompanyId.get(String(item._id));
        return {
          ...item,
          userSummary: {
            totalUsers: counts?.totalUsers || 0,
            activeUsers: counts?.activeUsers || 0,
            accountantUsers: counts?.accountantUsers || 0,
          },
          featureFlags: normalizeFeatureFlags((item as { featureFlags?: Partial<CompanyFeatureFlagsDTO> }).featureFlags),
        };
      }),
      pagination: buildPagination(page, limit, total),
    },
  };
}

export async function getCompanyDetail(companyId: string) {
  await ConnectDb();
  if (!isValidObjectId(companyId)) {
    return { success: false as const, status: 400, message: "Invalid company id" };
  }

  const company = await Company.findOne({ _id: companyId, deletedAt: null })
    .populate("ownerUserId", "name email account_status role")
    .lean();

  if (!company) {
    return { success: false as const, status: 404, message: "Company not found" };
  }

  const [users, auditLogs, connectionLogs] = await Promise.all([
    User.find({ companyId }).select("name email role account_status createdAt lastLoginAt accessRevokedAt").sort({ createdAt: -1 }).lean(),
    AuditLog.find({ companyId }).sort({ performedAt: -1 }).limit(20).populate("performedBy", "name email").lean(),
    ConnectionLog.find({ companyId }).sort({ createdAt: -1 }).limit(20).populate("userId", "name email role").lean(),
  ]);

  return {
    success: true as const,
    data: {
      company: {
        ...company,
        featureFlags: normalizeFeatureFlags((company as { featureFlags?: Partial<CompanyFeatureFlagsDTO> }).featureFlags),
      },
      users,
      auditLogs,
      connectionLogs,
    },
  };
}

export async function createCompany(params: {
  name: string;
  slug: string;
  ownerUserId: string;
  featureFlags?: Partial<CompanyFeatureFlagsDTO>;
  performedBy: string;
  ipAddress?: string | null;
}) {
  await ConnectDb();

  if (!isValidObjectId(params.ownerUserId)) {
    return { success: false as const, status: 400, message: "Invalid owner user id" };
  }

  const existingCompany = await Company.findOne({ slug: params.slug.toLowerCase().trim(), deletedAt: null }).lean();
  if (existingCompany) {
    return { success: false as const, status: 400, message: "Company slug already exists" };
  }

  const owner = await User.findById(params.ownerUserId).select("_id companyId").lean();
  if (!owner) {
    return { success: false as const, status: 404, message: "Owner user not found" };
  }

  const company = await Company.create({
    name: params.name.trim(),
    slug: params.slug.toLowerCase().trim(),
    ownerUserId: toObjectId(params.ownerUserId),
    featureFlags: normalizeFeatureFlags(params.featureFlags),
  });

  await User.updateOne({ _id: owner._id }, { $set: { companyId: company._id, role: "administrator" } });

  await recordAuditLog({
    entityType: "user",
    entityId: String(company._id),
    companyId: String(company._id),
    action: "created",
    performedBy: params.performedBy,
    fieldName: "company",
    newValue: { name: company.name, slug: company.slug },
    ipAddress: params.ipAddress,
    source: "api",
  });

  return { success: true as const, data: company.toObject() };
}

export async function updateCompanyStatus(params: {
  companyId: string;
  status: "active" | "suspended";
  performedBy: string;
  ipAddress?: string | null;
}) {
  await ConnectDb();
  if (!isValidObjectId(params.companyId)) {
    return { success: false as const, status: 400, message: "Invalid company id" };
  }

  const update = {
    status: params.status,
    suspendedAt: params.status === "suspended" ? new Date() : null,
  };

  const company = await Company.findOneAndUpdate({ _id: params.companyId, deletedAt: null }, { $set: update }, { new: true }).lean();
  if (!company) {
    return { success: false as const, status: 404, message: "Company not found" };
  }

  if (params.status === "suspended") {
    await User.updateMany({ companyId: toObjectId(params.companyId), role: { $ne: "super_admin" } }, { $set: { account_status: "suspended" } });
  }

  await recordAuditLog({
    entityType: "user",
    entityId: params.companyId,
    companyId: params.companyId,
    action: "status_changed",
    performedBy: params.performedBy,
    fieldName: "company.status",
    newValue: params.status,
    ipAddress: params.ipAddress,
    source: "api",
  });

  return { success: true as const, data: company };
}

export async function updateCompanyFeatureFlags(params: {
  companyId: string;
  featureFlags: CompanyFeatureFlagsDTO;
  performedBy: string;
  ipAddress?: string | null;
}) {
  await ConnectDb();
  if (!isValidObjectId(params.companyId)) {
    return { success: false as const, status: 400, message: "Invalid company id" };
  }

  const company = await Company.findOneAndUpdate(
    { _id: params.companyId, deletedAt: null },
    { $set: { featureFlags: normalizeFeatureFlags(params.featureFlags) } },
    { new: true }
  ).lean();

  if (!company) {
    return { success: false as const, status: 404, message: "Company not found" };
  }

  await recordAuditLog({
    entityType: "user",
    entityId: params.companyId,
    companyId: params.companyId,
    action: "updated",
    performedBy: params.performedBy,
    fieldName: "company.featureFlags",
    newValue: params.featureFlags,
    ipAddress: params.ipAddress,
    source: "api",
  });

  return { success: true as const, data: company };
}

export async function listPlatformAuditLogs(params: { companyId?: string; entityType?: string; page?: number; limit?: number }) {
  await ConnectDb();

  const page = params.page || 1;
  const limit = params.limit || 20;
  const query: Record<string, unknown> = {};
  if (params.companyId && isValidObjectId(params.companyId)) {
    query.companyId = toObjectId(params.companyId);
  }
  if (params.entityType && params.entityType !== "all") {
    query.entityType = params.entityType;
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    AuditLog.find(query).sort({ performedAt: -1 }).skip(skip).limit(limit).populate("performedBy", "name email").lean(),
    AuditLog.countDocuments(query),
  ]);

  return { success: true as const, data: { items, pagination: buildPagination(page, limit, total) } };
}

export async function listConnectionLogs(params: { companyId?: string; search?: string; period?: string; eventType?: string; page?: number; limit?: number }) {
  await ConnectDb();

  const page = params.page || 1;
  const limit = params.limit || 20;
  const query: Record<string, unknown> = {};

  if (params.companyId && isValidObjectId(params.companyId)) {
    query.companyId = toObjectId(params.companyId);
  }
  if (params.eventType && params.eventType !== "all") {
    query.eventType = params.eventType;
  }
  if (params.search?.trim()) {
    query.$or = [
      { ipAddress: { $regex: params.search.trim(), $options: "i" } },
      { deviceLabel: { $regex: params.search.trim(), $options: "i" } },
      { userAgent: { $regex: params.search.trim(), $options: "i" } },
    ];
  }
  if (params.period && params.period !== "all") {
    const since = new Date();
    if (params.period === "24h") {
      since.setHours(since.getHours() - 24);
    } else if (params.period === "7d") {
      since.setDate(since.getDate() - 7);
    } else if (params.period === "30d") {
      since.setDate(since.getDate() - 30);
    }
    query.createdAt = { $gte: since };
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    ConnectionLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("userId", "name email role").populate("companyId", "name slug").lean(),
    ConnectionLog.countDocuments(query),
  ]);

  return { success: true as const, data: { items, pagination: buildPagination(page, limit, total) } };
}