import { NextResponse } from "next/server";

import { getFinancialSmartAlertsData } from "@/db/repository/financial-dashboard";
import { requireCompanyFeature } from "@/lib/company-features";
import { requireModulePermission } from "@/lib/role-matrix";
import getMe from "@/utils/middlewares/useMe";

export async function GET() {
  try {
    const me = await getMe(true);

    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || "Unauthorized" }, { status: 401 });
    }

    const featureCheck = await requireCompanyFeature(me.user.companyId, "financialDashboard");
    if (!featureCheck.success) {
      return NextResponse.json({ success: false, message: featureCheck.message }, { status: featureCheck.status });
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: "financialDashboard", action: "view" });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    const result = await getFinancialSmartAlertsData({
      companyId: me.user.companyId,
      userId: me.user.id,
      role: me.user.role,
      allowFinancialDashboardAccess: true,
      companyWideAccess: true,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: `Error loading smart alerts: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}