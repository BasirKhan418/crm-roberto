import { hasPermission, normalizeRole, type AppRole } from "@/lib/permissions";

function matchesRoutePrefix(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function hasRoleAccess(role: string | null | undefined, allowedRoles: readonly AppRole[]) {
  return allowedRoles.includes(normalizeRole(role));
}

const COMPANY_ADMIN_ROLES: readonly AppRole[] = ["super_admin", "administrator", "manager"];
const CONTACT_MANAGER_ROLES: readonly AppRole[] = ["super_admin", "administrator", "manager", "secretary"];

export function canAccessCrmPath(pathname: string, role: string | null | undefined): boolean {
  if (matchesRoutePrefix(pathname, "/dashboard")) {
    return hasPermission(role, "expenses.view");
  }

  if (matchesRoutePrefix(pathname, "/expenses")) {
    return hasPermission(role, "expenses.view");
  }

  if (matchesRoutePrefix(pathname, "/tickets")) {
    return hasPermission(role, "tickets.view");
  }

  if (matchesRoutePrefix(pathname, "/settings/users")) {
    return hasPermission(role, "users.view");
  }

  if (matchesRoutePrefix(pathname, "/settings/roles")) {
    return hasRoleAccess(role, ["super_admin", "administrator"]);
  }

  if (matchesRoutePrefix(pathname, "/settings/expenses")) {
    return hasPermission(role, "expenses.view");
  }

  if (
    pathname === "/settings" ||
    matchesRoutePrefix(pathname, "/settings/reminders") ||
    matchesRoutePrefix(pathname, "/settings/stripe")
  ) {
    return hasRoleAccess(role, COMPANY_ADMIN_ROLES);
  }

  if (matchesRoutePrefix(pathname, "/clients") || matchesRoutePrefix(pathname, "/suppliers")) {
    return hasRoleAccess(role, CONTACT_MANAGER_ROLES);
  }

  if (
    matchesRoutePrefix(pathname, "/catalogue") ||
    matchesRoutePrefix(pathname, "/quotes") ||
    matchesRoutePrefix(pathname, "/invoices") ||
    matchesRoutePrefix(pathname, "/notes")
  ) {
    return hasRoleAccess(role, COMPANY_ADMIN_ROLES);
  }

  return true;
}

export function getDefaultCrmLandingPath(role: string | null | undefined): string {
  if (hasPermission(role, "expenses.view")) {
    return "/dashboard";
  }

  if (hasPermission(role, "tickets.view")) {
    return "/tickets";
  }

  return "/logout";
}