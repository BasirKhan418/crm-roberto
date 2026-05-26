import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listCompanyRoleMatrix, ROLE_MATRIX_MODULES, saveCompanyRoleMatrix, type RoleMatrixPermissions } from "@/db/repository/role-matrix";
import { getCompanyFeatureFlags } from "@/lib/company-features";
import { COMPANY_ASSIGNABLE_ROLES, canManageTargetRole, normalizeRole } from "@/lib/permissions";
import { buildValidationError } from "@/utils/api/validation";
import getMe from "@/utils/middlewares/useMe";

const roleMatrixQuerySchema = z.object({
  role: z.enum(COMPANY_ASSIGNABLE_ROLES),
});

const permissionsSchema = z.object({
  canView: z.boolean(),
  canCreate: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canExport: z.boolean(),
  canManage: z.boolean(),
});

const roleMatrixUpdateSchema = z.object({
  role: z.enum(COMPANY_ASSIGNABLE_ROLES),
  rows: z.array(
    z.object({
      moduleKey: z.enum(ROLE_MATRIX_MODULES),
      permissions: permissionsSchema,
    })
  ),
});

function buildDefaultRows(rows: Array<{ moduleKey: typeof ROLE_MATRIX_MODULES[number]; permissions: RoleMatrixPermissions }>) {
  const map = new Map(rows.map((row) => [row.moduleKey, row]));
  return ROLE_MATRIX_MODULES.map((moduleKey) =>
    map.get(moduleKey) || {
      moduleKey,
      permissions: {
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canExport: false,
        canManage: false,
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const me = await getMe(true);
  if (!me.success || !me.user) {
    return NextResponse.json({ success: false, message: me.message || "Unauthorized" }, { status: 401 });
  }

  if (!me.user.companyId) {
    return NextResponse.json({ success: false, message: "Company context missing" }, { status: 400 });
  }

  const featureResult = await getCompanyFeatureFlags(me.user.companyId);
  if (!featureResult.success || !featureResult.featureFlags.advancedRoles) {
    return NextResponse.json({ success: false, message: "Feature disabled" }, { status: 403 });
  }

  if (normalizeRole(me.user.role) !== "administrator" && normalizeRole(me.user.role) !== "super_admin") {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const parsed = roleMatrixQuerySchema.safeParse({ role: request.nextUrl.searchParams.get("role") || undefined });
  if (!parsed.success) {
    return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
  }

  const result = await listCompanyRoleMatrix(me.user.companyId, parsed.data.role);
  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json({ success: true, role: parsed.data.role, rows: buildDefaultRows(result.rows) }, { status: 200 });
}

export async function PUT(request: NextRequest) {
  const me = await getMe(true);
  if (!me.success || !me.user) {
    return NextResponse.json({ success: false, message: me.message || "Unauthorized" }, { status: 401 });
  }

  if (!me.user.companyId) {
    return NextResponse.json({ success: false, message: "Company context missing" }, { status: 400 });
  }

  const featureResult = await getCompanyFeatureFlags(me.user.companyId);
  if (!featureResult.success || !featureResult.featureFlags.advancedRoles) {
    return NextResponse.json({ success: false, message: "Feature disabled" }, { status: 403 });
  }

  const actorRole = normalizeRole(me.user.role);
  if (actorRole !== "administrator" && actorRole !== "super_admin") {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = roleMatrixUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
  }

  if (!canManageTargetRole(actorRole, parsed.data.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const result = await saveCompanyRoleMatrix({
    companyId: me.user.companyId,
    role: parsed.data.role,
    rows: parsed.data.rows,
    updatedBy: me.user.id,
  });

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}