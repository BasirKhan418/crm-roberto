import { Badge } from "@/components/ui/badge";

import type { ExpensePaymentStatus, ExpenseStatus } from "@/lib/expenses/constants";

type ExpenseStatusBadgeProps = {
  status?: ExpenseStatus;
  paymentStatus?: ExpensePaymentStatus;
  locale?: 'en' | 'fr';
};

function getStatusLabel(status?: ExpenseStatus, paymentStatus?: ExpensePaymentStatus, locale?: 'en' | 'fr') {
  const fr = locale === 'fr';
  if (status === "draft") return { text: fr ? "Brouillon" : "Draft", className: "bg-zinc-400 text-white" };
  if (status === "archived") return { text: fr ? "Archivée" : "Archived", className: "bg-slate-500 text-white" };

  if (paymentStatus === "paid") return { text: fr ? "Payée" : "Paid", className: "bg-emerald-600 text-white" };
  if (paymentStatus === "partial") return { text: fr ? "Partiel" : "Partial", className: "bg-amber-500 text-white" };
  return { text: fr ? "Impayée" : "Unpaid", className: "bg-rose-600 text-white" };
}

export function ExpenseStatusBadge({ status, paymentStatus, locale }: ExpenseStatusBadgeProps) {
  const label = getStatusLabel(status, paymentStatus, locale);
  return <Badge className={label.className}>{label.text}</Badge>;
}
