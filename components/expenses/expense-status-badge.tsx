import { Badge } from "@/components/ui/badge";

import type { ExpenseStatus } from "@/lib/expenses/constants";
import { getExpenseStatusLabel } from "@/lib/expenses/labels";

type ExpenseStatusBadgeProps = {
  status?: ExpenseStatus;
  locale?: 'en' | 'fr';
};

function getStatusLabel(status?: ExpenseStatus, locale?: 'en' | 'fr') {
  const activeLocale = locale ?? 'en';

  if (status === "draft") {
    return {
      text: getExpenseStatusLabel("draft", activeLocale),
      className: "bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-950/45 dark:text-amber-200 dark:ring-amber-800",
    };
  }

  if (status === "archived") {
    return {
      text: getExpenseStatusLabel("archived", activeLocale),
      className: "bg-slate-100 text-slate-700 ring-1 ring-slate-300 dark:bg-slate-900/60 dark:text-slate-200 dark:ring-slate-700",
    };
  }

  return {
    text: getExpenseStatusLabel("active", activeLocale),
    className: "bg-sky-100 text-sky-800 ring-1 ring-sky-300 dark:bg-sky-950/45 dark:text-sky-200 dark:ring-sky-800",
  };
}

export function ExpenseStatusBadge({ status, locale }: ExpenseStatusBadgeProps) {
  const label = getStatusLabel(status, locale);
  return <Badge className={label.className}>{label.text}</Badge>;
}
