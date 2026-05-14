import mongoose from "mongoose";

import ConnectDb from "@/db/connectDb";
import ExpenseCategory from "@/db/models/ExpenseCategory";
import { DEFAULT_EXPENSE_CATEGORY_NAMES } from "@/lib/expenses/constants";

type CreateExpenseCategoryInput = {
  name: string;
  slug?: string;
  isEnabled?: boolean;
  sortOrder?: number;
};

type UpdateExpenseCategoryInput = {
  name?: string;
  isEnabled?: boolean;
  sortOrder?: number;
};

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function isValidObjectId(value: string) {
  return mongoose.Types.ObjectId.isValid(value);
}

export async function ensureDefaultExpenseCategories(companyId: string) {
  await ConnectDb();

  if (!isValidObjectId(companyId)) {
    return { success: false as const, message: "Invalid company" };
  }

  for (const [index, categoryName] of DEFAULT_EXPENSE_CATEGORY_NAMES.entries()) {
    const slug = toSlug(categoryName);

    await ExpenseCategory.updateOne(
      { companyId, slug },
      {
        $setOnInsert: {
          companyId,
          name: categoryName,
          slug,
          isDefault: true,
          isEnabled: true,
          sortOrder: index,
        },
      },
      { upsert: true }
    );
  }

  const categories = await ExpenseCategory.find({ companyId })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  return { success: true as const, categories };
}

export async function listExpenseCategories(companyId: string, includeDisabled = true) {
  await ConnectDb();

  if (!isValidObjectId(companyId)) {
    return { success: false as const, message: "Invalid company", categories: [] };
  }

  const query: Record<string, unknown> = { companyId };
  if (!includeDisabled) {
    query.isEnabled = true;
  }

  const categories = await ExpenseCategory.find(query).sort({ sortOrder: 1, name: 1 }).lean();
  return { success: true as const, categories };
}

export async function createExpenseCategory(companyId: string, input: CreateExpenseCategoryInput) {
  await ConnectDb();

  if (!isValidObjectId(companyId)) {
    return { success: false as const, message: "Invalid company" };
  }

  const slug = input.slug ? toSlug(input.slug) : toSlug(input.name);
  if (!slug) {
    return { success: false as const, message: "Invalid category name" };
  }

  const existing = await ExpenseCategory.findOne({ companyId, slug }).select("_id").lean();
  if (existing) {
    return { success: false as const, message: "Category already exists" };
  }

  const created = await ExpenseCategory.create({
    companyId,
    name: input.name,
    slug,
    isDefault: false,
    isEnabled: input.isEnabled ?? true,
    sortOrder: input.sortOrder ?? 999,
  });

  return { success: true as const, category: created.toObject() };
}

export async function updateExpenseCategory(
  companyId: string,
  categoryId: string,
  input: UpdateExpenseCategoryInput
) {
  await ConnectDb();

  if (!isValidObjectId(companyId) || !isValidObjectId(categoryId)) {
    return { success: false as const, message: "Invalid category context" };
  }

  const updatePayload: Record<string, unknown> = {};

  if (typeof input.name === "string" && input.name.trim()) {
    updatePayload.name = input.name.trim();
    updatePayload.slug = toSlug(input.name);
  }

  if (typeof input.isEnabled === "boolean") {
    updatePayload.isEnabled = input.isEnabled;
  }

  if (typeof input.sortOrder === "number") {
    updatePayload.sortOrder = Math.round(input.sortOrder);
  }

  if (Object.keys(updatePayload).length === 0) {
    return { success: false as const, message: "Nothing to update" };
  }

  const updated = await ExpenseCategory.findOneAndUpdate(
    { _id: categoryId, companyId },
    updatePayload,
    { returnDocument: "after", runValidators: true }
  ).lean();

  if (!updated) {
    return { success: false as const, message: "Category not found" };
  }

  return { success: true as const, category: updated };
}
