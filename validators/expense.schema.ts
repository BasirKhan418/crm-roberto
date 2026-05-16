import { z } from "zod";

import {
  EXPENSE_ATTACHMENT_DELETE_REASONS,
  EXPENSE_PAID_BY,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_STATUS,
  EXPENSE_STATUS,
  EXPENSE_TYPES,
} from "@/lib/expenses/constants";
import {
  EXPENSE_ALLOWED_MIME_TYPES,
  EXPENSE_MAX_FILE_SIZE_BYTES,
} from "@/lib/expenses/upload";

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

export const expenseAttachmentMetadataSchema = z.object({
  originalName: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  mimeType: z.enum(EXPENSE_ALLOWED_MIME_TYPES),
  extension: z.string().trim().min(1),
  sizeBytes: z
    .preprocess(toNumber, z.number().int().nonnegative().max(EXPENSE_MAX_FILE_SIZE_BYTES)),
  storageKey: z.string().trim().min(1),
  url: z.string().trim().url(),
  checksum: z.preprocess(toNullableString, z.string().trim().nullable().optional()),
});

export const createManualExpenseSchema = z
  .object({
    amountExclVatCents: moneyToCentsSchema,
    vatRate: z.preprocess(toNumber, z.number().min(0).max(100)).default(17),
    expenseDate: requiredDateSchema.default(() => new Date()),
    supplierId: objectIdSchema,
    categoryId: objectIdSchema,
    paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS).optional(),
    paidBy: z.enum(EXPENSE_PAID_BY).optional(),
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
  })
  .superRefine((input, context) => {
    const hasPositivePayment = typeof input.amountPaidCents === "number" && input.amountPaidCents > 0;
    const wantsPaidStatus =
      input.paymentStatus === "partial" || input.paymentStatus === "paid";

    if (input.paymentStatus === "unpaid" && hasPositivePayment) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Amount paid must be zero when payment status is unpaid",
        path: ["amountPaidCents"],
      });
    }

    if (input.paymentStatus === "partial" && !hasPositivePayment) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Amount paid is required when payment status is partial",
        path: ["amountPaidCents"],
      });
    }

    if ((hasPositivePayment || wantsPaidStatus) && !input.paymentMethod) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Payment method is required when an initial payment is recorded",
        path: ["paymentMethod"],
      });
    }

    if ((hasPositivePayment || wantsPaidStatus) && !input.paidAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Payment date is required when an initial payment is recorded",
        path: ["paidAt"],
      });
    }

    if ((hasPositivePayment || wantsPaidStatus) && !input.paidBy) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Paid by is required when an initial payment is recorded",
        path: ["paidBy"],
      });
    }
  });

export const createDraftExpenseSchema = z.object({
  expenseDate: optionalDateSchema.optional(),
  supplierId: optionalObjectIdSchema,
  categoryId: optionalObjectIdSchema,
  amountExclVatCents: optionalMoneyToCentsSchema,
  vatRate: z.preprocess(toNumber, z.number().min(0).max(100).optional()).default(17),
  supplierRef: z.preprocess(toNullableString, z.string().trim().max(140).nullable().optional()),
  notes: z.preprocess(toNullableString, z.string().trim().max(4000).nullable().optional()),
  attachment: expenseAttachmentMetadataSchema,
});

export const updateExpenseSchema = z
  .object({
    status: z.enum(EXPENSE_STATUS).optional(),
    amountExclVatCents: optionalMoneyToCentsSchema,
    vatRate: z.preprocess(toNumber, z.number().min(0).max(100).optional()),
    expenseDate: optionalDateSchema.optional(),
    supplierId: optionalObjectIdSchema,
    categoryId: optionalObjectIdSchema,
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
  paidBy: z.enum(EXPENSE_PAID_BY),
});

export const addExpensePaymentSchema = z.object({
  amountPaidCents: moneyToCentsSchema,
  paidAt: requiredDateSchema,
  paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS),
  paidBy: z.enum(EXPENSE_PAID_BY),
});

export const createExpenseAttachmentSchema = z.object({
  attachment: expenseAttachmentMetadataSchema,
});

export const deleteExpenseAttachmentSchema = z.object({
  attachmentId: objectIdSchema,
  reason: z.enum(EXPENSE_ATTACHMENT_DELETE_REASONS),
  reasonDetails: z.preprocess(toNullableString, z.string().trim().max(500).nullable().optional()),
}).superRefine((input, context) => {
  if (input.reason !== "other") {
    return;
  }

  const details = typeof input.reasonDetails === "string" ? input.reasonDetails.trim() : "";
  if (details.length < 10) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Reason details must contain at least 10 characters when reason is 'other'",
      path: ["reasonDetails"],
    });
  }
});

export const permanentDeleteExpenseSchema = z.object({
  password: z.string().trim().min(1, "Password confirmation is required").max(256),
  deleteReason: z.string().trim().min(10, "Deletion reason must contain at least 10 characters").max(500),
});

export const expenseActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("duplicate"),
    copyAttachments: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("archive"),
  }),
  z.object({
    action: z.literal("restore"),
  }),
  z.object({
    action: z.literal("mark_paid"),
    paidAt: requiredDateSchema,
    paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS),
    paidBy: z.enum(EXPENSE_PAID_BY),
  }),
  z.object({
    action: z.literal("add_payment"),
    amountPaidCents: moneyToCentsSchema,
    paidAt: requiredDateSchema,
    paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS),
    paidBy: z.enum(EXPENSE_PAID_BY),
  }),
  z.object({
    action: z.literal("attach_file"),
    attachment: expenseAttachmentMetadataSchema,
  }),
]);

export const expenseUploadPresignSchema = z.object({
  fileName: z.string().trim().min(1).max(260),
  fileType: z.enum(EXPENSE_ALLOWED_MIME_TYPES),
  fileSize: z
    .preprocess(toNumber, z.number().int().positive().max(EXPENSE_MAX_FILE_SIZE_BYTES)),
});

export const expenseEmailIngestSchema = z.object({
  companyId: objectIdSchema,
  createdBy: objectIdSchema.optional(),
  expenseDate: optionalDateSchema.optional(),
  supplierId: optionalObjectIdSchema,
  categoryId: optionalObjectIdSchema,
  amountExclVatCents: optionalMoneyToCentsSchema,
  vatRate: z.preprocess(toNumber, z.number().min(0).max(100).optional()),
  supplierRef: z.preprocess(toNullableString, z.string().trim().max(140).nullable().optional()),
  notes: z.preprocess(toNullableString, z.string().trim().max(4000).nullable().optional()),
  attachments: z.array(expenseAttachmentMetadataSchema).min(1),
});

export const expenseLookupQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  limit: z.preprocess(toNumber, z.number().int().positive().max(100).optional()),
});

export const createExpenseInlineSupplierSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  contactName: z.preprocess(toNullableString, z.string().trim().max(160).nullable().optional()),
  email: z.preprocess(toNullableString, z.string().trim().email().nullable().optional()),
  phone: z.preprocess(toNullableString, z.string().trim().max(80).nullable().optional()),
});

export type CreateManualExpenseDTO = z.infer<typeof createManualExpenseSchema>;
export type CreateDraftExpenseDTO = z.infer<typeof createDraftExpenseSchema>;
export type UpdateExpenseDTO = z.infer<typeof updateExpenseSchema>;
export type ExpenseListFilterDTO = z.infer<typeof expenseListFilterSchema>;
export type CreateExpenseCategoryDTO = z.infer<typeof createExpenseCategorySchema>;
export type UpdateExpenseCategoryDTO = z.infer<typeof updateExpenseCategorySchema>;
export type MarkExpensePaidDTO = z.infer<typeof markExpensePaidSchema>;
export type AddExpensePaymentDTO = z.infer<typeof addExpensePaymentSchema>;
export type ExpenseAttachmentMetadataDTO = z.infer<typeof expenseAttachmentMetadataSchema>;
export type CreateExpenseAttachmentDTO = z.infer<typeof createExpenseAttachmentSchema>;
export type DeleteExpenseAttachmentDTO = z.infer<typeof deleteExpenseAttachmentSchema>;
export type PermanentDeleteExpenseDTO = z.infer<typeof permanentDeleteExpenseSchema>;
export type ExpenseActionDTO = z.infer<typeof expenseActionSchema>;
export type ExpenseUploadPresignDTO = z.infer<typeof expenseUploadPresignSchema>;
export type ExpenseEmailIngestDTO = z.infer<typeof expenseEmailIngestSchema>;
export type ExpenseLookupQueryDTO = z.infer<typeof expenseLookupQuerySchema>;
export type CreateExpenseInlineSupplierDTO = z.infer<typeof createExpenseInlineSupplierSchema>;
