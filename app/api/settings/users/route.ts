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
import { canManageTargetRole, requirePermission } from "@/lib/permissions";
import { sendInvitationEmail } from "@/emails/auth/sendInvitationEmail";
import { resolveLocaleFromRequest } from "@/lib/i18n/locale";

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
      return NextResponse.json({ success: false, message: "Company context missing" }, { status: 400 });
    }

    const permission = requirePermission(me.user.role, "users.view");
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: 403 });
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
    return NextResponse.json({ success: false, message: `Error fetching users ${error}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || "Unauthorized" }, { status: 401 });
    }

    if (!me.user.companyId) {
      return NextResponse.json({ success: false, message: "Company context missing" }, { status: 400 });
    }

    const permission = requirePermission(me.user.role, "users.invite");
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: 403 });
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
        { success: false, message: "Invitation token generation failed" },
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
      companyOwnerName: branding?.ownerName || undefined,
      companyLogoUrl: branding?.logoUrl || undefined,
      locale,
    });

    const responseMessage = emailDelivery.success
      ? "Invitation created and email sent"
      : "Invitation created, but email delivery failed";

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
    return NextResponse.json({ success: false, message: `Error inviting user ${error}` }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || "Unauthorized" }, { status: 401 });
    }

    if (!me.user.companyId) {
      return NextResponse.json({ success: false, message: "Company context missing" }, { status: 400 });
    }

    const body = await request.json();
    const validation = updateCompanyUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(buildValidationError(validation.error), { status: 400 });
    }

    const actionPermission = validation.data.role
      ? requirePermission(me.user.role, "users.update_role")
      : requirePermission(me.user.role, "users.revoke");

    if (!actionPermission.success) {
      return NextResponse.json({ success: false, message: actionPermission.message }, { status: 403 });
    }

    if (validation.data.userId === me.user.id && validation.data.revokeAccess) {
      return NextResponse.json(
        { success: false, message: "You cannot revoke your own access" },
        { status: 400 }
      );
    }

    const usersResult = await listCompanyUsers(me.user.companyId);
    if (!usersResult.success) {
      return NextResponse.json(usersResult, { status: 400 });
    }

    const target = usersResult.users.find((user) => String(user._id) === validation.data.userId);
    if (!target) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const targetRole = validation.data.role ?? target.role;
    if (!canManageTargetRole(me.user.role, targetRole)) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const result = await updateCompanyUser({
      companyId: me.user.companyId,
      userId: validation.data.userId,
      role: validation.data.role,
      account_status: validation.data.account_status,
      revokeAccess: validation.data.revokeAccess,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error updating user ${error}` }, { status: 500 });
  }
}
