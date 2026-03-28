
export function eurosToCents(euros: string | number): number {
  return Math.round(parseFloat(String(euros)) * 100);
}


export function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2);
}


export function calcLineItem(unitPriceCents: number, quantity: number, vatRate: number) {
  const totalExclTax = unitPriceCents * quantity;
  const vatAmount = Math.round(totalExclTax * (vatRate / 100));
  const totalInclTax = totalExclTax + vatAmount;

  return { totalExclTax, vatAmount, totalInclTax };
}


export function calcQuoteTotals(
  lineItems: Array<{ unitPriceExcludingTax: number; quantity: number; vatRate: number }>
) {
  let totalExcludingTax = 0;
  let totalVat = 0;

  for (const item of lineItems) {
    const { totalExclTax, vatAmount } = calcLineItem(
      item.unitPriceExcludingTax,
      item.quantity,
      item.vatRate
    );
    totalExcludingTax += totalExclTax;
    totalVat += vatAmount;
  }

  return {
    totalExcludingTax,
    totalVat,
    totalIncludingTax: totalExcludingTax + totalVat,
  };
}


export function nextQuoteNumber(lastNumber: string | null): string {
  if (!lastNumber) {
    return "DEV-001";
  }

  const num = parseInt(lastNumber.split("-")[1], 10);
  return `DEV-${String(num + 1).padStart(3, "0")}`;
}
