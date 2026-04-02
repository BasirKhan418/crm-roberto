import { cn } from "@/lib/utils"

export type QuoteStatus = "draft" | "sent" | "accepted" | "refused" | "rejected"

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
  rejected: {
    backgroundColor: "#fff7ed",
    color: "#c2410c",
    label: "Rejected",
  },
}

type StatusBadgeProps = {
  status: QuoteStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status]

  if (status === "accepted") {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-[10px] px-2.25 py-0.75 text-[11px] font-semibold ring-1 ring-inset", className)}
        style={{ backgroundColor: style.backgroundColor, color: style.color, boxShadow: `inset 0 0 0 1px ${style.color}` }}>
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: style.color }} />
          <span className="relative inline-flex size-1.5 rounded-full" style={{ backgroundColor: style.color }} />
        </span>
        {style.label}
      </span>
    )
  }

  return (
    <span
      className={cn("inline-block rounded-[10px] px-2.25 py-0.75 text-[11px] font-medium", className)}
      style={{ backgroundColor: style.backgroundColor, color: style.color }}
    >
      {style.label}
    </span>
  )
}
