import { NextRequest, NextResponse } from "next/server";

import { createManualExpense, listExpenses } from "@/db/repository/expense";
import { authorizeExpenseRoute } from "@/app/api/expenses/_shared";
import {
  createManualExpenseSchema,
  expenseListFilterSchema,
} from "@/validators/expense.schema";
import { buildValidationError } from "@/utils/api/validation";
import { getClientIp } from "@/utils/api/request";

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeExpenseRoute("view");
    if (!auth.success) {
      return auth.response;
    }

    const filterPayload = {
      status: request.nextUrl.searchParams.get("status") || undefined,
      paymentStatus: request.nextUrl.searchParams.get("paymentStatus") || undefined,
      categoryId: request.nextUrl.searchParams.get("categoryId") || undefined,
      supplierId: request.nextUrl.searchParams.get("supplierId") || undefined,
      periodStart: request.nextUrl.searchParams.get("periodStart") || undefined,
      periodEnd: request.nextUrl.searchParams.get("periodEnd") || undefined,
      search: request.nextUrl.searchParams.get("search") || undefined,
      sortBy: request.nextUrl.searchParams.get("sortBy") || undefined,
      sortOrder: request.nextUrl.searchParams.get("sortOrder") || undefined,
      page: request.nextUrl.searchParams.get("page") || undefined,
      limit: request.nextUrl.searchParams.get("limit") || undefined,
    };

    const parsedFilters = expenseListFilterSchema.safeParse(filterPayload);
    if (!parsedFilters.success) {
      return NextResponse.json(buildValidationError(parsedFilters.error), { status: 400 });
    }

    const options = {
      page: parsedFilters.data.page || 1,
      limit: parsedFilters.data.limit || 10,
      search: parsedFilters.data.search || "",
      sortBy: parsedFilters.data.sortBy || "expenseDate",
      sortOrder: parsedFilters.data.sortOrder || "desc",
    } as const;

    const result = await listExpenses({
      companyId: auth.context.user.companyId || "",
      options,
      filters: {
        status: parsedFilters.data.status,
        paymentStatus: parsedFilters.data.paymentStatus,
        categoryId: parsedFilters.data.categoryId,
        supplierId: parsedFilters.data.supplierId,
        periodStart: parsedFilters.data.periodStart,
        periodEnd: parsedFilters.data.periodEnd,
      },
      access: auth.context.accessScope,
    });

    return NextResponse.json({
      success: true,
      items: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching expenses: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeExpenseRoute("manage");
    if (!auth.success) {
      return auth.response;
    }

    const body = await request.json();
    const parsed = createManualExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const created = await createManualExpense({
      companyId: auth.context.user.companyId || "",
      createdBy: auth.context.user.id,
      payload: parsed.data,
      ipAddress: getClientIp(request),
    });

    if (!created.success) {
      return NextResponse.json(created, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Expense created successfully",
        expense: created.expense,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error creating expense: ${String(error)}` },
      { status: 500 }
    );
  }
}
