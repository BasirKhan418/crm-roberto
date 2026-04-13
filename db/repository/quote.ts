import ConnectDb from '@/db/connectDb';
import Client from '@/db/models/Client';
import Quote from '@/db/models/Quote';
import QuoteSequence from '../models/QuoteSequence';
import mongoose from 'mongoose';
import { computeQuoteLine, computeQuoteTotalsFromComputedLines } from '@/lib/quote-calculations';
import type { CreateQuoteDTO, UpdateQuoteDTO, UpdateQuoteStatusDTO } from '@/validators/quote.schema';

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused' | 'rejected';
export type QuoteSignedStatus = 'not_signed' | 'signed';

interface LastQuoteNumberRecord {
  quoteNumber: string;
}

interface QuoteSequenceRecord {
  lastCounter: number;
}

export interface QuoteListItemRecord {
  _id: string;
  quoteNumber: string;
  date: Date;
  status: QuoteStatus;
  signedStatus?: QuoteSignedStatus;
  convertedToInvoice?: boolean;
  invoiceId?: string | null;
  rejectionAcknowledgedAt?: Date | null;
  statusChangedAt: Date | null;
  totalExcludingTax: number;
  totalVat: number;
  totalIncludingTax: number;
  clientId: string;
  subject?: string | null;
  clientSnapshot: {
    fullName: string;
    email?: string | null;
  };
}

export interface QuoteListResult {
  items: QuoteListItemRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface QuoteDeleteRecord {
  _id: string;
  quoteNumber: string;
}

interface QuoteStatusHistoryRecord {
  to: QuoteStatus;
  changedAt?: Date | string | null;
}

interface QuoteListQueryRecord {
  _id: mongoose.Types.ObjectId | string;
  quoteNumber: string;
  date: Date;
  status: QuoteStatus;
  signedStatus?: QuoteSignedStatus;
  convertedToInvoice?: boolean;
  invoiceId?: mongoose.Types.ObjectId | string | null;
  rejectionAcknowledgedAt?: Date | null;
  signedAt?: Date | null;
  updatedAt?: Date | null;
  totalExcludingTax: number;
  totalVat: number;
  totalIncludingTax: number;
  clientId: mongoose.Types.ObjectId | string;
  clientSnapshot: {
    fullName: string;
    email?: string | null;
  };
  statusHistory?: QuoteStatusHistoryRecord[];
}

interface ClientSnapshotRecord {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  addressDetails?: {
    streetNumber?: string | null;
    streetName?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
  } | null;
  companyName?: string | null;
  vatNumber?: string | null;
}

interface QuoteRecord {
  _id: string;
  quoteNumber: string;
  date: Date;
  status: QuoteStatus;
  signedStatus?: QuoteSignedStatus;
  convertedToInvoice?: boolean;
  invoiceId?: string | null;
  signatureToken?: string | null;
  signatureTokenExpiry?: Date | null;
  signedAt?: Date | null;
  clientId: string;
  clientSnapshot: ClientSnapshotRecord;
  lineItems: Array<{
    productId?: string | null;
    productImageUrl?: string | null;
    name: string;
    quantity: number;
    baseUnitPriceExcludingTax: number;
    unitPriceExcludingTax: number;
    discountPercentage: number;
    vatRate: number;
    totalExcludingTaxBeforeDiscount: number;
    discountAmountExcludingTax: number;
    totalExcludingTax: number;
    vatAmount: number;
    totalIncludingTax: number;
  }>;
  totalExcludingTaxBeforeDiscount: number;
  totalDiscountExcludingTax: number;
  totalExcludingTax: number;
  totalVat: number;
  totalIncludingTax: number;
  notes?: string | null;
  paymentTerms?: string | null;
  validityDays?: number;
  rejectionComment?: string | null;
  subject?: string | null;
  rejectedSignToken?: string | null;
  adminReplyMessage?: string | null;
  conversationMessages?: Array<{
    role: 'admin' | 'client';
    text: string;
    sentAt: Date | string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

type QuoteLineItemRecord = QuoteRecord['lineItems'][number];

type QuoteLineItemSource = Omit<QuoteLineItemRecord, 'productId'> & {
  productId?: mongoose.Types.ObjectId | string | null;
};

type QuoteRecordSource = Omit<QuoteRecord, '_id' | 'clientId' | 'invoiceId' | 'lineItems'> & {
  _id: mongoose.Types.ObjectId | string;
  clientId: mongoose.Types.ObjectId | string;
  invoiceId?: mongoose.Types.ObjectId | string | null;
  lineItems: QuoteLineItemSource[];
};

export type QuoteDetailRecord = QuoteRecord;

type CreateQuoteResult =
  | { kind: 'ok'; quote: QuoteRecord }
  | { kind: 'client-not-found' };

type UpdateQuoteResult =
  | { kind: 'ok'; quote: QuoteRecord }
  | { kind: 'not-found' }
  | { kind: 'locked' }
  | { kind: 'client-not-found' };

type UpdateQuoteStatusResult =
  | { kind: 'ok'; quote: QuoteRecord; from: QuoteStatus; to: QuoteStatus }
  | { kind: 'not-found' }
  | { kind: 'invalid-transition'; from: QuoteStatus; to: QuoteStatus };

type DuplicateQuoteResult =
  | { kind: 'ok'; quote: QuoteRecord; sourceQuoteId: string }
  | { kind: 'not-found' };

const EDITABLE_STATUSES: QuoteStatus[] = ['draft', 'sent', 'rejected'];

const ALLOWED_STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['sent'],
  sent: ['accepted', 'refused', 'draft', 'rejected'],
  accepted: ['draft'],
  refused: ['draft'],
  rejected: ['sent'],
};

const MAX_QUOTE_NUMBER_RETRIES = 200;
const QUOTE_NUMBER_PREFIX = 'DEV';
let ensureQuoteNumberIndexPromise: Promise<void> | null = null;

function getCurrentQuoteYear(): number {
  return new Date().getFullYear();
}

function getQuotePrefix(year: number): string {
  return `${QUOTE_NUMBER_PREFIX}-${year}-`;
}

function formatQuoteNumber(year: number, counter: number): string {
  return `${getQuotePrefix(year)}${String(counter).padStart(3, '0')}`;
}

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (error as { code?: number }).code === 11000;
}

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const normalized = value instanceof Date ? value : new Date(value);
  return Number.isFinite(normalized.getTime()) ? normalized : null;
}

function stringifyObjectId(value: mongoose.Types.ObjectId | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return String(value);
}

function toQuoteRecord(quote: QuoteRecordSource): QuoteRecord {
  return {
    ...quote,
    _id: String(quote._id),
    clientId: String(quote.clientId),
    invoiceId: stringifyObjectId(quote.invoiceId),
    lineItems: quote.lineItems.map((item) => ({
      productId: stringifyObjectId(item.productId),
      productImageUrl: item.productImageUrl ?? null,
      name: item.name,
      quantity: item.quantity,
      baseUnitPriceExcludingTax: item.baseUnitPriceExcludingTax,
      unitPriceExcludingTax: item.unitPriceExcludingTax,
      discountPercentage: item.discountPercentage,
      vatRate: item.vatRate,
      totalExcludingTaxBeforeDiscount: item.totalExcludingTaxBeforeDiscount,
      discountAmountExcludingTax: item.discountAmountExcludingTax,
      totalExcludingTax: item.totalExcludingTax,
      vatAmount: item.vatAmount,
      totalIncludingTax: item.totalIncludingTax,
    })),
  };
}

function getLatestStatusChangedAt(
  status: QuoteStatus,
  history?: QuoteStatusHistoryRecord[] | null,
  fallbacks?: { signedAt?: Date | string | null; updatedAt?: Date | string | null; date?: Date | string | null }
): Date | null {
  const matchedEntry = [...(history ?? [])].reverse().find((entry) => entry.to === status);
  const historyDate = normalizeDate(matchedEntry?.changedAt);

  if (historyDate) {
    return historyDate;
  }

  if (status === 'accepted') {
    const signedAt = normalizeDate(fallbacks?.signedAt);
    if (signedAt) {
      return signedAt;
    }
  }

  return normalizeDate(fallbacks?.updatedAt) ?? normalizeDate(fallbacks?.date);
}

async function ensureTenantScopedQuoteNumberIndex(): Promise<void> {
  if (ensureQuoteNumberIndexPromise) {
    await ensureQuoteNumberIndexPromise;
    return;
  }

  ensureQuoteNumberIndexPromise = (async () => {
    const indexes = await Quote.collection.indexes();
    const hasTenantUniqueIndex = indexes.some(
      (index) =>
        index.name === 'unique_user_quote_number' &&
        index.unique === true &&
        (index.key as Record<string, number>)?.user === 1 &&
        (index.key as Record<string, number>)?.quoteNumber === 1
    );

    const hasLegacyGlobalQuoteNumberUnique = indexes.some(
      (index) =>
        index.name === 'quoteNumber_1' &&
        index.unique === true &&
        (index.key as Record<string, number>)?.quoteNumber === 1 &&
        Object.keys(index.key as Record<string, number>).length === 1
    );

    if (hasLegacyGlobalQuoteNumberUnique) {
      await Quote.collection.dropIndex('quoteNumber_1');
    }

    if (!hasTenantUniqueIndex) {
      await Quote.collection.createIndex(
        { user: 1, quoteNumber: 1 },
        { unique: true, name: 'unique_user_quote_number' }
      );
    }
  })().catch((error) => {
    ensureQuoteNumberIndexPromise = null;
    throw error;
  });

  await ensureQuoteNumberIndexPromise;
}

function parseQuoteCounter(quoteNumber: string, year: number): number | null {
  const prefix = getQuotePrefix(year);
  if (!quoteNumber.startsWith(prefix)) {
    return null;
  }

  const rawCounter = quoteNumber.slice(prefix.length);
  if (!/^\d+$/.test(rawCounter)) {
    return null;
  }

  const counter = Number.parseInt(rawCounter, 10);
  return Number.isFinite(counter) && counter > 0 ? counter : null;
}

async function getMaxExistingQuoteCounter(userId: string, year: number): Promise<number> {
  if (!isValidObjectId(userId)) {
    return 0;
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const prefix = getQuotePrefix(year);

  const rows = await Quote.aggregate<{ counter: number }>([
    {
      $match: {
        user: userObjectId,
        quoteNumber: { $regex: `^${prefix}\\d+$` },
      },
    },
    {
      $addFields: {
        counter: {
          $toInt: {
            $arrayElemAt: [{ $split: ['$quoteNumber', prefix] }, 1],
          },
        },
      },
    },
    { $sort: { counter: -1 } },
    { $limit: 1 },
    { $project: { _id: 0, counter: 1 } },
  ]);

  return rows[0]?.counter ?? 0;
}

async function ensureQuoteSequenceSeeded(userId: string, year: number): Promise<void> {
  const existing = await QuoteSequence.findOne({ user: userId, year }).select('_id').lean();
  if (existing) {
    return;
  }

  const maxExistingCounter = await getMaxExistingQuoteCounter(userId, year);

  try {
    await QuoteSequence.create({ user: userId, year, lastCounter: maxExistingCounter });
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
  }
}

async function allocateNextQuoteNumber(userId: string): Promise<string> {
  const year = getCurrentQuoteYear();

  await ensureQuoteSequenceSeeded(userId, year);

  const sequence = await QuoteSequence.findOneAndUpdate(
    { user: userId, year },
    {
      $inc: { lastCounter: 1 },
      $setOnInsert: { user: userId, year },
    },
    { new: true, upsert: true }
  )
    .select('lastCounter')
    .lean();

  const nextCounter = (sequence as QuoteSequenceRecord | null)?.lastCounter;
  if (!nextCounter || nextCounter < 1) {
    throw new Error('Could not allocate next quote number.');
  }

  return formatQuoteNumber(year, nextCounter);
}

export const getLastQuoteNumber = async (userId: string): Promise<string | null> => {
  await ConnectDb();

  const year = getCurrentQuoteYear();

  const [lastQuote, sequence, maxExistingCounter] = await Promise.all([
    Quote.findOne({
      user: userId,
      quoteNumber: { $regex: `^${getQuotePrefix(year)}\\d+$` },
    })
      .sort({ createdAt: -1 })
      .select('quoteNumber')
      .lean(),
    QuoteSequence.findOne({ user: userId, year }).select('lastCounter').lean(),
    getMaxExistingQuoteCounter(userId, year),
  ]);

  const lastFromQuotes = parseQuoteCounter((lastQuote as LastQuoteNumberRecord | null)?.quoteNumber ?? '', year) ?? 0;
  const lastFromSequence = (sequence as QuoteSequenceRecord | null)?.lastCounter ?? 0;
  const lastCounter = Math.max(lastFromQuotes, lastFromSequence, maxExistingCounter);

  return lastCounter > 0 ? formatQuoteNumber(year, lastCounter) : null;
};

export const listQuotes = async (
  userId: string,
  options: {
    status?: QuoteStatus;
    search?: string;
    sort?: 'date' | 'amount';
    page?: number;
    limit?: number;
    clientId?: string;
  }
): Promise<QuoteListResult> => {
  await ConnectDb();

  const query: Record<string, unknown> = { user: userId };

  if (options.clientId && mongoose.Types.ObjectId.isValid(options.clientId)) {
    query.clientId = new mongoose.Types.ObjectId(options.clientId);
  }

  if (options.status) {
    query.status =
      options.status === 'rejected'
        ? { $in: ['rejected', 'refused'] }
        : options.status;
  }

  if (options.search) {
    query.$or = [
      { quoteNumber: { $regex: options.search, $options: 'i' } },
      { 'clientSnapshot.fullName': { $regex: options.search, $options: 'i' } },
    ];
  }

  const sortOptions: Record<string, 1 | -1> =
    options.sort === 'amount' ? { totalIncludingTax: -1 } : { createdAt: -1 };
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.max(1, Math.min(options.limit ?? 10, 100));

  const total = await Quote.countDocuments(query);
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  const quotes = await Quote.find(query)
    .sort(sortOptions)
    .skip(skip)
    .limit(limit)
    .select('_id quoteNumber date status signedStatus convertedToInvoice invoiceId rejectionAcknowledgedAt signedAt updatedAt clientId clientSnapshot.fullName clientSnapshot.email totalExcludingTax totalVat totalIncludingTax statusHistory.to statusHistory.changedAt subject')
    .lean();

  const items = (quotes as (QuoteListQueryRecord & { subject?: string | null })[]).map((quote) => {
    const normalizedStatus = quote.status === 'refused' ? 'rejected' : quote.status;

    return {
    _id: String(quote._id),
    quoteNumber: quote.quoteNumber,
    date: quote.date,
    status: normalizedStatus,
    signedStatus: quote.signedStatus ?? 'not_signed',
    convertedToInvoice: Boolean(quote.convertedToInvoice),
    invoiceId: quote.invoiceId ? String(quote.invoiceId) : null,
    rejectionAcknowledgedAt: quote.rejectionAcknowledgedAt ?? null,
    statusChangedAt: getLatestStatusChangedAt(normalizedStatus, quote.statusHistory, {
      signedAt: quote.signedAt,
      updatedAt: quote.updatedAt,
      date: quote.date,
    }),
    totalExcludingTax: Math.max(0, Math.round(quote.totalExcludingTax ?? 0)),
    totalVat: Math.max(0, Math.round(quote.totalVat ?? 0)),
    totalIncludingTax: quote.totalIncludingTax,
    clientId: String(quote.clientId),
    subject: (quote as { subject?: string | null }).subject ?? null,
    clientSnapshot: {
      fullName: quote.clientSnapshot.fullName,
      email: quote.clientSnapshot.email ?? null,
    },
  };
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages,
  };
};

export const deleteQuoteById = async (userId: string, quoteId: string): Promise<QuoteDeleteRecord | null> => {
  await ConnectDb();

  if (!isValidObjectId(quoteId)) {
    return null;
  }

  const deleted = await Quote.findOneAndDelete({ _id: quoteId, user: userId })
    .select('_id quoteNumber')
    .lean();

  if (!deleted) {
    return null;
  }

  return {
    _id: String((deleted as { _id: mongoose.Types.ObjectId | string })._id),
    quoteNumber: (deleted as { quoteNumber: string }).quoteNumber,
  };
};

export const getQuoteById = async (userId: string, quoteId: string): Promise<QuoteDetailRecord | null> => {
  await ConnectDb();

  if (!isValidObjectId(quoteId)) {
    return null;
  }

  const quote = await Quote.findOne({ _id: quoteId, user: userId }).lean();
  return quote ? toQuoteRecord(quote as QuoteRecordSource) : null;
};

async function getClientSnapshot(userId: string, clientId: string): Promise<ClientSnapshotRecord | null> {
  const client = await Client.findOne({ _id: clientId, user: userId }).lean();
  if (!client) {
    return null;
  }

  return {
    fullName: (client as { fullName: string }).fullName,
    email: (client as { email?: string | null }).email ?? null,
    phone: (client as { phone?: string | null }).phone ?? null,
    address: (client as { address?: string | null }).address ?? null,
    addressDetails: (client as { addressDetails?: { streetNumber?: string | null; streetName?: string | null; postalCode?: string | null; city?: string | null; country?: string | null } | null }).addressDetails ?? null,
    companyName: (client as { companyName?: string | null }).companyName ?? null,
    vatNumber: (client as { vatNumber?: string | null }).vatNumber ?? null,
  };
}

export const createQuote = async (userId: string, payload: CreateQuoteDTO): Promise<CreateQuoteResult> => {
  await ConnectDb();
  await ensureTenantScopedQuoteNumberIndex();

  const clientSnapshot = await getClientSnapshot(userId, payload.clientId);
  if (!clientSnapshot) {
    return { kind: 'client-not-found' };
  }

  const computedLines = payload.lineItems.map((item) =>
    computeQuoteLine({
      quantity: item.quantity,
      unitPriceExcludingTax: item.unitPriceExcludingTax,
      baseUnitPriceExcludingTax: item.baseUnitPriceExcludingTax,
      discountPercentage: item.discountPercentage,
      vatRate: item.vatRate,
    })
  );

  const lineItems = payload.lineItems.map((item, index) => ({
    productId: item.productId ?? null,
    productImageUrl: item.productImageUrl ?? null,
    name: item.name,
    ...computedLines[index],
  }));

  const totals = computeQuoteTotalsFromComputedLines(computedLines);

  for (let attempt = 0; attempt < MAX_QUOTE_NUMBER_RETRIES; attempt += 1) {
    const quoteNumber = await allocateNextQuoteNumber(userId);

    try {
      const created = await Quote.create({
        user: userId,
        quoteNumber,
        date: payload.date ?? new Date(),
        status: 'draft',
        clientId: payload.clientId,
        clientSnapshot,
        lineItems,
        ...totals,
        notes: payload.notes ?? null,
        paymentTerms: payload.paymentTerms ?? null,
        validityDays: payload.validityDays ?? 30,
        subject: payload.subject ?? null,
        statusHistory: [{ to: 'draft', changedAt: new Date() }],
      });

      return {
        kind: 'ok',
        quote: toQuoteRecord(created.toObject() as QuoteRecordSource),
      };
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
  }

  throw new Error('Could not allocate a unique quote number. Please retry.');
};

export const updateQuoteById = async (
  userId: string,
  quoteId: string,
  payload: UpdateQuoteDTO
): Promise<UpdateQuoteResult> => {
  await ConnectDb();

  if (!isValidObjectId(quoteId)) {
    return { kind: 'not-found' };
  }

  const quote = await Quote.findOne({ _id: quoteId, user: userId });
  if (!quote) {
    return { kind: 'not-found' };
  }

  const status = quote.status as QuoteStatus;
  if (!EDITABLE_STATUSES.includes(status)) {
    return { kind: 'locked' };
  }

  if (payload.clientId && payload.clientId !== String(quote.clientId)) {
    const clientSnapshot = await getClientSnapshot(userId, payload.clientId);
    if (!clientSnapshot) {
      return { kind: 'client-not-found' };
    }

    quote.clientId = new mongoose.Types.ObjectId(payload.clientId);
    quote.clientSnapshot = clientSnapshot;
  }

  if (payload.date) {
    quote.date = payload.date;
  }

  if (payload.notes !== undefined) {
    quote.notes = payload.notes;
  }

  if (payload.paymentTerms !== undefined) {
    quote.paymentTerms = payload.paymentTerms;
  }

  if (payload.validityDays !== undefined) {
    quote.validityDays = payload.validityDays;
  }

  if (payload.subject !== undefined) {
    quote.subject = payload.subject;
  }

  if (payload.lineItems) {
    const computedLines = payload.lineItems.map((item) =>
      computeQuoteLine({
        quantity: item.quantity,
        unitPriceExcludingTax: item.unitPriceExcludingTax,
        baseUnitPriceExcludingTax: item.baseUnitPriceExcludingTax,
        discountPercentage: item.discountPercentage,
        vatRate: item.vatRate,
      })
    );

    quote.set(
      'lineItems',
      payload.lineItems.map((item, index) => ({
        productId: item.productId ?? null,
        productImageUrl: item.productImageUrl ?? null,
        name: item.name,
        ...computedLines[index],
      }))
    );

    const totals = computeQuoteTotalsFromComputedLines(computedLines);
    quote.totalExcludingTaxBeforeDiscount = totals.totalExcludingTaxBeforeDiscount;
    quote.totalDiscountExcludingTax = totals.totalDiscountExcludingTax;
    quote.totalExcludingTax = totals.totalExcludingTax;
    quote.totalVat = totals.totalVat;
    quote.totalIncludingTax = totals.totalIncludingTax;
  }

  await quote.save();

  return {
    kind: 'ok',
    quote: toQuoteRecord(quote.toObject() as QuoteRecordSource),
  };
};

export const updateQuoteStatusById = async (
  userId: string,
  quoteId: string,
  payload: UpdateQuoteStatusDTO
): Promise<UpdateQuoteStatusResult> => {
  await ConnectDb();

  if (!isValidObjectId(quoteId)) {
    return { kind: 'not-found' };
  }

  const quote = await Quote.findOne({ _id: quoteId, user: userId });
  if (!quote) {
    return { kind: 'not-found' };
  }

  const from = quote.status as QuoteStatus;
  const to = payload.to;
  const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[from] ?? [];

  if (!allowedTransitions.includes(to)) {
    return { kind: 'invalid-transition', from, to };
  }

  quote.status = to;
  quote.statusHistory.push({ from, to, changedAt: new Date() });
  await quote.save();

  return {
    kind: 'ok',
    quote: toQuoteRecord(quote.toObject() as QuoteRecordSource),
    from,
    to,
  };
};

export const duplicateQuoteById = async (userId: string, quoteId: string): Promise<DuplicateQuoteResult> => {
  await ConnectDb();
  await ensureTenantScopedQuoteNumberIndex();

  if (!isValidObjectId(quoteId)) {
    return { kind: 'not-found' };
  }

  const sourceQuote = await Quote.findOne({ _id: quoteId, user: userId }).lean();
  if (!sourceQuote) {
    return { kind: 'not-found' };
  }

  const sourceQuoteRecord = toQuoteRecord(sourceQuote as QuoteRecordSource);

  const lineItems = sourceQuoteRecord.lineItems.map((item) => {
    const computed = computeQuoteLine({
      quantity: item.quantity,
      unitPriceExcludingTax: item.unitPriceExcludingTax,
      baseUnitPriceExcludingTax: item.baseUnitPriceExcludingTax ?? item.unitPriceExcludingTax,
      discountPercentage: item.discountPercentage ?? 0,
      vatRate: item.vatRate,
    });

    return {
      productId: item.productId ?? null,
      productImageUrl: item.productImageUrl ?? null,
      name: item.name,
      ...computed,
    };
  });

  // lineItems already contain freshly computed values from above
  const totals = computeQuoteTotalsFromComputedLines(lineItems);

  for (let attempt = 0; attempt < MAX_QUOTE_NUMBER_RETRIES; attempt += 1) {
    const quoteNumber = await allocateNextQuoteNumber(userId);

    try {
      const created = await Quote.create({
        user: userId,
        quoteNumber,
        date: new Date(),
        status: 'draft',
        clientId: sourceQuoteRecord.clientId,
        clientSnapshot: sourceQuoteRecord.clientSnapshot,
        lineItems,
        ...totals,
        notes: sourceQuoteRecord.notes ?? null,
        paymentTerms: sourceQuoteRecord.paymentTerms ?? null,
        validityDays: sourceQuoteRecord.validityDays ?? 30,
        subject: sourceQuoteRecord.subject ?? null,
        statusHistory: [{ to: 'draft', changedAt: new Date() }],
        convertedToInvoice: false,
        invoiceId: null,
      });

      return {
        kind: 'ok',
        quote: toQuoteRecord(created.toObject() as QuoteRecordSource),
        sourceQuoteId: quoteId,
      };
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
  }

  throw new Error('Could not allocate a unique quote number. Please retry.');
};
