import argon2 from "argon2";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createCompanyOwnerAccount } from "@/db/repository/company";
import { signAuthToken } from "@/lib/auth-session";
import { resolveLocaleFromRequest } from "@/lib/i18n/locale";
import { buildValidationError } from "@/utils/api/validation";
import { createWorkspaceSchema } from "@/validators/auth.schema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createWorkspaceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(buildValidationError(validation.error), { status: 400 });
    }

    const requiredBootstrapCode = (process.env.COMPANY_BOOTSTRAP_CODE || "").trim();
    const providedBootstrapCode = (validation.data.bootstrapCode || "").trim();

    if (process.env.NODE_ENV === "production" && !requiredBootstrapCode) {
      return NextResponse.json(
        {
          success: false,
          message: "Company workspace setup is not configured. Contact support.",
        },
        { status: 503 }
      );
    }

    if (requiredBootstrapCode && providedBootstrapCode !== requiredBootstrapCode) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid company setup code. Contact support to create a new workspace.",
        },
        { status: 403 }
      );
    }

    const locale = resolveLocaleFromRequest(request, { rawLocale: null });
    const pepper = process.env.PASSWORD_PEPPER || "";
    const passwordHash = await argon2.hash(`${validation.data.password}${pepper}`);

    const result = await createCompanyOwnerAccount({
      companyName: validation.data.companyName,
      ownerName: validation.data.name,
      email: validation.data.email,
      passwordHash,
      locale,
    });

    if (!result.success || !result.user) {
      return NextResponse.json(result, { status: 400 });
    }

    const token = signAuthToken(result.user);
    const cookieStore = await cookies();
    cookieStore.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return NextResponse.json({
      success: true,
      message: "Workspace created successfully",
      data: {
        isOnboardingComplete: false,
        redirectTo: "/onboarding",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: `Error creating workspace ${String(error)}`,
      },
      { status: 500 }
    );
  }
}
