import { Badge } from "@/components/ui/badge";

import type { ExpensePaymentStatus, ExpenseStatus } from "@/lib/expenses/constants";

type ExpenseStatusBadgeProps = {
  status?: ExpenseStatus;
  paymentStatus?: ExpensePaymentStatus;
};

function getStatusLabel(status?: ExpenseStatus, paymentStatus?: ExpensePaymentStatus) {
  if (status === "draft") return { text: "Draft", className: "bg-zinc-400 text-white" };
  if (status === "archived") return { text: "Archived", className: "bg-slate-500 text-white" };

  if (paymentStatus === "paid") return { text: "Paid", className: "bg-emerald-600 text-white" };
  if (paymentStatus === "partial") return { text: "Partial", className: "bg-amber-500 text-white" };
  return { text: "Unpaid", className: "bg-rose-600 text-white" };
}

export function ExpenseStatusBadge({ status, paymentStatus }: ExpenseStatusBadgeProps) {
  const label = getStatusLabel(status, paymentStatus);
  return <Badge className={label.className}>{label.text}</Badge>;
}
