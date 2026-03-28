import { cn } from "@/lib/utils"

export type QuoteStatus = "draft" | "sent" | "accepted" | "refused"

const STATUS_STYLES: Record<
  QuoteStatus,
  { backgroundColor: string; color: string; label: string }
> = {
  draft: {
    backgroundColor: "var(--color-background-secondary)",
    color: "var(--color-text-secondary)",
    label: "Draft",
  },
  sent: {
    backgroundColor: "var(--color-background-info)",
    color: "var(--color-text-info)",
    label: "Sent",
  },
  accepted: {
    backgroundColor: "var(--color-background-success)",
    color: "var(--color-text-success)",
    label: "Accepted",
  },
  refused: {
    backgroundColor: "var(--color-background-danger)",
    color: "var(--color-text-danger)",
    label: "Refused",
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
      className={cn("inline-block rounded-[10px] px-2.25 py-0.75 text-[11px] font-medium", className)}
      style={{ backgroundColor: style.backgroundColor, color: style.color }}
    >
      {style.label}
    </span>
  )
}
