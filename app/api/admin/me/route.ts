import { NextResponse } from "next/server";

import { getAdminSession } from "@/app/api/admin/_shared";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session.success) {
      return session.response;
    }

    return NextResponse.json({
      success: true,
      admin: {
        id: session.admin.sub,
        name: session.admin.name,
        email: session.admin.email,
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Invalid admin token", success: false },
      { status: 401 }
    );
  }
}
