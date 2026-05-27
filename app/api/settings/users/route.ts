import { NextRequest, NextResponse } from "next/server";

import {
  createCompanyInvitation,
  getCompanyInvitationBranding,
  listCompanyUsers,
  updateCompanyUser,
} from "@/db/repository/company";
import getMe from "@/utils/middlewares/useMe";
import {
  inviteUserSchema,
  updateCompanyUserSchema,
} from "@/validators/invitation.schema";
import { buildValidationError } from "@/utils/api/validation";
import { requireModulePermission } from "@/lib/role-matrix";
import { sendInvitationEmail } from "@/emails/auth/sendInvitationEmail";
import { createI18nKey as i18nKey } from "@/lib/i18n/messages";
import { resolveLocaleFromRequest } from "@/lib/i18n/locale";
import { createConnectionLog } from "@/db/repository/connection-log";
import { getClientIp } from "@/utils/api/request";

function getAppBaseUrl(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  return request.nextUrl.origin;
}

export async function GET() {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || "Unauthorized" }, { status: 401 });
    }

    if (!me.user.companyId) {
      return NextResponse.json(
        { success: false, message: i18nKey("users.companyContextMissing") },
        { status: 400 }
      );
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: "users", action: "view" });
    if (!permission.success) {
      const message =
        permission.message === "Forbidden" ? i18nKey("users.forbidden") : permission.message;
      return NextResponse.json({ success: false, message }, { status: 403 });
    }

    const result = await listCompanyUsers(me.user.companyId);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    const users = result.users.map((user) => ({
      ...user,
      _id: String(user._id),
      companyId: undefined,
      createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
      lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
      accessRevokedAt: user.accessRevokedAt ? new Date(user.accessRevokedAt).toISOString() : null,
    }));

    return NextResponse.json({ success: true, users }, { status: 200 });
  } catch (error) {
    console.error("GET /api/settings/users failed", error);
    return NextResponse.json(
      { success: false, message: i18nKey("users.fetchUsersError") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || "Unauthorized" }, { status: 401 });
    }

    if (!me.user.companyId) {
      return NextResponse.json(
        { success: false, message: i18nKey("users.companyContextMissing") },
        { status: 400 }
      );
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: "users", action: "create" });
    if (!permission.success) {
      const message =
        permission.message === "Forbidden" ? i18nKey("users.forbidden") : permission.message;
      return NextResponse.json({ success: false, message }, { status: 403 });
    }

    const body = await request.json();
    const validation = inviteUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(buildValidationError(validation.error), { status: 400 });
    }

    const result = await createCompanyInvitation({
      companyId: me.user.companyId,
      invitedByUserId: me.user.id,
      email: validation.data.email,
      role: validation.data.role,
      name: validation.data.name,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    if (!result.token) {
      return NextResponse.json(
        { success: false, message: i18nKey("users.invitationTokenGenerationFailed") },
        { status: 500 }
      );
    }

    const baseUrl = getAppBaseUrl(request);
    const invitationUrl = `${baseUrl}/signup?invitationToken=${encodeURIComponent(result.token)}`;
    const locale = resolveLocaleFromRequest(request, {
      rawLocale: me.user.locale || null,
    });
    const brandingResult = await getCompanyInvitationBranding(me.user.companyId);
    const branding = brandingResult.success ? brandingResult.branding : null;

    const emailDelivery = await sendInvitationEmail({
      email: validation.data.email,
      invitationUrl,
      invitedByName: me.user.name,
      inviteeName: validation.data.name,
      role: validation.data.role,
      expiresAt: result.invitationExpiresAt,
      companyName: branding?.companyName || undefined,
      companyLogoUrl: branding?.logoUrl || undefined,
      locale,
    });

    const responseMessage = emailDelivery.success
      ? i18nKey("users.invitationCreatedAndEmailSent")
      : i18nKey("users.invitationCreatedEmailFailed");

    return NextResponse.json({
      success: true,
      message: responseMessage,
      data: {
        userId: result.userId,
        invitationExpiresAt: result.invitationExpiresAt,
        invitationUrl,
        emailDelivery: {
          success: emailDelivery.success,
          message: emailDelivery.message,
        },
      },
    });
  } catch (error) {
    console.error("POST /api/settings/users failed", error);
    return NextResponse.json(
      { success: false, message: i18nKey("users.inviteUserError") },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || "Unauthorized" }, { status: 401 });
    }

    if (!me.user.companyId) {
      return NextResponse.json(
        { success: false, message: i18nKey("users.companyContextMissing") },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = updateCompanyUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(buildValidationError(validation.error), { status: 400 });
    }

    const actionPermission = await requireModulePermission({
      companyId: me.user.companyId,
      role: me.user.role,
      moduleKey: "users",
      action: validation.data.role ? "edit" : "delete",
    });

    if (!actionPermission.success) {
      const message =
        actionPermission.message === "Forbidden" ? i18nKey("users.forbidden") : actionPermission.message;
      return NextResponse.json({ success: false, message }, { status: 403 });
    }

    if (validation.data.userId === me.user.id) {
      return NextResponse.json(
        {
          success: false,
          message: i18nKey("users.cannotSelfManage"),
        },
        { status: 400 }
      );
    }

    const usersResult = await listCompanyUsers(me.user.companyId);
    if (!usersResult.success) {
      return NextResponse.json(usersResult, { status: 400 });
    }

    const target = usersResult.users.find((user) => String(user._id) === validation.data.userId);
    if (!target) {
      return NextResponse.json(
        { success: false, message: i18nKey("users.userNotFound") },
        { status: 404 }
      );
    }

    const result = await updateCompanyUser({
      companyId: me.user.companyId,
      userId: validation.data.userId,
      role: validation.data.role,
      account_status: validation.data.account_status,
      revokeAccess: validation.data.revokeAccess,
    });

    if (result.success && validation.data.revokeAccess) {
      void createConnectionLog({
        userId: validation.data.userId,
        companyId: me.user.companyId,
        role: target.role,
        eventType: 'revoke_access',
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('user-agent'),
      });
    }

    if (result.success && validation.data.account_status === 'suspended') {
      void createConnectionLog({
        userId: validation.data.userId,
        companyId: me.user.companyId,
        role: target.role,
        eventType: 'force_logout',
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('user-agent'),
      });
    }

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("PATCH /api/settings/users failed", error);
    return NextResponse.json(
      { success: false, message: i18nKey("users.updateUserError") },
      { status: 500 }
    );
  }
}
