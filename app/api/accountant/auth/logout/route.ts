import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { createConnectionLog } from "@/db/repository/connection-log";
import { getClientIp } from "@/utils/api/request";
import getAccountantSession from "@/utils/middlewares/accountantSession";

export async function POST(request: NextRequest) {
  try {
    const session = await getAccountantSession();
    const cookieStore = await cookies();
    cookieStore.delete("accountant-token");

    if (session.success && session.user) {
      await createConnectionLog({
        userId: session.user.id,
        companyId: session.user.companyId,
        role: session.user.role,
        eventType: "logout",
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
      });
    }

    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("POST /api/accountant/auth/logout failed", error);
    return NextResponse.json(
      { success: false, message: `Logout failed: ${String(error)}` },
      { status: 500 }
    );
  }
}