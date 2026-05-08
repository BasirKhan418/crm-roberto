import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import argon2 from "argon2";
import ConnectDb from "@/db/connectDb";
import Admin from "@/db/models/Admin";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const { email, password } = await request.json();

    if (
      !email ||
      typeof email !== "string" ||
      !password ||
      typeof password !== "string"
    ) {
      return NextResponse.json(
        { message: "Email and password are required", success: false },
        { status: 400 }
      );
    }

    await ConnectDb();
    const admin = await Admin.findOne({
      email: email.toLowerCase().trim(),
    }).select("+password");

    if (!admin) {
      return NextResponse.json(
        { message: "Invalid credentials", success: false },
        { status: 401 }
      );
    }

    const pepper = process.env.PASSWORD_PEPPER || "";
    const isValid = await argon2.verify(admin.password, password + pepper);

    if (!isValid) {
      return NextResponse.json(
        { message: "Invalid credentials", success: false },
        { status: 401 }
      );
    }

    const token = jwt.sign(
      { sub: admin._id, name: admin.name, email: admin.email, kind: "admin" },
      process.env.JWT_SECRET || "",
      { expiresIn: "12h" }
    );

    cookieStore.set("admin-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 12 * 60 * 60,
      path: "/",
    });

    return NextResponse.json({
      message: "Login successful",
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Error logging in: " + error, success: false },
      { status: 500 }
    );
  }
}
