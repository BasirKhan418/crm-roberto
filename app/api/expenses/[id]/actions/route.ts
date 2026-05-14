import { NextRequest, NextResponse } from "next/server";

import {
  archiveExpense,
  createExpenseAttachment,
  duplicateExpense,
  markExpensePaid,
} from "@/db/repository/expense";
import { authorizeExpenseRoute } from "@/app/api/expenses/_shared";
import { expenseActionSchema } from "@/validators/expense.schema";
import { buildValidationError } from "@/utils/api/validation";
import { getClientIp } from "@/utils/api/request";

interface RouteParams {
  params: Promise<{ id: string }>;
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
        return NextResponse.json(duplicated, { status: 404 });
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
        return NextResponse.json(archived, { status: 404 });
      }

      return NextResponse.json({ success: true, expense: archived.expense }, { status: 200 });
    }

    if (parsed.data.action === "mark_paid") {
      const marked = await markExpensePaid({
        companyId,
        expenseId: id,
        updatedBy: userId,
        payload: {
          paidAt: parsed.data.paidAt,
          paymentMethod: parsed.data.paymentMethod,
        },
        access: auth.context.accessScope,
        ipAddress,
      });

      if (!marked.success) {
        return NextResponse.json(marked, { status: 404 });
      }

      return NextResponse.json({ success: true, expense: marked.expense }, { status: 200 });
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
      return NextResponse.json(attachmentResult, { status: 404 });
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
