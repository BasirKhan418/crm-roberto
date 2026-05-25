import { getRoleMatrixOverride, type RoleMatrixModuleKey } from "@/db/repository/role-matrix";
import { getCompanyFeatureFlags } from "@/lib/company-features";
import { getDefaultModulePermissions, normalizeRole, type AppRole, type PermissionModuleAction } from "@/lib/permissions";

export async function getEffectiveModulePermissions(params: {
  companyId?: string | null;
  role?: string | null;
  moduleKey: RoleMatrixModuleKey;
}) {
  const normalizedRole = normalizeRole(params.role);
  const defaults = getDefaultModulePermissions(normalizedRole, params.moduleKey);

  if (!params.companyId) {
    return defaults;
  }

  const featureResult = await getCompanyFeatureFlags(params.companyId);
  if (!featureResult.success || !featureResult.featureFlags.advancedRoles) {
    return defaults;
  }

  if (normalizedRole === "super_admin" || normalizedRole === "administrator") {
    return defaults;
  }

  const override = await getRoleMatrixOverride({
    companyId: params.companyId,
    role: normalizedRole as AppRole,
    moduleKey: params.moduleKey,
  });

  return override || defaults;
}

export async function requireModulePermission(params: {
  companyId?: string | null;
  role?: string | null;
  moduleKey: RoleMatrixModuleKey;
  action: PermissionModuleAction;
}) {
  const permissions = await getEffectiveModulePermissions(params);

  const allowed =
    params.action === "view"
      ? permissions.canView
      : params.action === "create"
        ? permissions.canCreate
        : params.action === "edit"
          ? permissions.canEdit
          : params.action === "delete"
            ? permissions.canDelete
            : params.action === "export"
              ? permissions.canExport
              : permissions.canManage;

  if (!allowed) {
    return { success: false as const, message: "Forbidden", status: 403, permissions };
  }

  return { success: true as const, permissions };
}