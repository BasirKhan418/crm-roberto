import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

import ConnectDb from "@/db/connectDb";
import Admin from "@/db/models/Admin";

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

    await ConnectDb();
    const admin = await Admin.findById(decoded.sub).select("_id name email").lean<{
      _id: string;
      name: string;
      email: string;
    } | null>();

    if (!admin) {
      return {
        success: false,
        response: NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 }),
      };
    }

    return {
      success: true,
      admin: {
        sub: String(admin._id),
        name: admin.name,
        email: admin.email,
        kind: "admin",
      },
    };
  } catch {
    return {
      success: false,
      response: NextResponse.json({ success: false, message: "Invalid admin token" }, { status: 401 }),
    };
  }
}