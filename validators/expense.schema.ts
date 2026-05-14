import { z } from "zod";

import {
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_STATUS,
  EXPENSE_STATUS,
  EXPENSE_TYPES,
} from "@/lib/expenses/constants";

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return value;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
};

const toNullableString = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const moneyToCentsSchema = z
  .preprocess(toNumber, z.number().finite().min(0, "Amount cannot be negative"))
  .transform((value) => Math.round(value * 100));

const optionalMoneyToCentsSchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") return undefined;
    return toNumber(value);
  },
  z.number().finite().min(0, "Amount cannot be negative").optional()
).transform((value) => (typeof value === "number" ? Math.round(value * 100) : undefined));

const optionalDateSchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") return null;
    return value;
  },
  z.coerce.date().nullable()
);

const requiredDateSchema = z.coerce.date();

const objectIdSchema = z.string().trim().min(1, "Invalid ID");
const optionalObjectIdSchema = z.preprocess(toNullableString, z.string().trim().min(1).nullable().optional());

export const createManualExpenseSchema = z.object({
  amountExclVatCents: moneyToCentsSchema,
  vatRate: z.preprocess(toNumber, z.number().min(0).max(100)).default(0),
  expenseDate: requiredDateSchema,
  supplierId: objectIdSchema,
  categoryId: objectIdSchema,
  paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS).optional(),
  paymentStatus: z.enum(EXPENSE_PAYMENT_STATUS).optional(),
  amountPaidCents: optionalMoneyToCentsSchema,
  paidAt: optionalDateSchema.optional(),
  dueDate: optionalDateSchema.optional(),
  supplierRef: z.preprocess(toNullableString, z.string().trim().max(140).nullable().optional()),
  expenseType: z.enum(EXPENSE_TYPES).default("business"),
  notes: z.preprocess(toNullableString, z.string().trim().max(4000).nullable().optional()),
  clientId: optionalObjectIdSchema,
  projectId: z.preprocess(toNullableString, z.string().trim().max(120).nullable().optional()),
  invoiceId: optionalObjectIdSchema,
});

export const createDraftExpenseSchema = z.object({
  expenseDate: optionalDateSchema.optional(),
  supplierId: optionalObjectIdSchema,
  categoryId: optionalObjectIdSchema,
  amountExclVatCents: optionalMoneyToCentsSchema,
  vatRate: z.preprocess(toNumber, z.number().min(0).max(100).optional()),
  supplierRef: z.preprocess(toNullableString, z.string().trim().max(140).nullable().optional()),
  notes: z.preprocess(toNullableString, z.string().trim().max(4000).nullable().optional()),
  attachment: z.object({
    originalName: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    mimeType: z.string().trim().min(1),
    extension: z.string().trim().min(1),
    sizeBytes: z.preprocess(toNumber, z.number().int().nonnegative()),
    storageKey: z.string().trim().min(1),
    url: z.string().trim().url(),
    checksum: z.preprocess(toNullableString, z.string().trim().nullable().optional()),
  }),
});

export const updateExpenseSchema = z
  .object({
    status: z.enum(EXPENSE_STATUS).optional(),
    paymentStatus: z.enum(EXPENSE_PAYMENT_STATUS).optional(),
    amountExclVatCents: optionalMoneyToCentsSchema,
    vatRate: z.preprocess(toNumber, z.number().min(0).max(100).optional()),
    expenseDate: optionalDateSchema.optional(),
    supplierId: optionalObjectIdSchema,
    categoryId: optionalObjectIdSchema,
    paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS).nullable().optional(),
    amountPaidCents: optionalMoneyToCentsSchema,
    paidAt: optionalDateSchema.optional(),
    dueDate: optionalDateSchema.optional(),
    supplierRef: z.preprocess(toNullableString, z.string().trim().max(140).nullable().optional()),
    expenseType: z.enum(EXPENSE_TYPES).optional(),
    notes: z.preprocess(toNullableString, z.string().trim().max(4000).nullable().optional()),
    clientId: optionalObjectIdSchema,
    projectId: z.preprocess(toNullableString, z.string().trim().max(120).nullable().optional()),
    invoiceId: optionalObjectIdSchema,
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field must be provided",
  });

export const expenseListFilterSchema = z.object({
  status: z.enum(EXPENSE_STATUS).optional(),
  paymentStatus: z.enum(EXPENSE_PAYMENT_STATUS).optional(),
  categoryId: z.string().trim().optional(),
  supplierId: z.string().trim().optional(),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  search: z.string().trim().max(120).optional(),
  sortBy: z.enum(["expenseDate", "amountInclVatCents", "supplierRef", "status", "createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.preprocess(toNumber, z.number().int().positive().optional()),
  limit: z.preprocess(toNumber, z.number().int().positive().max(100).optional()),
});

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  isEnabled: z.boolean().optional(),
  sortOrder: z.preprocess(toNumber, z.number().int().optional()),
});

export const updateExpenseCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    isEnabled: z.boolean().optional(),
    sortOrder: z.preprocess(toNumber, z.number().int().optional()),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field must be provided",
  });

export const markExpensePaidSchema = z.object({
  paidAt: requiredDateSchema,
  paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS),
});

export type CreateManualExpenseDTO = z.infer<typeof createManualExpenseSchema>;
export type CreateDraftExpenseDTO = z.infer<typeof createDraftExpenseSchema>;
export type UpdateExpenseDTO = z.infer<typeof updateExpenseSchema>;
export type ExpenseListFilterDTO = z.infer<typeof expenseListFilterSchema>;
export type CreateExpenseCategoryDTO = z.infer<typeof createExpenseCategorySchema>;
export type UpdateExpenseCategoryDTO = z.infer<typeof updateExpenseCategorySchema>;
export type MarkExpensePaidDTO = z.infer<typeof markExpensePaidSchema>;
