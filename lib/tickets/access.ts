import { hasPermission, normalizeRole } from "@/lib/permissions";

export type TicketPermission = "view" | "manage";

type TicketPermissionState = {
  role: string;
  ownOrAssignedOnly: boolean;
  canView: boolean;
  canManage: boolean;
};

const OWN_OR_ASSIGNED_ROLES = new Set(["standard_user", "technician", "read_only"]);

export function getTicketPermissionState(role: string | null | undefined): TicketPermissionState {
  const normalizedRole = normalizeRole(role);

  return {
    role: normalizedRole,
    ownOrAssignedOnly: OWN_OR_ASSIGNED_ROLES.has(normalizedRole),
    canView: hasPermission(normalizedRole, "tickets.view"),
    canManage: hasPermission(normalizedRole, "tickets.manage"),
  };
}

export function checkTicketPermission(
  role: string | null | undefined,
  permission: TicketPermission
): { success: true } | { success: false; message: string; status: number } {
  const state = getTicketPermissionState(role);

  if (permission === "view" && !state.canView) {
    return { success: false, message: "Forbidden", status: 403 };
  }

  if (permission === "manage" && !state.canManage) {
    return { success: false, message: "Forbidden", status: 403 };
  }

  return { success: true };
}
