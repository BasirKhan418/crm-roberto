import argon2 from "argon2";
import jwt, { TokenExpiredError } from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

import ConnectDb from "@/db/connectDb";
import Admin from "@/db/models/Admin";
import { buildValidationError } from "@/utils/api/validation";
import { resetPasswordSchema } from "@/validators/forgot.schema";

async function getAdmin(email: string) {
  await ConnectDb();
  return Admin.findOne({ email: email.toLowerCase().trim() });
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
      console.error("[admin-reset] JWT_SECRET missing");
      return NextResponse.json({ message: "Server configuration error", success: false }, { status: 500 });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as { email: string; purpose?: string };
      if (decoded.email !== normalizedEmail || decoded.purpose !== "admin_password_reset") {
        return NextResponse.json({ message: "Session expired, please request a new one", success: false }, { status: 400 });
      }

      const admin = await getAdmin(normalizedEmail);
      if (!admin) {
        return NextResponse.json({ message: "Invalid reset session. Please request a new one.", success: false }, { status: 400 });
      }

      const pepper = process.env.PASSWORD_PEPPER || "";
      admin.password = await argon2.hash(password + pepper);
      await admin.save();

      return NextResponse.json({ message: "Password updated successfully", success: true }, { status: 200 });
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