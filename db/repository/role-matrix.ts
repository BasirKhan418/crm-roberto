import mongoose from "mongoose";

import ConnectDb from "@/db/connectDb";
import RoleMatrix from "@/db/models/RoleMatrix";
import type { AppRole } from "@/lib/permissions";

export const ROLE_MATRIX_MODULES = [
  "users",
  "expenses",
  "tickets",
  "invoices",
  "clients",
  "suppliers",
  "catalogue",
  "quotes",
  "notes",
  "financialDashboard",
  "settings",
  "auditTrail",
] as const;
export type RoleMatrixModuleKey = (typeof ROLE_MATRIX_MODULES)[number];

export type RoleMatrixPermissions = {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canManage: boolean;
};

export type RoleMatrixRow = {
  moduleKey: RoleMatrixModuleKey;
  permissions: RoleMatrixPermissions;
};

function objectIdOrNull(value?: string | null) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

export async function listCompanyRoleMatrix(companyId: string, role: AppRole) {
  await ConnectDb();
  const companyObjectId = objectIdOrNull(companyId);
  if (!companyObjectId) {
    return { success: false as const, message: "Invalid company" };
  }

  const rows = await RoleMatrix.find({ companyId: companyObjectId, role })
    .select("moduleKey permissions updatedAt updatedBy")
    .sort({ moduleKey: 1 })
    .lean<Array<{
      moduleKey: RoleMatrixModuleKey;
      permissions: RoleMatrixPermissions;
      updatedAt?: Date;
      updatedBy?: mongoose.Types.ObjectId;
    }>>();

  return { success: true as const, rows };
}

export async function saveCompanyRoleMatrix(params: {
  companyId: string;
  role: AppRole;
  rows: RoleMatrixRow[];
  updatedBy: string;
}) {
  await ConnectDb();
  const companyObjectId = objectIdOrNull(params.companyId);
  const updatedByObjectId = objectIdOrNull(params.updatedBy);
  if (!companyObjectId || !updatedByObjectId) {
    return { success: false as const, message: "Invalid company or user" };
  }

  await Promise.all(
    params.rows.map((row) =>
      RoleMatrix.findOneAndUpdate(
        { companyId: companyObjectId, role: params.role, moduleKey: row.moduleKey },
        {
          $set: {
            permissions: row.permissions,
            updatedBy: updatedByObjectId,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );

  return listCompanyRoleMatrix(params.companyId, params.role);
}

export async function getRoleMatrixOverride(params: {
  companyId: string;
  role: AppRole;
  moduleKey: RoleMatrixModuleKey;
}) {
  await ConnectDb();
  const companyObjectId = objectIdOrNull(params.companyId);
  if (!companyObjectId) {
    return null;
  }

  const row = await RoleMatrix.findOne({
    companyId: companyObjectId,
    role: params.role,
    moduleKey: params.moduleKey,
  })
    .select("permissions")
    .lean<{ permissions: RoleMatrixPermissions } | null>();

  return row?.permissions || null;
}