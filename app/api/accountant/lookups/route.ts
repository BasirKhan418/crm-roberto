import { NextResponse } from "next/server";

import { listAccountantPortalLookups } from "@/db/repository/accountant-portal";
import getAccountantSession from "@/utils/middlewares/accountantSession";

export async function GET() {
  try {
    const session = await getAccountantSession();
    if (!session.success || !session.user) {
      return NextResponse.json({ success: false, message: session.message || "Unauthorized" }, { status: 401 });
    }

    const result = await listAccountantPortalLookups({ companyId: session.user.companyId });
    if (!result.success) {
      return NextResponse.json(result, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error("GET /api/accountant/lookups failed", error);
    return NextResponse.json(
      { success: false, message: `Error fetching accountant lookups: ${String(error)}` },
      { status: 500 }
    );
  }
}