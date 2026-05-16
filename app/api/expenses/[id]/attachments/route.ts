import { NextRequest, NextResponse } from "next/server";

import {
  createExpenseAttachment,
  deleteExpenseAttachment,
  listExpenseAttachments,
} from "@/db/repository/expense";
import { authorizeExpenseRoute } from "@/app/api/expenses/_shared";
import {
  createExpenseAttachmentSchema,
  deleteExpenseAttachmentSchema,
} from "@/validators/expense.schema";
import { buildValidationError } from "@/utils/api/validation";
import { getClientIp } from "@/utils/api/request";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function resolveExpenseAttachmentStatus(message?: string) {
  const normalized = (message || "").toLowerCase();
  if (normalized.includes("not found")) return 404;
  if (normalized.includes("forbidden")) return 403;
  return 400;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authorizeExpenseRoute("view");
    if (!auth.success) {
      return auth.response;
    }

    const { id } = await params;
    const result = await listExpenseAttachments({
      companyId: auth.context.user.companyId || "",
      expenseId: id,
      access: auth.context.accessScope,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json({ success: true, attachments: result.attachments }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching expense attachments: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authorizeExpenseRoute("manage");
    if (!auth.success) {
      return auth.response;
    }

    const body = await request.json();
    const parsed = createExpenseAttachmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const { id } = await params;
    const created = await createExpenseAttachment({
      companyId: auth.context.user.companyId || "",
      expenseId: id,
      uploadedBy: auth.context.user.id,
      payload: parsed.data.attachment,
      access: auth.context.accessScope,
      ipAddress: getClientIp(request),
    });

    if (!created.success) {
      return NextResponse.json(created, { status: resolveExpenseAttachmentStatus(created.message) });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Attachment metadata saved",
        attachment: created.attachment,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error creating expense attachment metadata: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authorizeExpenseRoute("manage");
    if (!auth.success) {
      return auth.response;
    }

    const body = await request.json();
    const parsed = deleteExpenseAttachmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const { id } = await params;
    const deleted = await deleteExpenseAttachment({
      companyId: auth.context.user.companyId || "",
      expenseId: id,
      attachmentId: parsed.data.attachmentId,
      reason: parsed.data.reason,
      reasonDetails: parsed.data.reasonDetails ?? null,
      deletedBy: auth.context.user.id,
      access: auth.context.accessScope,
      ipAddress: getClientIp(request),
    });

    if (!deleted.success) {
      return NextResponse.json(deleted, { status: resolveExpenseAttachmentStatus(deleted.message) });
    }

    return NextResponse.json({ success: true, attachment: deleted.attachment }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error deleting expense attachment metadata: ${String(error)}` },
      { status: 500 }
    );
  }
}
