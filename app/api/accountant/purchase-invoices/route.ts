import { NextRequest, NextResponse } from "next/server";

import { listAccountantPurchaseInvoices } from "@/db/repository/accountant-portal";
import { parseFinancialPeriodSearchParams } from "@/lib/financial-periods";
import getAccountantSession from "@/utils/middlewares/accountantSession";

function hasPeriodFilters(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return ["period", "year", "month", "quarter", "startDate", "endDate"].some((key) => params.has(key));
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAccountantSession();
    if (!session.success || !session.user) {
      return NextResponse.json({ success: false, message: session.message || "Unauthorized" }, { status: 401 });
    }

    const page = Number.parseInt(request.nextUrl.searchParams.get("page") || "1", 10);
    const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") || "10", 10);
    const sortByParam = request.nextUrl.searchParams.get("sortBy");
    const sortBy =
      sortByParam === "amountInclVatCents" ||
      sortByParam === "supplierRef" ||
      sortByParam === "status" ||
      sortByParam === "createdAt"
        ? sortByParam
        : "expenseDate";
    const sortOrder = request.nextUrl.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const result = await listAccountantPurchaseInvoices({
      companyId: session.user.companyId,
      page: Number.isFinite(page) ? Math.max(1, page) : 1,
      limit: Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 10,
      search: request.nextUrl.searchParams.get("search") || undefined,
      sortBy,
      sortOrder,
      paymentStatus: request.nextUrl.searchParams.get("paymentStatus") || undefined,
      supplierId: request.nextUrl.searchParams.get("supplierId") || undefined,
      categoryId: request.nextUrl.searchParams.get("categoryId") || undefined,
      period: hasPeriodFilters(request) ? parseFinancialPeriodSearchParams(request.nextUrl.searchParams) : null,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error("GET /api/accountant/purchase-invoices failed", error);
    return NextResponse.json(
      { success: false, message: `Error fetching purchase invoices: ${String(error)}` },
      { status: 500 }
    );
  }
}