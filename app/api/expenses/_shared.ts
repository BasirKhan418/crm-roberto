import { NextResponse } from "next/server";

import {
  checkExpensePermission,
  getExpensePermissionState,
  type ExpensePermission,
} from "@/lib/expenses/access";
import getMe from "@/utils/middlewares/useMe";

export type ExpenseRouteContext = {
  user: {
    id: string;
    role?: string;
    companyId?: string | null;
  };
  permissionState: ReturnType<typeof getExpensePermissionState>;
  accessScope: {
    ownOnly: boolean;
    userId: string;
  };
};

export async function authorizeExpenseRoute(permission: ExpensePermission): Promise<
  | { success: true; context: ExpenseRouteContext }
  | { success: false; response: NextResponse }
> {
  const me = await getMe(true);
  if (!me.success || !me.user) {
    return {
      success: false,
      response: NextResponse.json({ success: false, message: me.message || "Unauthorized" }, { status: 401 }),
    };
  }

  if (!me.user.companyId) {
    return {
      success: false,
      response: NextResponse.json({ success: false, message: "Company context missing" }, { status: 400 }),
    };
  }

  const permissionCheck = checkExpensePermission(me.user.role, permission);
  if (!permissionCheck.success) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, message: permissionCheck.message },
        { status: permissionCheck.status }
      ),
    };
  }

  const permissionState = getExpensePermissionState(me.user.role);

  return {
    success: true,
    context: {
      user: {
        id: me.user.id,
        role: me.user.role,
        companyId: me.user.companyId,
      },
      permissionState,
      accessScope: {
        ownOnly: permissionState.ownOnly,
        userId: me.user.id,
      },
    },
  };
}
