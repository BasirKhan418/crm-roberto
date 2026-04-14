import { cn } from "@/lib/utils"

interface PriceDisplayProps {
  cents: number
  currency?: string
  locale?: string
  className?: string
}

export function PriceDisplay({
  cents,
  currency = "EUR",
  locale = "fr-FR",
  className,
}: PriceDisplayProps) {
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100)

  return <span className={cn(className)}>{formatted}</span>
}
