import { NextRequest, NextResponse } from "next/server";

import { getAccountantPortalDashboard } from "@/db/repository/accountant-portal";
import { parseFinancialPeriodSearchParams } from "@/lib/financial-periods";
import getAccountantSession from "@/utils/middlewares/accountantSession";

export async function GET(request: NextRequest) {
  try {
    const session = await getAccountantSession();
    if (!session.success || !session.user) {
      return NextResponse.json({ success: false, message: session.message || "Unauthorized" }, { status: 401 });
    }
    if (session.user.featureFlags?.financialDashboard === false) {
      return NextResponse.json({ success: false, message: "Feature disabled" }, { status: 403 });
    }

    const result = await getAccountantPortalDashboard({
      companyId: session.user.companyId,
      userId: session.user.id,
      period: parseFinancialPeriodSearchParams(request.nextUrl.searchParams),
    });

    if (!result.success) {
      return NextResponse.json(result, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error("GET /api/accountant/dashboard failed", error);
    return NextResponse.json(
      { success: false, message: `Error fetching accountant dashboard: ${String(error)}` },
      { status: 500 }
    );
  }
}