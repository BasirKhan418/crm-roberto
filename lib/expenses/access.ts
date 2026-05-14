import { hasPermission, normalizeRole } from "@/lib/permissions";

export type ExpensePermission = "view" | "manage" | "delete";

type ExpensePermissionState = {
  role: string;
  ownOnly: boolean;
  canView: boolean;
  canManage: boolean;
  canDelete: boolean;
};

export function getExpensePermissionState(role: string | null | undefined): ExpensePermissionState {
  const normalizedRole = normalizeRole(role);

  return {
    role: normalizedRole,
    ownOnly: normalizedRole === "standard_user",
    canView: hasPermission(normalizedRole, "expenses.view"),
    canManage: hasPermission(normalizedRole, "expenses.manage"),
    canDelete: hasPermission(normalizedRole, "expenses.delete"),
  };
}

export function checkExpensePermission(
  role: string | null | undefined,
  permission: ExpensePermission
): { success: true } | { success: false; message: string; status: number } {
  const state = getExpensePermissionState(role);

  if (permission === "view" && !state.canView) {
    return { success: false, message: "Forbidden", status: 403 };
  }

  if (permission === "manage" && !state.canManage) {
    return { success: false, message: "Forbidden", status: 403 };
  }

  if (permission === "delete" && !state.canDelete) {
    return { success: false, message: "Forbidden", status: 403 };
  }

  return { success: true };
}
