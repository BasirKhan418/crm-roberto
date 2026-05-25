import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createExpenseCategory,
  deleteExpenseCategory,
  ensureDefaultExpenseCategories,
  listExpenseCategories,
  updateExpenseCategory,
} from "@/db/repository/expenseCategory";
import { authorizeExpenseRoute } from "@/app/api/expenses/_shared";
import {
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
} from "@/validators/expense.schema";
import { buildValidationError } from "@/utils/api/validation";

const updateCategorySchema = updateExpenseCategorySchema.extend({
  categoryId: z.string().trim().min(1, "Category ID is required"),
});

const deleteCategorySchema = z.object({
  categoryId: z.string().trim().min(1, "Category ID is required"),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeExpenseRoute("view");
    if (!auth.success) {
      return auth.response;
    }

    const includeDisabled = request.nextUrl.searchParams.get("includeDisabled") !== "false";

    await ensureDefaultExpenseCategories(auth.context.user.companyId || "");
    const result = await listExpenseCategories(auth.context.user.companyId || "", includeDisabled);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({ success: true, categories: result.categories }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching expense categories: ${String(error)}` },
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
    const parsed = createExpenseCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const result = await createExpenseCategory(auth.context.user.companyId || "", parsed.data);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Category created",
        category: result.category,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error creating expense category: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authorizeExpenseRoute("manage");
    if (!auth.success) {
      return auth.response;
    }

    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const result = await updateExpenseCategory(
      auth.context.user.companyId || "",
      parsed.data.categoryId,
      {
        name: parsed.data.name,
        nameEn: parsed.data.nameEn,
        nameFr: parsed.data.nameFr,
        isEnabled: parsed.data.isEnabled,
        sortOrder: parsed.data.sortOrder,
      }
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Category updated",
        category: result.category,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error updating expense category: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authorizeExpenseRoute("manage");
    if (!auth.success) {
      return auth.response;
    }

    const body = await request.json();
    const parsed = deleteCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const result = await deleteExpenseCategory(
      auth.context.user.companyId || "",
      parsed.data.categoryId
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Category deleted",
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error deleting expense category: ${String(error)}` },
      { status: 500 }
    );
  }
}
