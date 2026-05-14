export const EXPENSE_STATUS = ["draft", "active", "archived"] as const;
export const EXPENSE_PAYMENT_STATUS = ["paid", "unpaid", "partial"] as const;
export const EXPENSE_PAYMENT_METHODS = [
  "bank_transfer",
  "card",
  "cash",
  "direct_debit",
  "cheque",
] as const;
export const EXPENSE_TYPES = ["business", "personal_reimbursable"] as const;

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

export const EXPENSE_VAT_RATES = [0, 5.5, 10, 20] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUS)[number];
export type ExpensePaymentStatus = (typeof EXPENSE_PAYMENT_STATUS)[number];
export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];
export type ExpenseType = (typeof EXPENSE_TYPES)[number];
