import { NextRequest, NextResponse } from "next/server";

import { getFinancialDashboardData } from "@/db/repository/financial-dashboard";
import { requireCompanyFeature } from "@/lib/company-features";
import { parseFinancialPeriodSearchParams } from "@/lib/financial-periods";
import getMe from "@/utils/middlewares/useMe";

export async function GET(request: NextRequest) {
  try {
    const me = await getMe(true);

    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || "Unauthorized" }, { status: 401 });
    }

    const featureCheck = await requireCompanyFeature(me.user.companyId, "financialDashboard");
    if (!featureCheck.success) {
      return NextResponse.json({ success: false, message: featureCheck.message }, { status: featureCheck.status });
    }

    const result = await getFinancialDashboardData({
      companyId: me.user.companyId,
      userId: me.user.id,
      role: me.user.role,
      period: parseFinancialPeriodSearchParams(request.nextUrl.searchParams),
    });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: `Error loading financial dashboard: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}