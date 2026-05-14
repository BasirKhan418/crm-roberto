import { PriceDisplay } from "@/components/ui/PriceDisplay";

type ExpenseMoneyDisplayProps = {
  cents: number;
  locale?: string;
  className?: string;
};

export function ExpenseMoneyDisplay({ cents, locale = "fr-FR", className }: ExpenseMoneyDisplayProps) {
  return <PriceDisplay cents={cents} locale={locale} className={className} />;
}
