import { NextResponse } from "next/server";

import { getFinancialSmartAlertsData } from "@/db/repository/financial-dashboard";
import getMe from "@/utils/middlewares/useMe";

export async function GET() {
  try {
    const me = await getMe(true);

    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || "Unauthorized" }, { status: 401 });
    }

    const result = await getFinancialSmartAlertsData({
      companyId: me.user.companyId,
      userId: me.user.id,
      role: me.user.role,
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