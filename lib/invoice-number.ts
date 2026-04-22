import Invoice from '@/db/models/Invoice';
import { nextInvoiceNumber } from '@/lib/price';

function getInvoiceNumberPrefixes(year: number): string[] {
  return [`FAC-${year}-`, `INV-${year}-`];
}

function getInvoiceNumberSequence(invoiceNumber: string | null | undefined, year: number): number {
  if (!invoiceNumber) {
    return -1;
  }

  const prefixes = getInvoiceNumberPrefixes(year);
  if (!prefixes.some((prefix) => invoiceNumber.startsWith(prefix))) {
    return -1;
  }

  const sequence = Number.parseInt(invoiceNumber.split('-')[2] ?? '', 10);
  return Number.isFinite(sequence) ? sequence : -1;
}

function getLatestInvoiceNumberForYear(invoiceNumbers: Array<string | null | undefined>, year: number): string | null {
  let latestInvoiceNumber: string | null = null;
  let highestSequence = -1;

  for (const invoiceNumber of invoiceNumbers) {
    const sequence = getInvoiceNumberSequence(invoiceNumber, year);
    if (sequence > highestSequence) {
      highestSequence = sequence;
      latestInvoiceNumber = invoiceNumber ?? null;
    }
  }

  return latestInvoiceNumber;
}

export async function getNextInvoiceNumberForYear(userId: string, year: number): Promise<string> {
  const yearPrefixPattern = `^(INV|FAC)-${year}-`;
  const invoices = await Invoice.find({
    userId,
    invoiceNumber: { $regex: yearPrefixPattern },
  })
    .select('invoiceNumber')
    .lean<Array<{ invoiceNumber?: string | null }>>();

  const latestInvoiceNumber = getLatestInvoiceNumberForYear(
    invoices.map((invoice) => invoice.invoiceNumber ?? null),
    year
  );

  return nextInvoiceNumber(latestInvoiceNumber, year);
}

type DuplicateKeyErrorLike = {
  code?: unknown;
  keyPattern?: Record<string, unknown> | null;
  keyValue?: Record<string, unknown> | null;
  message?: unknown;
};

export function isInvoiceNumberDuplicateError(error: unknown): boolean {
  const duplicateError = error as DuplicateKeyErrorLike;
  const message = typeof duplicateError?.message === 'string' ? duplicateError.message : '';

  if (duplicateError?.code === 11000) {
    return Boolean(
      (duplicateError.keyPattern && 'invoiceNumber' in duplicateError.keyPattern) ||
        (duplicateError.keyValue && 'invoiceNumber' in duplicateError.keyValue) ||
        message.includes('invoiceNumber') ||
        message.includes('unique_user_invoice_number')
    );
  }

  return message.includes('E11000') && message.includes('invoiceNumber');
}