import type mongoose from "mongoose";
import { NextResponse } from "next/server";

import type { RoleMatrixModuleKey } from "@/db/repository/role-matrix";
import { buildUserScopeQuery, getCompanyUserObjectIds } from "@/lib/company-scope";
import type { PermissionModuleAction } from "@/lib/permissions";
import { requireModulePermission } from "@/lib/role-matrix";
import getMe, { type AuthorizedUser } from "@/utils/middlewares/useMe";

type CompanyRouteAccess =
  | { success: false; response: NextResponse }
  | {
      success: true;
      user: AuthorizedUser;
      /** IDs of every user in the caller's company. */
      companyUserIds: mongoose.Types.ObjectId[];
      /** Builds a filter matching records created by any member of the caller's company. */
      scope: (field: string) => Record<string, unknown>;
    };

/**
 * Authenticates the caller, enforces the role-matrix permission for `moduleKey`/`action`,
 * and returns a company-wide record scope so team members can act on each other's records.
 */
export async function authorizeCompanyRoute(params: {
  moduleKey: RoleMatrixModuleKey;
  action: PermissionModuleAction;
}): Promise<CompanyRouteAccess> {
  const me = await getMe(true);
  if (!me.success || !me.user) {
    return {
      success: false,
      response: NextResponse.json({ success: false, message: me.message || "Unauthorized" }, { status: 401 }),
    };
  }

  const permission = await requireModulePermission({
    companyId: me.user.companyId,
    role: me.user.role,
    moduleKey: params.moduleKey,
    action: params.action,
  });
  if (!permission.success) {
    return {
      success: false,
      response: NextResponse.json({ success: false, message: permission.message }, { status: permission.status }),
    };
  }

  const companyUserIds = await getCompanyUserObjectIds({ companyId: me.user.companyId, fallbackUserId: me.user.id });

  return {
    success: true,
    user: me.user,
    companyUserIds,
    scope: (field: string) => buildUserScopeQuery(field, companyUserIds),
  };
}
