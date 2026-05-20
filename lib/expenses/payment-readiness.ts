export type ExpensePaymentReadinessInput = {
  status?: string | null;
  amountInclVatCents?: number | null;
  expenseDate?: string | Date | null;
  categoryId?: unknown;
};

export function hasExpenseRequiredPaymentFields(expense: ExpensePaymentReadinessInput) {
  return Boolean(
    Math.max(0, Math.round(expense.amountInclVatCents || 0)) > 0 &&
      expense.expenseDate &&
      expense.categoryId
  );
}

export function isExpenseReadyForPayment(expense: ExpensePaymentReadinessInput) {
  return expense.status !== 'draft' && expense.status !== 'archived' && hasExpenseRequiredPaymentFields(expense);
}
