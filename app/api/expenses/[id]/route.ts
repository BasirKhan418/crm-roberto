import { NextRequest, NextResponse } from "next/server";

import {
  archiveExpense,
  getExpenseById,
  softDeleteExpense,
  updateExpense,
} from "@/db/repository/expense";
import { authorizeExpenseRoute } from "@/app/api/expenses/_shared";
import { checkExpensePermission } from "@/lib/expenses/access";
import { updateExpenseSchema } from "@/validators/expense.schema";
import { buildValidationError } from "@/utils/api/validation";
import { getClientIp } from "@/utils/api/request";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getDeleteMode(request: NextRequest): "archive" | "delete" {
  const mode = request.nextUrl.searchParams.get("mode")?.toLowerCase();
  return mode === "archive" ? "archive" : "delete";
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authorizeExpenseRoute("view");
    if (!auth.success) {
      return auth.response;
    }

    const { id } = await params;
    const result = await getExpenseById({
      companyId: auth.context.user.companyId || "",
      expenseId: id,
      access: auth.context.accessScope,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json({ success: true, expense: result.expense }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching expense detail: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authorizeExpenseRoute("manage");
    if (!auth.success) {
      return auth.response;
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const updated = await updateExpense({
      companyId: auth.context.user.companyId || "",
      expenseId: id,
      updatedBy: auth.context.user.id,
      payload: parsed.data,
      access: auth.context.accessScope,
      ipAddress: getClientIp(request),
    });

    if (!updated.success) {
      return NextResponse.json(updated, { status: updated.message.includes("not found") ? 404 : 400 });
    }

    return NextResponse.json({ success: true, expense: updated.expense }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error updating expense: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const mode = getDeleteMode(request);
    const auth = await authorizeExpenseRoute("manage");
    if (!auth.success) {
      return auth.response;
    }

    if (mode === "delete") {
      const deletePermission = checkExpensePermission(auth.context.user.role, "delete");
      if (!deletePermission.success) {
        return NextResponse.json(
          { success: false, message: deletePermission.message },
          { status: deletePermission.status }
        );
      }
    }

    const { id } = await params;

    if (mode === "archive") {
      const archived = await archiveExpense({
        companyId: auth.context.user.companyId || "",
        expenseId: id,
        updatedBy: auth.context.user.id,
        access: auth.context.accessScope,
        ipAddress: getClientIp(request),
      });

      if (!archived.success) {
        return NextResponse.json(archived, { status: 404 });
      }

      return NextResponse.json({ success: true, expense: archived.expense }, { status: 200 });
    }

    const removed = await softDeleteExpense({
      companyId: auth.context.user.companyId || "",
      expenseId: id,
      updatedBy: auth.context.user.id,
      access: auth.context.accessScope,
      ipAddress: getClientIp(request),
    });

    if (!removed.success) {
      return NextResponse.json(removed, { status: 404 });
    }

    return NextResponse.json({ success: true, expense: removed.expense }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error removing expense: ${String(error)}` },
      { status: 500 }
    );
  }
}
