import type { CompanyFeatureFlags } from "@/lib/company-features";
import { hasModuleActionAccess, canManageRoleMatrix } from "@/lib/module-access";
import type { ModulePermissionsMap } from "@/lib/permissions";

export { canManageRoleMatrix, hasModuleActionAccess } from "@/lib/module-access";

function matchesRoutePrefix(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isFeatureEnabled(
  featureFlags: Partial<CompanyFeatureFlags> | null | undefined,
  feature: keyof CompanyFeatureFlags
) {
  return featureFlags?.[feature] !== false;
}

export function canAccessCrmPath(
  pathname: string,
  role: string | null | undefined,
  modulePermissions?: ModulePermissionsMap | null,
  featureFlags?: Partial<CompanyFeatureFlags> | null
): boolean {
  if (matchesRoutePrefix(pathname, "/dashboard")) {
    return isFeatureEnabled(featureFlags, "financialDashboard") && hasModuleActionAccess({ role, modulePermissions, moduleKey: "financialDashboard", action: "view" });
  }

  if (matchesRoutePrefix(pathname, "/expenses")) {
    return isFeatureEnabled(featureFlags, "expenses") && hasModuleActionAccess({ role, modulePermissions, moduleKey: "expenses", action: "view" });
  }

  if (matchesRoutePrefix(pathname, "/tickets")) {
    return isFeatureEnabled(featureFlags, "tickets") && hasModuleActionAccess({ role, modulePermissions, moduleKey: "tickets", action: "view" });
  }

  if (matchesRoutePrefix(pathname, "/settings/users")) {
    return hasModuleActionAccess({ role, modulePermissions, moduleKey: "users", action: "view" });
  }

  if (matchesRoutePrefix(pathname, "/settings/roles")) {
    return canManageRoleMatrix(role, featureFlags);
  }

  if (matchesRoutePrefix(pathname, "/settings/expenses")) {
    return isFeatureEnabled(featureFlags, "expenses") && hasModuleActionAccess({ role, modulePermissions, moduleKey: "expenses", action: "view" });
  }

  if (
    pathname === "/settings" ||
    matchesRoutePrefix(pathname, "/settings/reminders") ||
    matchesRoutePrefix(pathname, "/settings/stripe")
  ) {
    return hasModuleActionAccess({ role, modulePermissions, moduleKey: "settings", action: "view" });
  }

  if (matchesRoutePrefix(pathname, "/clients")) {
    return hasModuleActionAccess({ role, modulePermissions, moduleKey: "clients", action: "view" });
  }

  if (matchesRoutePrefix(pathname, "/suppliers")) {
    return hasModuleActionAccess({ role, modulePermissions, moduleKey: "suppliers", action: "view" });
  }

  if (matchesRoutePrefix(pathname, "/catalogue")) {
    return hasModuleActionAccess({ role, modulePermissions, moduleKey: "catalogue", action: "view" });
  }

  if (matchesRoutePrefix(pathname, "/quotes")) {
    return hasModuleActionAccess({ role, modulePermissions, moduleKey: "quotes", action: "view" });
  }

  if (matchesRoutePrefix(pathname, "/notes")) {
    return hasModuleActionAccess({ role, modulePermissions, moduleKey: "notes", action: "view" });
  }

  if (matchesRoutePrefix(pathname, "/invoices")) {
    return hasModuleActionAccess({ role, modulePermissions, moduleKey: "invoices", action: "view" });
  }

  return true;
}

export function getSettingsLandingPath(
  role: string | null | undefined,
  modulePermissions?: ModulePermissionsMap | null,
  featureFlags?: Partial<CompanyFeatureFlags> | null
) {
  const candidates = ["/settings", "/settings/users", "/settings/expenses", "/settings/roles"] as const;

  return (
    candidates.find((pathname) => canAccessCrmPath(pathname, role, modulePermissions, featureFlags)) || null
  );
}

export function getDefaultCrmLandingPath(
  role: string | null | undefined,
  modulePermissions?: ModulePermissionsMap | null,
  featureFlags?: Partial<CompanyFeatureFlags> | null
): string {
  const settingsLandingPath = getSettingsLandingPath(role, modulePermissions, featureFlags);
  const candidates = [
    "/dashboard",
    "/expenses",
    "/tickets",
    "/clients",
    "/suppliers",
    "/catalogue",
    "/quotes",
    "/invoices",
    "/notes",
    settingsLandingPath,
    "/profile",
  ];

  const nextPath = candidates.find(
    (pathname): pathname is string => Boolean(pathname) && canAccessCrmPath(pathname, role, modulePermissions, featureFlags)
  );

  return nextPath || "/logout";
}