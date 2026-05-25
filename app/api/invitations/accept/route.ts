import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import argon2 from "argon2";

import { acceptCompanyInvitation } from "@/db/repository/company";
import { signAuthToken } from "@/lib/auth-session";
import { createI18nKey as i18nKey } from "@/lib/i18n/messages";
import { buildValidationError } from "@/utils/api/validation";
import { acceptInvitationSchema } from "@/validators/invitation.schema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = acceptInvitationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(buildValidationError(validation.error), { status: 400 });
    }

    const pepper = process.env.PASSWORD_PEPPER || "";
    const passwordHash = await argon2.hash(`${validation.data.password}${pepper}`);

    const result = await acceptCompanyInvitation({
      token: validation.data.token,
      passwordHash,
      name: validation.data.name,
    });

    if (!result.success || !result.user) {
      return NextResponse.json(result, { status: 400 });
    }

    const cookieStore = await cookies();
    const isExternalAccountant = result.user.role === "external_accountant";

    if (isExternalAccountant) {
      const token = signAuthToken({
        ...result.user,
        kind: "accountant_portal",
      });
      cookieStore.delete("token");
      cookieStore.set("accountant-token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      });
    } else {
      const token = signAuthToken(result.user);
      cookieStore.set("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      data: {
        isOnboardingComplete: result.user.isOnboardingComplete,
        redirectTo: isExternalAccountant ? "/accountant-portal" : "/dashboard",
      },
    });
  } catch (error) {
    console.error("POST /api/invitations/accept failed", error);
    return NextResponse.json(
      { success: false, message: i18nKey("users.acceptInvitationError") },
      { status: 500 }
    );
  }
}
