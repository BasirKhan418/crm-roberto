type ExpenseVatRateLabelProps = {
  rate: number;
};

export function ExpenseVatRateLabel({ rate }: ExpenseVatRateLabelProps) {
  const normalized = Number.isFinite(rate) ? rate : 0;
  return <span>{normalized}% VAT</span>;
}
