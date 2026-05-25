import { NextRequest, NextResponse } from "next/server";

import { createDraftFromAttachment } from "@/db/repository/expense";
import { authorizeExpenseRoute } from "@/app/api/expenses/_shared";
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

    return NextResponse.json(
      {
        success: true,
        message: "Draft expense created",
        expense: created.expense,
        attachment: created.attachment,
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
