import { NextResponse } from "next/server";

import { getMyTicketSummary } from "@/db/repository/ticket";
import { checkTicketPermission } from "@/lib/tickets/access";
import getMe from "@/utils/middlewares/useMe";

export async function GET() {
  try {
    const me = await getMe(true);

    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || "Unauthorized" }, { status: 401 });
    }

    const permission = checkTicketPermission(me.user.role, "view");
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    if (!me.user.companyId) {
      return NextResponse.json({ success: false, message: "Company context is required" }, { status: 400 });
    }

    const summary = await getMyTicketSummary({
      companyId: me.user.companyId,
      userId: me.user.id,
    });

    if (!summary.success) {
      return NextResponse.json({ success: false, message: summary.message, data: summary.data }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: summary.data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error loading ticket summary: ${String(error)}` },
      { status: 500 }
    );
  }
}
