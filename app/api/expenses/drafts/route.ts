import { NextRequest, NextResponse } from "next/server";

import { createDraftFromAttachment } from "@/db/repository/expense";
import { enqueueExpenseDraftOcrJob } from "@/lib/expenses/ocr-queue";
import { authorizeExpenseRoute } from "@/app/api/expenses/_shared";
import { markExpenseOcrStatus } from "@/db/repository/expense-ocr";
import { createDraftExpenseSchema } from "@/validators/expense.schema";
import { buildValidationError } from "@/utils/api/validation";
import { getClientIp } from "@/utils/api/request";

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeExpenseRoute("manage");
    if (!auth.success) {
      return auth.response;
    }

    const body = await request.json();
    const parsed = createDraftExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const created = await createDraftFromAttachment({
      companyId: auth.context.user.companyId || "",
      createdBy: auth.context.user.id,
      payload: parsed.data,
      ipAddress: getClientIp(request),
    });

    if (!created.success) {
      return NextResponse.json(created, { status: 400 });
    }

    let ocrQueued = false;
    let ocrQueueMessage: string | null = null;

    try {
      await enqueueExpenseDraftOcrJob({
        companyId: auth.context.user.companyId || "",
        expenseId: String(created.expense._id),
        attachmentId: String(created.attachment._id),
        createdBy: auth.context.user.id,
      });

      await markExpenseOcrStatus({
        companyId: auth.context.user.companyId || "",
        expenseId: String(created.expense._id),
        status: "queued",
      });

      ocrQueued = true;
    } catch (queueError) {
      ocrQueueMessage = queueError instanceof Error ? queueError.message : String(queueError);

      await markExpenseOcrStatus({
        companyId: auth.context.user.companyId || "",
        expenseId: String(created.expense._id),
        status: "failed",
        error: ocrQueueMessage,
      });

      console.error("Failed to enqueue expense draft OCR job", {
        expenseId: String(created.expense._id),
        message: ocrQueueMessage,
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Draft expense created",
        expense: created.expense,
        attachment: created.attachment,
        ocrQueued,
        ocrQueueMessage,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error creating expense draft: ${String(error)}` },
      { status: 500 }
    );
  }
}
