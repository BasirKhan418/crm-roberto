import type { CompanyFeatureFlags } from "@/lib/company-features";
import {
  getDefaultModulePermissions,
  normalizeRole,
  type ModulePermissionSet,
  type ModulePermissionsMap,
  type PermissionModuleAction,
  type PermissionModuleKey,
} from "@/lib/permissions";

export function getUserModulePermissions(params: {
  role?: string | null;
  modulePermissions?: ModulePermissionsMap | null;
  moduleKey: PermissionModuleKey;
}): ModulePermissionSet {
  return params.modulePermissions?.[params.moduleKey] || getDefaultModulePermissions(params.role, params.moduleKey);
}

export function hasModuleActionAccess(params: {
  role?: string | null;
  modulePermissions?: ModulePermissionsMap | null;
  moduleKey: PermissionModuleKey;
  action: PermissionModuleAction;
}) {
  const permissions = getUserModulePermissions(params);

  if (params.action === "view") return permissions.canView;
  if (params.action === "create") return permissions.canCreate;
  if (params.action === "edit") return permissions.canEdit;
  if (params.action === "delete") return permissions.canDelete;
  if (params.action === "export") return permissions.canExport;

  return permissions.canManage;
}

export function canManageRoleMatrix(role?: string | null, featureFlags?: Partial<CompanyFeatureFlags> | null) {
  if (featureFlags?.advancedRoles === false) {
    return false;
  }

  const normalizedRole = normalizeRole(role);
  return normalizedRole === "super_admin" || normalizedRole === "administrator";
}