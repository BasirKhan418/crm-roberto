"use client"

import { useLocale } from "@/components/providers/locale-provider"
import { getQuoteStatusLabel } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"

export type QuoteStatus = "draft" | "sent" | "accepted" | "refused" | "rejected"

const STATUS_STYLES: Record<QuoteStatus, { backgroundColor: string; color: string }> = {
  draft: {
    backgroundColor: "rgba(100, 116, 139, 0.11)",
    color: "#475569",
  },
  sent: {
    backgroundColor: "rgba(14, 165, 233, 0.11)",
    color: "#0369a1",
  },
  accepted: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    color: "#15803d",
  },
  refused: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    color: "#b91c1c",
  },
  rejected: {
    backgroundColor: "#fff7ed",
    color: "#c2410c",
  },
}

type StatusBadgeProps = {
  status: QuoteStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { locale } = useLocale()
  const style = STATUS_STYLES[status]
  const label = getQuoteStatusLabel(locale, status)

  if (status === "accepted") {
    return (
      <span
        className={cn("inline-flex items-center gap-1 rounded-[10px] px-2.25 py-0.75 text-[11px] font-semibold ring-1 ring-inset", className)}
        style={{ backgroundColor: style.backgroundColor, color: style.color, boxShadow: `inset 0 0 0 1px ${style.color}` }}
      >
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: style.color }} />
          <span className="relative inline-flex size-1.5 rounded-full" style={{ backgroundColor: style.color }} />
        </span>
        {label}
      </span>
    )
  }

  return (
    <span
      className={cn("inline-block rounded-[10px] px-2.25 py-0.75 text-[11px] font-semibold", className)}
      style={{ backgroundColor: style.backgroundColor, color: style.color }}
    >
      {label}
    </span>
  )
}
