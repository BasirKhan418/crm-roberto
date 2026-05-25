export const APP_ROLES = [
  "super_admin",
  "administrator",
  "manager",
  "standard_user",
  "secretary",
  "technician",
  "read_only",
  "external_accountant",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const APP_PERMISSIONS = [
  "users.view",
  "users.invite",
  "users.update_role",
  "users.revoke",
  "expenses.view",
  "expenses.manage",
  "expenses.delete",
  "tickets.view",
  "tickets.manage",
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

type RolePermissionsMap = Record<AppRole, readonly AppPermission[]>;

const ROLE_PERMISSIONS: RolePermissionsMap = {
  super_admin: APP_PERMISSIONS,
  administrator: [
    "users.view",
    "users.invite",
    "users.update_role",
    "users.revoke",
    "expenses.view",
    "expenses.manage",
    "tickets.view",
    "tickets.manage",
  ],
  manager: [
    "users.view",
    "expenses.view",
    "expenses.manage",
    "tickets.view",
    "tickets.manage",
  ],
  standard_user: ["expenses.view", "expenses.manage", "tickets.view", "tickets.manage"],
  secretary: ["expenses.view", "expenses.manage", "tickets.view", "tickets.manage"],
  technician: ["tickets.view", "tickets.manage"],
  read_only: ["expenses.view", "tickets.view", "users.view"],
  external_accountant: [],
};

export function normalizeRole(role?: string | null): AppRole {
  if (!role) return "standard_user";
  const match = APP_ROLES.find((value) => value === role);
  return match ?? "standard_user";
}

export function hasPermission(role: string | null | undefined, permission: AppPermission): boolean {
  const normalizedRole = normalizeRole(role);
  return ROLE_PERMISSIONS[normalizedRole].includes(permission);
}

export function canAccessModule(role: string | null | undefined, module: "expenses" | "tickets" | "settings") {
  if (module === "settings") {
    return hasPermission(role, "users.view") || hasPermission(role, "users.invite");
  }
  if (module === "expenses") {
    return hasPermission(role, "expenses.view");
  }
  return hasPermission(role, "tickets.view");
}

export function requirePermission(
  role: string | null | undefined,
  permission: AppPermission
): { success: true } | { success: false; message: string } {
  if (!hasPermission(role, permission)) {
    return { success: false, message: "Forbidden" };
  }
  return { success: true };
}

export function canManageTargetRole(actorRole: string | null | undefined, targetRole: string | null | undefined) {
  const actor = normalizeRole(actorRole);
  const target = normalizeRole(targetRole);

  if (actor === "super_admin") return true;
  if (actor === "administrator") {
    return target !== "super_admin";
  }

  return false;
}
