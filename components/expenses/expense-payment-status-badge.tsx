import { Badge } from "@/components/ui/badge";

import type { ExpensePaymentStatus, ExpenseStatus } from "@/lib/expenses/constants";
import { getExpensePaymentStatusLabel } from "@/lib/expenses/labels";

type ExpensePaymentStatusBadgeProps = {
  paymentStatus?: ExpensePaymentStatus;
  lifecycleStatus?: ExpenseStatus;
  locale?: 'en' | 'fr';
};

function getPaymentLabel(
  paymentStatus: ExpensePaymentStatus | undefined,
  lifecycleStatus: ExpenseStatus | undefined,
  locale: 'en' | 'fr'
) {
  const status: ExpensePaymentStatus = paymentStatus ?? 'unpaid';

  if (lifecycleStatus === 'draft' || lifecycleStatus === 'archived') {
    return {
      text: getExpensePaymentStatusLabel(status, locale),
      className:
        'bg-muted text-muted-foreground ring-1 ring-border dark:bg-muted/70 dark:text-muted-foreground',
    };
  }

  if (status === 'paid') {
    return {
      text: getExpensePaymentStatusLabel('paid', locale),
      className:
        'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300 dark:bg-emerald-950/45 dark:text-emerald-200 dark:ring-emerald-800',
    };
  }

  if (status === 'partial') {
    return {
      text: getExpensePaymentStatusLabel('partial', locale),
      className:
        'bg-orange-100 text-orange-800 ring-1 ring-orange-300 dark:bg-orange-950/45 dark:text-orange-200 dark:ring-orange-800',
    };
  }

  return {
    text: getExpensePaymentStatusLabel('unpaid', locale),
    className:
      'bg-rose-100 text-rose-800 ring-1 ring-rose-300 dark:bg-rose-950/45 dark:text-rose-200 dark:ring-rose-800',
  };
}

export function ExpensePaymentStatusBadge({
  paymentStatus,
  lifecycleStatus,
  locale = 'en',
}: ExpensePaymentStatusBadgeProps) {
  const label = getPaymentLabel(paymentStatus, lifecycleStatus, locale);
  return <Badge className={label.className}>{label.text}</Badge>;
}
