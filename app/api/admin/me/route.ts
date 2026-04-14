import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token")?.value;

    if (!token) {
      return NextResponse.json(
        { message: "No admin token", success: false },
        { status: 401 }
      );
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as {
      sub: string;
      name: string;
      email: string;
      kind?: string;
    };

    if (decoded.kind !== "admin") {
      return NextResponse.json(
        { message: "Not an admin token", success: false },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      admin: {
        id: decoded.sub,
        name: decoded.name,
        email: decoded.email,
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Invalid admin token", success: false },
      { status: 401 }
    );
  }
}
