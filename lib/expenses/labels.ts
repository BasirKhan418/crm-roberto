import type {
  ExpensePaymentMethod,
  ExpensePaymentStatus,
  ExpenseStatus,
  ExpenseType,
} from '@/lib/expenses/constants';

export type ExpenseLabelLocale = 'en' | 'fr';

type ExpenseEnumValue = ExpenseStatus | ExpensePaymentStatus | ExpensePaymentMethod | ExpenseType;

const EN_LABELS: Record<ExpenseEnumValue, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
  paid: 'Paid',
  unpaid: 'Unpaid',
  partial: 'Partial',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  cash: 'Cash',
  direct_debit: 'Direct debit',
  cheque: 'Cheque',
  business: 'Business',
  personal_reimbursable: 'Personal reimbursable',
};

const FR_LABELS: Record<ExpenseEnumValue, string> = {
  draft: 'Brouillon',
  active: 'Active',
  archived: 'Archivée',
  paid: 'Payée',
  unpaid: 'Impayée',
  partial: 'Partiel',
  bank_transfer: 'Virement bancaire',
  card: 'Carte',
  cash: 'Espèces',
  direct_debit: 'Prélèvement',
  cheque: 'Chèque',
  business: 'Professionnelle',
  personal_reimbursable: 'Personnel remboursable',
};

function resolveLabelMap(locale: ExpenseLabelLocale) {
  return locale === 'fr' ? FR_LABELS : EN_LABELS;
}

function resolveEnumLabel(value: string | null | undefined, locale: ExpenseLabelLocale) {
  if (!value) {
    return '';
  }

  const labels = resolveLabelMap(locale);
  return labels[value as ExpenseEnumValue] ?? value;
}

export function getExpenseStatusLabel(
  status: ExpenseStatus | string | null | undefined,
  locale: ExpenseLabelLocale
) {
  return resolveEnumLabel(status, locale);
}

export function getExpensePaymentStatusLabel(
  paymentStatus: ExpensePaymentStatus | string | null | undefined,
  locale: ExpenseLabelLocale
) {
  return resolveEnumLabel(paymentStatus, locale);
}

export function getExpensePaymentMethodLabel(
  paymentMethod: ExpensePaymentMethod | string | null | undefined,
  locale: ExpenseLabelLocale
) {
  return resolveEnumLabel(paymentMethod, locale);
}

export function getExpenseTypeLabel(
  expenseType: ExpenseType | string | null | undefined,
  locale: ExpenseLabelLocale
) {
  return resolveEnumLabel(expenseType, locale);
}

export function getExpenseEnumLabel(value: string, locale: ExpenseLabelLocale) {
  return resolveEnumLabel(value, locale);
}
