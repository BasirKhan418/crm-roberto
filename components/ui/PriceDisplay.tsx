import { cn } from "@/lib/utils"

interface PriceDisplayProps {
  cents: number
  currency?: string
  locale?: string
  className?: string
  compactAfterDigits?: number
  compactMaximumFractionDigits?: number
}

export function PriceDisplay({
  cents,
  currency = "EUR",
  locale = "fr-FR",
  className,
  compactAfterDigits,
  compactMaximumFractionDigits = 1,
}: PriceDisplayProps) {
  const normalizedCents = Math.abs(Math.round(cents))
  const digitCount = normalizedCents === 0 ? 1 : normalizedCents.toString().length
  const shouldUseCompact = compactAfterDigits !== undefined && digitCount > compactAfterDigits

  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    ...(shouldUseCompact
      ? {
          notation: "compact",
          minimumFractionDigits: 0,
          maximumFractionDigits: compactMaximumFractionDigits,
        }
      : {
          minimumFractionDigits: 2,
        }),
  }).format(cents / 100)

  return <span className={cn(className)}>{formatted}</span>
}
