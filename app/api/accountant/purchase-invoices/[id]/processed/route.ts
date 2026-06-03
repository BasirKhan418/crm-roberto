import { NextRequest, NextResponse } from "next/server";

import { updateAccountantPurchaseInvoiceProcessed } from "@/db/repository/accountant-portal";
import getAccountantSession from "@/utils/middlewares/accountantSession";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAccountantSession();
    if (!session.success || !session.user) {
      return NextResponse.json({ success: false, message: session.message || "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json().catch(() => null)) as { processed?: unknown } | null;

    if (typeof body?.processed !== "boolean") {
      return NextResponse.json({ success: false, message: "processed must be a boolean" }, { status: 400 });
    }

    const result = await updateAccountantPurchaseInvoiceProcessed({
      companyId: session.user.companyId,
      expenseId: id,
      processed: body.processed,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error updating purchase invoice process status: ${String(error)}` },
      { status: 500 }
    );
  }
}
