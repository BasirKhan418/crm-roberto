import mongoose from "mongoose";

import ConnectDb from "@/db/connectDb";
import Company from "@/db/models/Company";

export const COMPANY_FEATURE_KEYS = [
  "expenses",
  "tickets",
  "financialDashboard",
  "accountantPortal",
  "exports",
  "advancedRoles",
] as const;

export type CompanyFeatureKey = (typeof COMPANY_FEATURE_KEYS)[number];

export type CompanyFeatureFlags = Record<CompanyFeatureKey, boolean>;

export const DEFAULT_COMPANY_FEATURE_FLAGS: CompanyFeatureFlags = {
  expenses: true,
  tickets: true,
  financialDashboard: true,
  accountantPortal: true,
  exports: true,
  advancedRoles: false,
};

export function normalizeCompanyFeatureFlags(
  flags?: Partial<CompanyFeatureFlags> | null
): CompanyFeatureFlags {
  return {
    expenses: flags?.expenses ?? DEFAULT_COMPANY_FEATURE_FLAGS.expenses,
    tickets: flags?.tickets ?? DEFAULT_COMPANY_FEATURE_FLAGS.tickets,
    financialDashboard: flags?.financialDashboard ?? DEFAULT_COMPANY_FEATURE_FLAGS.financialDashboard,
    accountantPortal: flags?.accountantPortal ?? DEFAULT_COMPANY_FEATURE_FLAGS.accountantPortal,
    exports: flags?.exports ?? DEFAULT_COMPANY_FEATURE_FLAGS.exports,
    advancedRoles: flags?.advancedRoles ?? DEFAULT_COMPANY_FEATURE_FLAGS.advancedRoles,
  };
}

function objectIdOrNull(value?: string | null) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }

  return new mongoose.Types.ObjectId(value);
}

export async function getCompanyFeatureFlags(companyId?: string | null) {
  const companyObjectId = objectIdOrNull(companyId);
  if (!companyObjectId) {
    return { success: false as const, message: "Invalid company context" };
  }

  await ConnectDb();
  const company = await Company.findById(companyObjectId)
    .select("featureFlags status deletedAt")
    .lean<{ featureFlags?: Partial<CompanyFeatureFlags>; status?: string; deletedAt?: Date | null } | null>();

  if (!company || company.deletedAt) {
    return { success: false as const, message: "Company not found" };
  }

  return {
    success: true as const,
    featureFlags: normalizeCompanyFeatureFlags(company.featureFlags),
    status: company.status || "active",
  };
}

export async function requireCompanyFeature(companyId: string | null | undefined, feature: CompanyFeatureKey) {
  const result = await getCompanyFeatureFlags(companyId);
  if (!result.success) {
    return { success: false as const, message: result.message, status: 400 };
  }

  if (result.status !== "active") {
    return { success: false as const, message: "Company suspended", status: 403 };
  }

  if (!result.featureFlags[feature]) {
    return { success: false as const, message: "Feature disabled", status: 403 };
  }

  return { success: true as const, featureFlags: result.featureFlags };
}