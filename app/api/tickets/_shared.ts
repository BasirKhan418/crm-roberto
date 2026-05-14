import { NextResponse } from "next/server";

import {
  checkTicketPermission,
  getTicketPermissionState,
  type TicketPermission,
} from "@/lib/tickets/access";
import getMe from "@/utils/middlewares/useMe";

export type TicketRouteContext = {
  user: {
    id: string;
    role?: string;
    companyId?: string | null;
  };
  permissionState: ReturnType<typeof getTicketPermissionState>;
  accessScope: {
    ownOrAssignedOnly: boolean;
    userId: string;
  };
};

export async function authorizeTicketRoute(permission: TicketPermission): Promise<
  | { success: true; context: TicketRouteContext }
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
      response: NextResponse.json(
        { success: false, message: "Company context missing" },
        { status: 400 }
      ),
    };
  }

  const permissionCheck = checkTicketPermission(me.user.role, permission);
  if (!permissionCheck.success) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, message: permissionCheck.message },
        { status: permissionCheck.status }
      ),
    };
  }

  const permissionState = getTicketPermissionState(me.user.role);

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
        ownOrAssignedOnly: permissionState.ownOrAssignedOnly,
        userId: me.user.id,
      },
    },
  };
}
