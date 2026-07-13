import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { loginAccountantUser } from "@/db/repository/auth";
import { createConnectionLog } from "@/db/repository/connection-log";
import { signAuthToken } from "@/lib/auth-session";
import { requireCompanyFeature } from "@/lib/company-features";
import { createI18nKey as i18nKey } from "@/lib/i18n/messages";
import { buildValidationError } from "@/utils/api/validation";
import { getClientIp } from "@/utils/api/request";
import { loginSchema } from "@/validators/auth.schema";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const { email, password } = await request.json();
    const validation = loginSchema.safeParse({ email, password });

    if (!validation.success) {
      return NextResponse.json(buildValidationError(validation.error), { status: 400 });
    }

    const result = await loginAccountantUser(validation.data.email, validation.data.password);

    if (!result.success || !result.user) {
      cookieStore.delete("accountant-token");
      await createConnectionLog({
        eventType: "portal_login_failed",
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
      });

      return NextResponse.json(result, { status: 401 });
    }

    const featureCheck = await requireCompanyFeature(result.user.companyId, "accountantPortal");
    if (!featureCheck.success) {
      cookieStore.delete("accountant-token");
      return NextResponse.json(
        { success: false, message: featureCheck.message },
        { status: featureCheck.status }
      );
    }

    const token = signAuthToken({
      _id: result.user._id,
      name: result.user.name,
      email: result.user.email,
      locale: result.user.locale,
      isOnboardingComplete: result.user.isOnboardingComplete,
      isEmailVerified: result.user.isEmailVerified,
      role: result.user.role,
      companyId: result.user.companyId ? String(result.user.companyId) : null,
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

    await createConnectionLog({
      userId: String(result.user._id),
      companyId: result.user.companyId ? String(result.user.companyId) : null,
      role: result.user.role,
      eventType: "portal_login_success",
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      data: {
        redirectTo: "/accountant-portal",
      },
    });
  } catch (error) {
    console.error("POST /api/accountant/auth/login failed", error);
    return NextResponse.json(
      { success: false, message: i18nKey("auth.loginError") },
      { status: 500 }
    );
  }
}