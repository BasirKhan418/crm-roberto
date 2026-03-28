import ConnectDb from '@/db/connectDb';
import Client from '@/db/models/Client';
import Quote from '@/db/models/Quote';
import mongoose from 'mongoose';
import { calcLineItem, calcQuoteTotals, nextQuoteNumber } from '@/lib/price';
import type { CreateQuoteDTO, UpdateQuoteDTO, UpdateQuoteStatusDTO } from '@/validators/quote.schema';

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused';

interface LastQuoteNumberRecord {
  quoteNumber: string;
}

export interface QuoteListItemRecord {
  _id: string;
  quoteNumber: string;
  date: Date;
  status: QuoteStatus;
  totalIncludingTax: number;
  clientId: string;
  clientSnapshot: {
    fullName: string;
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

interface ClientSnapshotRecord {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  companyName?: string | null;
  vatNumber?: string | null;
}

interface QuoteRecord {
  _id: string;
  quoteNumber: string;
  date: Date;
  status: QuoteStatus;
  clientId: string;
  clientSnapshot: ClientSnapshotRecord;
  lineItems: Array<{
    productId?: string | null;
    name: string;
    quantity: number;
    unitPriceExcludingTax: number;
    vatRate: number;
    totalExcludingTax: number;
  }>;
  totalExcludingTax: number;
  totalVat: number;
  totalIncludingTax: number;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

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

const EDITABLE_STATUSES: QuoteStatus[] = ['draft', 'sent'];

const ALLOWED_STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['sent'],
  sent: ['accepted', 'refused', 'draft'],
  accepted: ['draft'],
  refused: ['draft'],
};

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

export const getLastQuoteNumber = async (userId: string): Promise<string | null> => {
  await ConnectDb();

  const lastQuote = await Quote.findOne({ user: userId })
    .sort({ createdAt: -1 })
    .select('quoteNumber')
    .lean();

  return (lastQuote as LastQuoteNumberRecord | null)?.quoteNumber ?? null;
};

export const listQuotes = async (
  userId: string,
  options: {
    status?: QuoteStatus;
    search?: string;
    sort?: 'date' | 'amount';
    page?: number;
    limit?: number;
  }
): Promise<QuoteListResult> => {
  await ConnectDb();

  const query: Record<string, unknown> = { user: userId };

  if (options.status) {
    query.status = options.status;
  }

  if (options.search) {
    query.$or = [
      { quoteNumber: { $regex: options.search, $options: 'i' } },
      { 'clientSnapshot.fullName': { $regex: options.search, $options: 'i' } },
    ];
  }

  const sortField = options.sort === 'amount' ? 'totalIncludingTax' : 'date';
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.max(1, Math.min(options.limit ?? 10, 100));

  const total = await Quote.countDocuments(query);
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  const quotes = await Quote.find(query)
    .sort({ [sortField]: -1 })
    .skip(skip)
    .limit(limit)
    .select('_id quoteNumber date status clientId clientSnapshot.fullName totalIncludingTax')
    .lean();

  return {
    items: quotes as QuoteListItemRecord[],
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

  return (deleted as QuoteDeleteRecord | null) || null;
};

export const getQuoteById = async (userId: string, quoteId: string): Promise<QuoteDetailRecord | null> => {
  await ConnectDb();

  if (!isValidObjectId(quoteId)) {
    return null;
  }

  const quote = await Quote.findOne({ _id: quoteId, user: userId }).lean();
  return (quote as QuoteDetailRecord | null) || null;
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
    companyName: (client as { companyName?: string | null }).companyName ?? null,
    vatNumber: (client as { vatNumber?: string | null }).vatNumber ?? null,
  };
}

export const createQuote = async (userId: string, payload: CreateQuoteDTO): Promise<CreateQuoteResult> => {
  await ConnectDb();

  const clientSnapshot = await getClientSnapshot(userId, payload.clientId);
  if (!clientSnapshot) {
    return { kind: 'client-not-found' };
  }

  const lineItems = payload.lineItems.map((item) => ({
    ...item,
    totalExcludingTax: calcLineItem(item.unitPriceExcludingTax, item.quantity, item.vatRate).totalExclTax,
  }));

  const totals = calcQuoteTotals(payload.lineItems);
  const lastQuoteNumber = await getLastQuoteNumber(userId);
  const quoteNumber = nextQuoteNumber(lastQuoteNumber);

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
    statusHistory: [{ to: 'draft', changedAt: new Date() }],
  });

  return {
    kind: 'ok',
    quote: created.toObject() as QuoteRecord,
  };
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

  if (payload.lineItems) {
    quote.lineItems = payload.lineItems.map((item) => ({
      ...item,
      totalExcludingTax: calcLineItem(item.unitPriceExcludingTax, item.quantity, item.vatRate).totalExclTax,
    }));

    const totals = calcQuoteTotals(payload.lineItems);
    quote.totalExcludingTax = totals.totalExcludingTax;
    quote.totalVat = totals.totalVat;
    quote.totalIncludingTax = totals.totalIncludingTax;
  }

  await quote.save();

  return {
    kind: 'ok',
    quote: quote.toObject() as QuoteRecord,
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
    quote: quote.toObject() as QuoteRecord,
    from,
    to,
  };
};

export const duplicateQuoteById = async (userId: string, quoteId: string): Promise<DuplicateQuoteResult> => {
  await ConnectDb();

  if (!isValidObjectId(quoteId)) {
    return { kind: 'not-found' };
  }

  const sourceQuote = await Quote.findOne({ _id: quoteId, user: userId }).lean();
  if (!sourceQuote) {
    return { kind: 'not-found' };
  }

  const lineItems = (sourceQuote as QuoteRecord).lineItems.map((item) => ({
    productId: item.productId ?? null,
    name: item.name,
    quantity: item.quantity,
    unitPriceExcludingTax: item.unitPriceExcludingTax,
    vatRate: item.vatRate,
    totalExcludingTax: calcLineItem(item.unitPriceExcludingTax, item.quantity, item.vatRate).totalExclTax,
  }));

  const totals = calcQuoteTotals(
    lineItems.map((item) => ({
      productId: item.productId ?? null,
      name: item.name,
      quantity: item.quantity,
      unitPriceExcludingTax: item.unitPriceExcludingTax,
      vatRate: item.vatRate,
    }))
  );

  const lastQuoteNumber = await getLastQuoteNumber(userId);
  const quoteNumber = nextQuoteNumber(lastQuoteNumber);

  const created = await Quote.create({
    user: userId,
    quoteNumber,
    date: new Date(),
    status: 'draft',
    clientId: (sourceQuote as QuoteRecord).clientId,
    clientSnapshot: (sourceQuote as QuoteRecord).clientSnapshot,
    lineItems,
    ...totals,
    notes: (sourceQuote as QuoteRecord).notes ?? null,
    statusHistory: [{ to: 'draft', changedAt: new Date() }],
    convertedToInvoice: false,
    invoiceId: null,
  });

  return {
    kind: 'ok',
    quote: created.toObject() as QuoteRecord,
    sourceQuoteId: quoteId,
  };
};
