import { NextRequest, NextResponse } from "next/server";

import ConnectDb from "@/db/connectDb";
import Company from "@/db/models/Company";
import User from "@/db/models/User";
import { createDraftFromAttachment } from "@/db/repository/expense";
import { expenseEmailIngestSchema } from "@/validators/expense.schema";
import { buildValidationError } from "@/utils/api/validation";

const INGEST_SECRET =
  process.env.EXPENSE_EMAIL_INGEST_SECRET || process.env.EXPENSE_INGEST_SECRET || "";

function isAuthorizedIngestRequest(request: NextRequest): boolean {
  if (!INGEST_SECRET) return false;
  const headerSecret = request.headers.get("x-expense-ingest-secret") || "";
  return headerSecret === INGEST_SECRET;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedIngestRequest(request)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = expenseEmailIngestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    await ConnectDb();

    const company = await Company.findById(parsed.data.companyId)
      .select("ownerUserId")
      .lean<{ ownerUserId?: string | null } | null>();

    if (!company) {
      return NextResponse.json({ success: false, message: "Company not found" }, { status: 404 });
    }

    let createdBy = parsed.data.createdBy || null;

    if (createdBy) {
      const user = await User.findOne({ _id: createdBy, companyId: parsed.data.companyId })
        .select("_id")
        .lean();
      if (!user) {
        createdBy = null;
      }
    }

    if (!createdBy) {
      createdBy = company.ownerUserId ? String(company.ownerUserId) : null;
    }

    if (!createdBy) {
      return NextResponse.json(
        { success: false, message: "No valid company user available for ingest" },
        { status: 400 }
      );
    }

    const createdExpenseIds: string[] = [];
    const failedAttachments: Array<{ fileName: string; message: string }> = [];

    for (const attachment of parsed.data.attachments) {
      const created = await createDraftFromAttachment({
        companyId: parsed.data.companyId,
        createdBy,
        payload: {
          expenseDate: parsed.data.expenseDate,
          supplierId: parsed.data.supplierId,
          categoryId: parsed.data.categoryId,
          amountExclVatCents: parsed.data.amountExclVatCents,
          vatRate: parsed.data.vatRate,
          supplierRef: parsed.data.supplierRef,
          notes: parsed.data.notes,
          attachment,
        },
      });

      if (!created.success) {
        failedAttachments.push({
          fileName: attachment.originalName,
          message: created.message,
        });
        continue;
      }

      createdExpenseIds.push(String(created.expense._id));
    }

    const hasSuccess = createdExpenseIds.length > 0;

    return NextResponse.json(
      {
        success: hasSuccess,
        message: hasSuccess
          ? "Email ingest placeholder processed. Mailbox sync remains a Milestone 2 integration task."
          : "Email ingest failed for all attachments",
        data: {
          createdCount: createdExpenseIds.length,
          createdExpenseIds,
          failedCount: failedAttachments.length,
          failedAttachments,
        },
      },
      { status: hasSuccess ? 201 : 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error ingesting expense email payload: ${String(error)}` },
      { status: 500 }
    );
  }
}
