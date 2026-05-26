import argon2 from "argon2";
import jwt, { TokenExpiredError } from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

import getUserByEmail from "@/db/repository/getUserByEmail";
import updateUserPassword from "@/db/repository/updateUserPassword";
import { buildValidationError } from "@/utils/api/validation";
import { resetPasswordSchema } from "@/validators/forgot.schema";

async function isExternalAccountant(email: string) {
  const result = await getUserByEmail(email);
  return Boolean(result.success && result.user && result.user.role === "external_accountant");
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, token } = await request.json();
    const parseResult = resetPasswordSchema.safeParse({ email, password, token });
    if (!parseResult.success) {
      return NextResponse.json(buildValidationError(parseResult.error), { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("[accountant-reset] JWT_SECRET missing");
      return NextResponse.json({ message: "Server configuration error", success: false }, { status: 500 });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as { email: string; purpose?: string };
      if (decoded.email !== normalizedEmail || decoded.purpose !== "accountant_password_reset") {
        return NextResponse.json({ message: "Session expired, please request a new one", success: false }, { status: 400 });
      }

      if (!(await isExternalAccountant(normalizedEmail))) {
        return NextResponse.json({ message: "Invalid reset session. Please request a new one.", success: false }, { status: 400 });
      }

      const pepper = process.env.PASSWORD_PEPPER || "";
      const hashedPassword = await argon2.hash(password + pepper);
      const updateResult = await updateUserPassword(normalizedEmail, hashedPassword);
      return NextResponse.json(updateResult, { status: updateResult.success ? 200 : 400 });
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        return NextResponse.json({ message: "Your reset session has expired. Please request a new reset code.", success: false }, { status: 400 });
      }
      return NextResponse.json({ message: "Invalid reset session. Please request a new one.", success: false }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ message: `Error occurred while processing reset password request: ${error}`, success: false }, { status: 500 });
  }
}