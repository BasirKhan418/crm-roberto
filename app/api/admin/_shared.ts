import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export type AdminSessionPayload = {
  sub: string;
  name: string;
  email: string;
  kind?: string;
};

export async function getAdminSession(): Promise<
  | { success: true; admin: AdminSessionPayload }
  | { success: false; response: NextResponse }
> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin-token")?.value;

  if (!token) {
    return {
      success: false,
      response: NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 }),
    };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as AdminSessionPayload;
    if (decoded.kind !== "admin") {
      return {
        success: false,
        response: NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 }),
      };
    }

    return { success: true, admin: decoded };
  } catch {
    return {
      success: false,
      response: NextResponse.json({ success: false, message: "Invalid admin token" }, { status: 401 }),
    };
  }
}