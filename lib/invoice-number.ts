import type mongoose from 'mongoose';

import Invoice from '@/db/models/Invoice';

type IdLike = string | mongoose.Types.ObjectId;

/**
 * Invoice numbers are sequential per company (legal requirement), so allocation looks at
 * invoices created by every member of the company. Pass the company's user IDs.
 */
export type InvoiceNumberScope = IdLike | IdLike[];

function invoiceNumberScopeFilter(scope: InvoiceNumberScope) {
  return Array.isArray(scope) ? { $in: scope } : scope;
}

const INVOICE_PREFIX = 'FAC';
const LEGACY_INVOICE_PREFIXES = ['FAC', 'INV'];
const INVOICE_NUMBER_REGEX = /^(FAC|INV)-(\d{4})-(\d+)$/i;

export interface ParsedInvoiceNumber {
  year: number;
  sequence: number;
  canonical: string;
}

export function formatCanonicalInvoiceNumber(year: number, sequence: number): string {
  const normalizedSequence = Math.max(1, Math.round(sequence));
  const width = Math.max(3, String(normalizedSequence).length);
  return `${INVOICE_PREFIX}-${year}-${String(normalizedSequence).padStart(width, '0')}`;
}

export function parseInvoiceNumber(input: string | null | undefined): ParsedInvoiceNumber | null {
  if (!input) {
    return null;
  }

  const normalized = input.trim().toUpperCase();
  const match = INVOICE_NUMBER_REGEX.exec(normalized);
  if (!match) {
    return null;
  }

  const [, prefix, yearRaw, sequenceRaw] = match;
  if (!LEGACY_INVOICE_PREFIXES.includes(prefix)) {
    return null;
  }

  const year = Number.parseInt(yearRaw, 10);
  const sequence = Number.parseInt(sequenceRaw, 10);

  if (!Number.isFinite(year) || !Number.isFinite(sequence) || sequence <= 0) {
    return null;
  }

  return {
    year,
    sequence,
    canonical: formatCanonicalInvoiceNumber(year, sequence),
  };
}

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

export async function getNextInvoiceNumberForYear(scope: InvoiceNumberScope, year: number): Promise<string> {
  const userId = invoiceNumberScopeFilter(scope);
  const latestBySequence = await Invoice.findOne({
    userId,
    invoiceNumberYear: year,
    invoiceNumberSequence: { $gt: 0 },
  })
    .select('invoiceNumberSequence')
    .sort({ invoiceNumberSequence: -1 })
    .lean<{ invoiceNumberSequence?: number | null } | null>();

  const latestSequence = latestBySequence?.invoiceNumberSequence;
  if (typeof latestSequence === 'number' && Number.isFinite(latestSequence) && latestSequence > 0) {
    return formatCanonicalInvoiceNumber(year, latestSequence + 1);
  }

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

  const latestParsed = parseInvoiceNumber(latestInvoiceNumber);
  const nextSequence = latestParsed?.year === year ? latestParsed.sequence + 1 : 1;
  return formatCanonicalInvoiceNumber(year, nextSequence);
}

/**
 * Creates an invoice with the next company-wide number, retrying on collisions.
 *
 * The database unique index is per user, so two teammates creating invoices at the same
 * moment could both receive the same number. After inserting, we look for an earlier
 * invoice in the company with the same number; if one exists, ours is removed and
 * renumbered. Both racers apply the same rule, so exactly one keeps the number.
 */
export async function createInvoiceWithUniqueNumber(params: {
  numberScope: InvoiceNumberScope;
  year: number;
  payloadFactory: (invoiceNumber: string) => Record<string, unknown>;
}) {
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const invoiceNumber = await getNextInvoiceNumberForYear(params.numberScope, params.year);

    let created;
    try {
      created = await Invoice.create(params.payloadFactory(invoiceNumber));
    } catch (creationError) {
      if (!isInvoiceNumberDuplicateError(creationError) || attempt === maxAttempts - 1) {
        throw creationError;
      }
      continue;
    }

    const earlierClash = await Invoice.exists({
      userId: invoiceNumberScopeFilter(params.numberScope),
      invoiceNumber,
      _id: { $lt: created._id },
    });

    if (!earlierClash) {
      return created;
    }

    await Invoice.deleteOne({ _id: created._id });
  }

  throw new Error('Could not generate a unique invoice number');
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
        (duplicateError.keyPattern && 'invoiceNumberYear' in duplicateError.keyPattern) ||
        (duplicateError.keyPattern && 'invoiceNumberSequence' in duplicateError.keyPattern) ||
        (duplicateError.keyValue && 'invoiceNumber' in duplicateError.keyValue) ||
        (duplicateError.keyValue && 'invoiceNumberYear' in duplicateError.keyValue) ||
        (duplicateError.keyValue && 'invoiceNumberSequence' in duplicateError.keyValue) ||
        message.includes('invoiceNumber') ||
        message.includes('unique_user_invoice_number') ||
        message.includes('unique_user_invoice_number_sequence')
    );
  }

  return message.includes('E11000') && message.includes('invoiceNumber');
}