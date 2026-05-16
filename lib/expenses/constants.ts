export const EXPENSE_STATUS = ["draft", "active", "archived"] as const;
export const EXPENSE_PAYMENT_STATUS = ["paid", "unpaid", "partial"] as const;
export const EXPENSE_PAYMENT_METHODS = [
  "bank_transfer",
  "card",
  "cash",
  "direct_debit",
  "cheque",
] as const;
export const EXPENSE_PAID_BY = ["company", "private", "employee", "associate"] as const;
export const EXPENSE_TYPES = [
  "supplier_expense",
  "manual_expense_note",
  "business",
  "personal_reimbursable",
] as const;
export const EXPENSE_CANONICAL_TYPES = ["supplier_expense", "manual_expense_note"] as const;
export const DEFAULT_EXPENSE_TYPE = "supplier_expense" as const;
export const EXPENSE_ATTACHMENT_DELETE_REASONS = [
  "wrong_document",
  "unreadable_document",
  "duplicate_document",
  "wrong_supplier",
  "test_document",
  "other",
] as const;

export const DEFAULT_EXPENSE_CATEGORY_NAMES = [
  "Fuel",
  "Equipment & supplies",
  "Subcontracting",
  "Servers & hosting",
  "Telecom",
  "Advertising",
  "Software & SaaS",
  "Meals & entertainment",
  "Travel",
  "Rent & utilities",
  "Insurance",
  "Salaries & social charges",
  "Miscellaneous",
] as const;

export const EXPENSE_VAT_RATES = [0, 3, 8, 14, 17] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUS)[number];
export type ExpensePaymentStatus = (typeof EXPENSE_PAYMENT_STATUS)[number];
export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];
export type ExpensePaidBy = (typeof EXPENSE_PAID_BY)[number];
export type ExpenseType = (typeof EXPENSE_TYPES)[number];
export type ExpenseAttachmentDeleteReason = (typeof EXPENSE_ATTACHMENT_DELETE_REASONS)[number];

const LEGACY_EXPENSE_TYPE_TO_CANONICAL: Record<string, (typeof EXPENSE_CANONICAL_TYPES)[number]> = {
  business: "supplier_expense",
  personal_reimbursable: "manual_expense_note",
};

export function normalizeExpenseType(value: unknown): (typeof EXPENSE_CANONICAL_TYPES)[number] {
  if (typeof value !== "string") {
    return DEFAULT_EXPENSE_TYPE;
  }

  if (value === "supplier_expense" || value === "manual_expense_note") {
    return value;
  }

  return LEGACY_EXPENSE_TYPE_TO_CANONICAL[value] || DEFAULT_EXPENSE_TYPE;
}
