import mongoose from "mongoose";

import ConnectDb from "@/db/connectDb";
import Expense from "@/db/models/Expense";
import ExpenseCategory from "@/db/models/ExpenseCategory";
import {
  DEFAULT_EXPENSE_CATEGORY_DEFINITIONS,
  resolveExpenseCategoryCanonicalKey,
  toExpenseCategorySlug,
} from "@/lib/expenses/category-i18n";

type CreateExpenseCategoryInput = {
  name?: string;
  nameEn?: string;
  nameFr?: string;
  slug?: string;
  isEnabled?: boolean;
  sortOrder?: number;
};

type UpdateExpenseCategoryInput = {
  name?: string;
  nameEn?: string;
  nameFr?: string;
  isEnabled?: boolean;
  sortOrder?: number;
};

function isValidObjectId(value: string) {
  return mongoose.Types.ObjectId.isValid(value);
}

function normalizeNonEmptyString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function buildNormalizedCategoryNames(input: {
  name?: unknown;
  nameEn?: unknown;
  nameFr?: unknown;
}) {
  const name = normalizeNonEmptyString(input.name);
  const explicitNameEn = normalizeNonEmptyString(input.nameEn);
  const nameFr = normalizeNonEmptyString(input.nameFr);
  const nameEn = explicitNameEn || (name && !nameFr ? name : "");
  const displayName = nameEn || nameFr || name;

  return {
    name: displayName,
    nameEn: nameEn || "",
    nameFr: nameFr || "",
  };
}

type ExistingCategoryShape = {
  _id: mongoose.Types.ObjectId;
  slug?: string;
  canonicalKey?: string;
  name?: string;
  nameEn?: string;
  nameFr?: string;
};

function resolveCategoryCanonicalFromRecord(category: ExistingCategoryShape) {
  return (
    normalizeNonEmptyString(category.canonicalKey) ||
    resolveExpenseCategoryCanonicalKey({
      slug: category.slug,
      name: category.name,
      nameEn: category.nameEn,
      nameFr: category.nameFr,
    })
  );
}

async function findCategoryConflictByCanonicalKey(params: {
  companyId: string;
  canonicalKey: string;
  excludeCategoryId?: string;
}) {
  if (!params.canonicalKey) return null;

  const categories = await ExpenseCategory.find({
    companyId: params.companyId,
    ...(params.excludeCategoryId ? { _id: { $ne: params.excludeCategoryId } } : {}),
  })
    .select("_id canonicalKey slug name nameEn nameFr")
    .lean<ExistingCategoryShape[]>();

  return (
    categories.find(
      (category) => resolveCategoryCanonicalFromRecord(category) === params.canonicalKey
    ) || null
  );
}

export async function ensureDefaultExpenseCategories(companyId: string) {
  await ConnectDb();

  if (!isValidObjectId(companyId)) {
    return { success: false as const, message: "Invalid company" };
  }

  for (const [index, categoryDefinition] of DEFAULT_EXPENSE_CATEGORY_DEFINITIONS.entries()) {
    const canonicalKey = categoryDefinition.key;
    const slug = toExpenseCategorySlug(canonicalKey) || toExpenseCategorySlug(categoryDefinition.nameEn);

    await ExpenseCategory.updateOne(
      {
        companyId,
        $or: [{ canonicalKey }, { slug }],
      },
      {
        $setOnInsert: {
          companyId,
          name: categoryDefinition.nameEn,
          slug,
          isDefault: true,
          isEnabled: true,
          sortOrder: index,
        },
        $set: {
          canonicalKey,
          nameEn: categoryDefinition.nameEn,
          nameFr: categoryDefinition.nameFr,
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

  const names = buildNormalizedCategoryNames(input);
  if (!names.name) {
    return { success: false as const, message: "Invalid category name" };
  }

  const canonicalKey = resolveExpenseCategoryCanonicalKey({
    key: input.slug,
    slug: input.slug,
    name: names.name,
    nameEn: names.nameEn,
    nameFr: names.nameFr,
  });

  if (!canonicalKey) {
    return { success: false as const, message: "Invalid category name" };
  }

  const conflict = await findCategoryConflictByCanonicalKey({
    companyId,
    canonicalKey,
  });

  if (conflict) {
    return { success: false as const, message: "Category already exists" };
  }

  const slug = toExpenseCategorySlug(input.slug || names.nameEn || names.nameFr || names.name) || canonicalKey;

  const created = await ExpenseCategory.create({
    companyId,
    name: names.name,
    nameEn: names.nameEn || undefined,
    nameFr: names.nameFr || undefined,
    slug,
    canonicalKey,
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

  const current = await ExpenseCategory.findOne({ _id: categoryId, companyId })
    .select("_id name nameEn nameFr slug canonicalKey")
    .lean<ExistingCategoryShape | null>();

  if (!current) {
    return { success: false as const, message: "Category not found" };
  }

  const updatePayload: Record<string, unknown> = {};

  const nameInput = normalizeNonEmptyString(input.name);
  const nameEnInput = normalizeNonEmptyString(input.nameEn);
  const nameFrInput = normalizeNonEmptyString(input.nameFr);

  const hasNamePatch = Boolean(nameInput || nameEnInput || nameFrInput);

  if (hasNamePatch) {
    const nextNameEn = nameEnInput || (nameInput ? nameInput : normalizeNonEmptyString(current.nameEn) || normalizeNonEmptyString(current.name));
    const nextNameFr = nameFrInput || normalizeNonEmptyString(current.nameFr);
    const nextName = nextNameEn || nextNameFr;

    const nextCanonicalKey = resolveExpenseCategoryCanonicalKey({
      key: normalizeNonEmptyString(current.canonicalKey),
      slug: normalizeNonEmptyString(current.slug),
      name: nextName,
      nameEn: nextNameEn,
      nameFr: nextNameFr,
    });

    const nextSlug = toExpenseCategorySlug(nextNameEn || nextNameFr || nextName) || nextCanonicalKey;

    if (!nextSlug || !nextCanonicalKey || !nextName) {
      return { success: false as const, message: "Invalid category name" };
    }

    const conflict = await findCategoryConflictByCanonicalKey({
      companyId,
      canonicalKey: nextCanonicalKey,
      excludeCategoryId: categoryId,
    });

    if (conflict) {
      return { success: false as const, message: "Category already exists" };
    }

    updatePayload.name = nextName;
    updatePayload.nameEn = nextNameEn || undefined;
    updatePayload.nameFr = nextNameFr || undefined;
    updatePayload.slug = nextSlug;
    updatePayload.canonicalKey = nextCanonicalKey;
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

export async function deleteExpenseCategory(companyId: string, categoryId: string) {
  await ConnectDb();

  if (!isValidObjectId(companyId) || !isValidObjectId(categoryId)) {
    return { success: false as const, message: "Invalid category context" };
  }

  const category = await ExpenseCategory.findOne({ _id: categoryId, companyId })
    .select("_id isDefault")
    .lean<{ _id: mongoose.Types.ObjectId; isDefault?: boolean } | null>();

  if (!category) {
    return { success: false as const, message: "Category not found" };
  }

  if (category.isDefault) {
    return { success: false as const, message: "Default categories cannot be deleted" };
  }

  const usageCount = await Expense.countDocuments({ companyId, categoryId });
  if (usageCount > 0) {
    return {
      success: false as const,
      message: "Category is already used by expenses and cannot be deleted",
    };
  }

  await ExpenseCategory.deleteOne({ _id: categoryId, companyId });
  return { success: true as const };
}
