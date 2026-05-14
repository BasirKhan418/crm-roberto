import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import argon2 from "argon2";

import { acceptCompanyInvitation } from "@/db/repository/company";
import { signAuthToken } from "@/lib/auth-session";
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
      message: result.message,
      data: {
        isOnboardingComplete: result.user.isOnboardingComplete,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error accepting invitation ${error}` },
      { status: 500 }
    );
  }
}
