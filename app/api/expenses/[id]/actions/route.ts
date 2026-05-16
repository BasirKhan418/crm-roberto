import { NextRequest, NextResponse } from "next/server";

import {
  addExpensePayment,
  archiveExpense,
  createExpenseAttachment,
  duplicateExpense,
  markExpensePaid,
  restoreArchivedExpense,
} from "@/db/repository/expense";
import { authorizeExpenseRoute } from "@/app/api/expenses/_shared";
import { expenseActionSchema } from "@/validators/expense.schema";
import { buildValidationError } from "@/utils/api/validation";
import { getClientIp } from "@/utils/api/request";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function resolveActionStatus(message?: string) {
  const normalizedMessage = (message || "").toLowerCase();
  if (normalizedMessage.includes("forbidden")) return 403;
  if (normalizedMessage.includes("not found")) return 404;
  return 400;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authorizeExpenseRoute("manage");
    if (!auth.success) {
      return auth.response;
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = expenseActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const companyId = auth.context.user.companyId || "";
    const userId = auth.context.user.id;
    const ipAddress = getClientIp(request);

    if (parsed.data.action === "duplicate") {
      const duplicated = await duplicateExpense({
        companyId,
        expenseId: id,
        duplicatedBy: userId,
        access: auth.context.accessScope,
        copyAttachments: parsed.data.copyAttachments,
        ipAddress,
      });

      if (!duplicated.success) {
        return NextResponse.json(duplicated, { status: resolveActionStatus(duplicated.message) });
      }

      return NextResponse.json({ success: true, expense: duplicated.expense }, { status: 201 });
    }

    if (parsed.data.action === "archive") {
      const archived = await archiveExpense({
        companyId,
        expenseId: id,
        updatedBy: userId,
        access: auth.context.accessScope,
        ipAddress,
      });

      if (!archived.success) {
        return NextResponse.json(archived, { status: resolveActionStatus(archived.message) });
      }

      return NextResponse.json({ success: true, expense: archived.expense }, { status: 200 });
    }

    if (parsed.data.action === "restore") {
      const restored = await restoreArchivedExpense({
        companyId,
        expenseId: id,
        updatedBy: userId,
        updatedByRole: auth.context.user.role,
        access: auth.context.accessScope,
        ipAddress,
      });

      if (!restored.success) {
        return NextResponse.json(restored, { status: resolveActionStatus(restored.message) });
      }

      return NextResponse.json({ success: true, expense: restored.expense }, { status: 200 });
    }

    if (parsed.data.action === "mark_paid") {
      const marked = await markExpensePaid({
        companyId,
        expenseId: id,
        updatedBy: userId,
        payload: {
          paidAt: parsed.data.paidAt,
          paymentMethod: parsed.data.paymentMethod,
          paidBy: parsed.data.paidBy,
        },
        access: auth.context.accessScope,
        ipAddress,
      });

      if (!marked.success) {
        return NextResponse.json(marked, { status: resolveActionStatus(marked.message) });
      }

      return NextResponse.json({ success: true, expense: marked.expense }, { status: 200 });
    }

    if (parsed.data.action === "add_payment") {
      const paymentAdded = await addExpensePayment({
        companyId,
        expenseId: id,
        updatedBy: userId,
        payload: {
          amountPaidCents: parsed.data.amountPaidCents,
          paidAt: parsed.data.paidAt,
          paymentMethod: parsed.data.paymentMethod,
          paidBy: parsed.data.paidBy,
        },
        access: auth.context.accessScope,
        ipAddress,
      });

      if (!paymentAdded.success) {
        return NextResponse.json(paymentAdded, { status: resolveActionStatus(paymentAdded.message) });
      }

      return NextResponse.json({ success: true, expense: paymentAdded.expense }, { status: 200 });
    }

    const attachmentResult = await createExpenseAttachment({
      companyId,
      expenseId: id,
      uploadedBy: userId,
      payload: parsed.data.attachment,
      access: auth.context.accessScope,
      ipAddress,
    });

    if (!attachmentResult.success) {
      return NextResponse.json(attachmentResult, { status: resolveActionStatus(attachmentResult.message) });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Attachment metadata saved",
        attachment: attachmentResult.attachment,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error applying expense action: ${String(error)}` },
      { status: 500 }
    );
  }
}
