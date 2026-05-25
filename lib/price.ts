
export function eurosToCents(euros: string | number): number {
  return Math.round(parseFloat(String(euros)) * 100);
}


export function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2);
}


export function formatCurrencyFromCents(
  cents: number,
  locale: string = 'fr-FR',
  currency: string = 'EUR',
  options?: Intl.NumberFormatOptions
) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format((Number.isFinite(cents) ? cents : 0) / 100);
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
  const year = new Date().getFullYear();
  const prefix = `DEV-${year}-`;

  if (!lastNumber || !lastNumber.startsWith(prefix)) {
    // No quote this year yet — start at 001
    return `${prefix}001`;
  }

  const counter = parseInt(lastNumber.slice(prefix.length), 10);
  return `${prefix}${String((Number.isFinite(counter) ? counter : 0) + 1).padStart(3, '0')}`;
}

export function nextInvoiceNumber(lastNumber: string | null, year?: number): string {
  const y = year ?? new Date().getFullYear();
  const prefix = `FAC-${y}-`;
  const legacyPrefixes = [`FAC-${y}-`, `INV-${y}-`];

  if (!lastNumber || !legacyPrefixes.some((candidate) => lastNumber.startsWith(candidate))) {
    return `${prefix}001`;
  }

  const num = parseInt(lastNumber.split('-')[2], 10);
  return `${prefix}${String((Number.isFinite(num) ? num : 0) + 1).padStart(3, '0')}`;
}
