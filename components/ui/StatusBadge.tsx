import { cn } from "@/lib/utils"

export type QuoteStatus = "draft" | "sent" | "accepted" | "refused" | "rejected"

const STATUS_STYLES: Record<
  QuoteStatus,
  { backgroundColor: string; color: string; label: string }
> = {
  draft: {
    backgroundColor: "rgba(100, 116, 139, 0.11)",
    color: "#475569",
    label: "Draft",
  },
  sent: {
    backgroundColor: "rgba(14, 165, 233, 0.11)",
    color: "#0369a1",
    label: "Sent",
  },
  accepted: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    color: "#15803d",
    label: "Accepted",
  },
  refused: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    color: "#b91c1c",
    label: "Refused",
  },
  rejected: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    color: "#b91c1c",
    label: "Rejected",
  },
}

type StatusBadgeProps = {
  status: QuoteStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status]

  return (
    <span
      className={cn("inline-block rounded-[10px] px-2.25 py-0.75 text-[11px] font-semibold", className)}
      style={{ backgroundColor: style.backgroundColor, color: style.color }}
    >
      {style.label}
    </span>
  )
}
