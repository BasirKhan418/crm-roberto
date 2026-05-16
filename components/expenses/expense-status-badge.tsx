import { Badge } from "@/components/ui/badge";

import type { ExpensePaymentStatus, ExpenseStatus } from "@/lib/expenses/constants";
import {
  getExpensePaymentStatusLabel,
  getExpenseStatusLabel,
} from "@/lib/expenses/labels";

type ExpenseStatusBadgeProps = {
  status?: ExpenseStatus;
  paymentStatus?: ExpensePaymentStatus;
  locale?: 'en' | 'fr';
};

function getStatusLabel(status?: ExpenseStatus, paymentStatus?: ExpensePaymentStatus, locale?: 'en' | 'fr') {
  const activeLocale = locale ?? 'en';
  if (status === "draft") {
    return {
      text: getExpenseStatusLabel("draft", activeLocale),
      className: "bg-zinc-400 text-white",
    };
  }

  if (status === "archived") {
    return {
      text: getExpenseStatusLabel("archived", activeLocale),
      className: "bg-slate-500 text-white",
    };
  }

  if (paymentStatus === "paid") {
    return {
      text: getExpensePaymentStatusLabel("paid", activeLocale),
      className: "bg-emerald-600 text-white",
    };
  }

  if (paymentStatus === "partial") {
    return {
      text: getExpensePaymentStatusLabel("partial", activeLocale),
      className: "bg-amber-500 text-white",
    };
  }

  return {
    text: getExpensePaymentStatusLabel("unpaid", activeLocale),
    className: "bg-rose-600 text-white",
  };
}

export function ExpenseStatusBadge({ status, paymentStatus, locale }: ExpenseStatusBadgeProps) {
  const label = getStatusLabel(status, paymentStatus, locale);
  return <Badge className={label.className}>{label.text}</Badge>;
}
