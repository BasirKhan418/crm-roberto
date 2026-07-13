import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import getAccountantSession from "@/utils/middlewares/accountantSession";

export async function GET() {
  try {
    const session = await getAccountantSession();
    if (!session.success || !session.user) {
      const cookieStore = await cookies();
      cookieStore.delete("accountant-token");
      return NextResponse.json(
        { success: false, message: session.message || "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: session.message,
      user: session.user,
    });
  } catch (error) {
    console.error("GET /api/accountant/auth/me failed", error);
    return NextResponse.json(
      { success: false, message: `Error fetching accountant session: ${String(error)}` },
      { status: 500 }
    );
  }
}