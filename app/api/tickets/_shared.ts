import { NextResponse } from "next/server";

import {
  getTicketPermissionState,
  type TicketPermission,
} from "@/lib/tickets/access";
import { requireCompanyFeature } from "@/lib/company-features";
import { requireModulePermission } from "@/lib/role-matrix";
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

  const featureCheck = await requireCompanyFeature(me.user.companyId, "tickets");
  if (!featureCheck.success) {
    return {
      success: false,
      response: NextResponse.json({ success: false, message: featureCheck.message }, { status: featureCheck.status }),
    };
  }

  const matrixCheck = await requireModulePermission({
    companyId: me.user.companyId,
    role: me.user.role,
    moduleKey: "tickets",
    action: permission === "view" ? "view" : "manage",
  });
  if (!matrixCheck.success) {
    return {
      success: false,
      response: NextResponse.json({ success: false, message: matrixCheck.message }, { status: matrixCheck.status }),
    };
  }

  const defaultPermissionState = getTicketPermissionState(me.user.role);
  const permissionState = {
    ...defaultPermissionState,
    canView: matrixCheck.permissions.canView,
    canManage: matrixCheck.permissions.canManage,
  };

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
