import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import React from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';

import ConnectDb from '@/db/connectDb';
import Client from '@/db/models/Client';
import Invoice from '@/db/models/Invoice';
import Note from '@/db/models/Note';
import Quote from '@/db/models/Quote';
import { getCompanyProfileByUserId } from '@/db/repository/cprofile';
import { extractClientSnapshot } from '@/lib/address';
import { sendInvoice } from '@/lib/email';
import { resolveLocaleFromRequest } from '@/lib/i18n/locale';
import { InvoicePdfTemplate } from '@/lib/pdf/InvoicePdfTemplate';
import getMe from '@/utils/middlewares/useMe';

export const runtime = 'nodejs';

const DAY_IN_MS = 86_400_000;

type Locale = 'en' | 'fr';

interface FollowUpQuoteTarget {
  _id: string;
  quoteNumber: string;
  clientSnapshot: {
    fullName: string;
    email?: string | null;
  };
}

interface AcceptedQuoteTarget {
  _id: string;
  quoteNumber: string;
  clientId: string;
}

interface InactiveClientTarget {
  _id: string;
  fullName: string;
  email?: string | null;
}

interface OverdueInvoiceTarget {
  _id: string;
  invoiceNumber: string;
  status: 'unpaid' | 'overdue';
  dueDate?: string | null;
  reminderState?: {
    level?: number | null;
  };
  recurrence?: {
    isActive?: boolean;
  };
  clientSnapshot: {
    fullName: string;
    email?: string | null;
  };
}

interface SmartActionsResponse {
  pendingQuoteFollowUps: {
    count: number;
    target: FollowUpQuoteTarget | null;
  };
  acceptedNotInvoiced: {
    count: number;
    target: AcceptedQuoteTarget | null;
    items: AcceptedQuoteTarget[];
  };
  inactiveClients: {
    count: number;
    target: InactiveClientTarget | null;
  };
  overdueInvoices: {
    count: number;
    target: OverdueInvoiceTarget | null;
    items: OverdueInvoiceTarget[];
  };
}

function toObjectId(value: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(value);
}

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function getSentTimestamp(quote: {
  statusHistory?: Array<{ to?: string; changedAt?: Date | string | null }>;
  updatedAt?: Date | string | null;
  date?: Date | string | null;
}): number {
  const sentEntry = [...(quote.statusHistory ?? [])].reverse().find((entry) => entry.to === 'sent');
  const fromHistory = normalizeDate(sentEntry?.changedAt);
  const fallback = normalizeDate(quote.updatedAt) ?? normalizeDate(quote.date);
  return (fromHistory ?? fallback ?? new Date()).getTime();
}

function getLastDateMapFromAggregation(rows: Array<{ _id: mongoose.Types.ObjectId; lastDate: Date }>): Map<string, Date> {
  const map = new Map<string, Date>();

  for (const row of rows) {
    map.set(String(row._id), row.lastDate);
  }

  return map;
}

async function buildSmartActions(userId: string): Promise<SmartActionsResponse> {
  await ConnectDb();

  const userObjectId = toObjectId(userId);
  const now = Date.now();
  const sevenDaysAgo = now - 7 * DAY_IN_MS;
  const thirtyDaysAgo = now - 30 * DAY_IN_MS;

  const [sentQuotesRaw, acceptedQuotesRaw, overdueInvoicesRaw, clientsRaw, quoteActivityRaw, invoiceActivityRaw, noteActivityRaw] = await Promise.all([
    Quote.find({ user: userId, status: 'sent' })
      .select('_id quoteNumber clientSnapshot statusHistory.to statusHistory.changedAt updatedAt date')
      .lean(),
    Quote.find({
      user: userId,
      status: 'accepted',
      $or: [
        { invoiceId: null },
        { invoiceId: { $exists: false } },
      ],
    })
      .select('_id quoteNumber clientId date')
      .lean(),
    Invoice.find({
      userId: userObjectId,
      status: { $in: ['unpaid', 'overdue'] },
    })
      .sort({ dueDate: 1, createdAt: -1 })
      .select('_id invoiceNumber clientSnapshot.fullName clientSnapshot.email dueDate status recurrence.isActive reminderState.level')
      .lean(),
    Client.find({ user: userId })
      .select('_id fullName email createdAt updatedAt')
      .lean(),
    Quote.aggregate<{ _id: mongoose.Types.ObjectId; lastDate: Date }>([
      { $match: { user: userObjectId } },
      { $group: { _id: '$clientId', lastDate: { $max: '$createdAt' } } },
    ]),
    Invoice.aggregate<{ _id: mongoose.Types.ObjectId; lastDate: Date }>([
      { $match: { userId: userObjectId } },
      { $group: { _id: '$clientId', lastDate: { $max: '$createdAt' } } },
    ]),
    Note.aggregate<{ _id: mongoose.Types.ObjectId; lastDate: Date }>([
      { $match: { user: userObjectId, linkedType: 'client' } },
      { $group: { _id: '$linkedId', lastDate: { $max: '$createdAt' } } },
    ]),
  ]);

  const pendingFollowUps = (sentQuotesRaw as Array<{
    _id: mongoose.Types.ObjectId;
    quoteNumber: string;
    clientSnapshot: { fullName: string; email?: string | null };
    statusHistory?: Array<{ to?: string; changedAt?: Date | string | null }>;
    updatedAt?: Date | string | null;
    date?: Date | string | null;
  }>)
    .map((quote) => ({ quote, sentAt: getSentTimestamp(quote) }))
    .filter((item) => item.sentAt <= sevenDaysAgo)
    .sort((left, right) => left.sentAt - right.sentAt)
    .map((item) => item.quote);

  const acceptedNotInvoiced = (acceptedQuotesRaw as Array<{
    _id: mongoose.Types.ObjectId;
    quoteNumber: string;
    clientId: mongoose.Types.ObjectId;
    date: Date;
  }>)
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());

  const quoteMap = getLastDateMapFromAggregation(quoteActivityRaw);
  const invoiceMap = getLastDateMapFromAggregation(invoiceActivityRaw);
  const noteMap = getLastDateMapFromAggregation(noteActivityRaw);

  const inactiveClients = (clientsRaw as Array<{
    _id: mongoose.Types.ObjectId;
    fullName: string;
    email?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  }>)
    .map((client) => {
      const key = String(client._id);
      const lastClientDate = normalizeDate(client.updatedAt) ?? normalizeDate(client.createdAt) ?? new Date(0);
      const lastQuoteDate = quoteMap.get(key) ?? new Date(0);
      const lastInvoiceDate = invoiceMap.get(key) ?? new Date(0);
      const lastNoteDate = noteMap.get(key) ?? new Date(0);
      const lastActivity = new Date(Math.max(lastClientDate.getTime(), lastQuoteDate.getTime(), lastInvoiceDate.getTime(), lastNoteDate.getTime()));
      return { client, lastActivityAt: lastActivity.getTime() };
    })
    .filter((item) => item.lastActivityAt <= thirtyDaysAgo)
    .sort((left, right) => left.lastActivityAt - right.lastActivityAt)
    .map((item) => item.client);

  const overdueInvoices = overdueInvoicesRaw as Array<{
    _id: mongoose.Types.ObjectId;
    invoiceNumber: string;
    status: 'unpaid' | 'overdue';
    dueDate?: Date | null;
    reminderState?: {
      level?: number | null;
    } | null;
    recurrence?: {
      isActive?: boolean;
    } | null;
    clientSnapshot: { fullName: string; email?: string | null };
  }>;

  return {
    pendingQuoteFollowUps: {
      count: pendingFollowUps.length,
      target: pendingFollowUps[0]
        ? {
            _id: String(pendingFollowUps[0]._id),
            quoteNumber: pendingFollowUps[0].quoteNumber,
            clientSnapshot: {
              fullName: pendingFollowUps[0].clientSnapshot?.fullName ?? 'Client',
              email: pendingFollowUps[0].clientSnapshot?.email ?? null,
            },
          }
        : null,
    },
    acceptedNotInvoiced: {
      count: acceptedNotInvoiced.length,
      target: acceptedNotInvoiced[0]
        ? {
            _id: String(acceptedNotInvoiced[0]._id),
            quoteNumber: acceptedNotInvoiced[0].quoteNumber,
            clientId: String(acceptedNotInvoiced[0].clientId),
          }
        : null,
      items: acceptedNotInvoiced.slice(0, 12).map((quote) => ({
        _id: String(quote._id),
        quoteNumber: quote.quoteNumber,
        clientId: String(quote.clientId),
      })),
    },
    inactiveClients: {
      count: inactiveClients.length,
      target: inactiveClients[0]
        ? {
            _id: String(inactiveClients[0]._id),
            fullName: inactiveClients[0].fullName,
            email: inactiveClients[0].email ?? null,
          }
        : null,
    },
    overdueInvoices: {
      count: overdueInvoices.length,
      target: overdueInvoices[0]
        ? {
            _id: String(overdueInvoices[0]._id),
            invoiceNumber: overdueInvoices[0].invoiceNumber,
            status: overdueInvoices[0].status,
            dueDate: overdueInvoices[0].dueDate ? new Date(overdueInvoices[0].dueDate).toISOString() : null,
            recurrence: {
              isActive: overdueInvoices[0].recurrence?.isActive === true,
            },
            reminderState: {
              level: Number.isFinite(overdueInvoices[0].reminderState?.level)
                ? Math.max(0, Math.min(4, Math.round(Number(overdueInvoices[0].reminderState?.level))))
                : 0,
            },
            clientSnapshot: {
              fullName: overdueInvoices[0].clientSnapshot?.fullName ?? 'Client',
              email: overdueInvoices[0].clientSnapshot?.email ?? null,
            },
          }
        : null,
      items: overdueInvoices.slice(0, 8).map((invoice) => ({
        _id: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : null,
        recurrence: {
          isActive: invoice.recurrence?.isActive === true,
        },
        reminderState: {
          level: Number.isFinite(invoice.reminderState?.level)
            ? Math.max(0, Math.min(4, Math.round(Number(invoice.reminderState?.level))))
            : 0,
        },
        clientSnapshot: {
          fullName: invoice.clientSnapshot?.fullName ?? 'Client',
          email: invoice.clientSnapshot?.email ?? null,
        },
      })),
    },
  };
}

async function allocateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FAC-${year}-`;
  const prefixPattern = `^(INV|FAC)-${year}-`;

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const count = await Invoice.countDocuments({ invoiceNumber: { $regex: prefixPattern } });
    const candidate = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
    const exists = await Invoice.exists({ invoiceNumber: candidate });
    if (!exists) {
      return candidate;
    }
  }

  throw new Error('Could not allocate invoice number');
}

async function createInvoiceFromQuote(userId: string, quoteId: string) {
  await ConnectDb();

  if (!mongoose.Types.ObjectId.isValid(quoteId)) {
    return { ok: false, status: 400, message: 'Invalid quote id' };
  }

  const quote = await Quote.findOne({ _id: quoteId, user: userId }).lean();
  if (!quote) {
    return { ok: false, status: 404, message: 'Quote not found' };
  }

  const quoteDoc = quote as {
    _id: mongoose.Types.ObjectId;
    quoteNumber: string;
    date: Date;
    status: string;
    invoiceId?: mongoose.Types.ObjectId | null;
    clientId: mongoose.Types.ObjectId;
    clientSnapshot: {
      fullName: string;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      companyName?: string | null;
      vatNumber?: string | null;
    };
    lineItems: Array<{
      productId?: mongoose.Types.ObjectId | null;
      productImageUrl?: string | null;
      name: string;
      quantity: number;
      unitPriceExcludingTax: number;
      baseUnitPriceExcludingTax: number;
      discountPercentage: number;
      vatRate: number;
      totalExcludingTaxBeforeDiscount: number;
      discountAmountExcludingTax: number;
      totalExcludingTax: number;
      vatAmount: number;
      totalIncludingTax: number;
    }>;
    totalExcludingTax: number;
    totalVat: number;
    totalIncludingTax: number;
    notes?: string | null;
  };

  if (quoteDoc.status !== 'accepted') {
    return { ok: false, status: 400, message: 'Only accepted quotes can be invoiced' };
  }

  if (quoteDoc.invoiceId) {
    return { ok: false, status: 409, message: 'Quote already linked to an invoice' };
  }

  const existing = await Invoice.findOne({ userId: toObjectId(userId), quoteId: quoteDoc._id }).select('_id').lean();
  if (existing) {
    await Quote.updateOne(
      { _id: quoteDoc._id, user: userId },
      { $set: { convertedToInvoice: true, invoiceId: (existing as { _id: mongoose.Types.ObjectId })._id } }
    );
    return {
      ok: true,
      status: 200,
      message: 'Invoice already exists for this quote',
      invoiceId: String((existing as { _id: mongoose.Types.ObjectId })._id),
      created: false,
    };
  }

  const invoiceNumber = await allocateInvoiceNumber();
  const date = new Date();
  const dueDate = new Date(date.getTime() + 30 * DAY_IN_MS);

  const created = await Invoice.create({
    invoiceNumber,
    quoteId: quoteDoc._id,
    quoteNumber: quoteDoc.quoteNumber,
    date,
    dueDate,
    status: 'unpaid',
    clientId: quoteDoc.clientId,
    clientSnapshot: quoteDoc.clientSnapshot,
    lineItems: quoteDoc.lineItems,
    totalExcludingTax: quoteDoc.totalExcludingTax,
    totalVat: quoteDoc.totalVat,
    totalIncludingTax: quoteDoc.totalIncludingTax,
    depositPercentage: 100,
    notes: quoteDoc.notes ?? null,
    userId: toObjectId(userId),
  });

  await Quote.updateOne(
    { _id: quoteDoc._id, user: userId },
    { $set: { convertedToInvoice: true, invoiceId: created._id } }
  );

  return {
    ok: true,
    status: 201,
    message: 'Invoice generated from accepted quote',
    invoiceId: String(created._id),
    created: true,
  };
}

async function sendInvoiceReminder(userId: string, invoiceId: string, locale: Locale) {
  await ConnectDb();

  if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
    return { ok: false, status: 400, message: 'Invalid invoice id' };
  }

  const invoice = await Invoice.findOne({ _id: invoiceId, userId: toObjectId(userId) })
    .select(
      '_id invoiceNumber quoteNumber date dueDate status lineItems totalExcludingTax totalVat totalIncludingTax depositPercentage notes stripePaymentLinkId stripeDepositLinkId clientId clientSnapshot'
    )
    .lean();

  if (!invoice) {
    return { ok: false, status: 404, message: 'Invoice not found' };
  }

  const invoiceDoc = invoice as {
    _id: mongoose.Types.ObjectId;
    clientId: mongoose.Types.ObjectId;
    invoiceNumber: string;
    quoteNumber?: string | null;
    date?: Date | null;
    dueDate?: Date | null;
    status: string;
    lineItems: Array<{
      name: string;
      quantity: number;
      baseUnitPriceExcludingTax: number;
      discountPercentage: number;
      discountAmountExcludingTax: number;
      vatRate: number;
      totalExcludingTax: number;
    }>;
    totalExcludingTax: number;
    totalVat: number;
    totalIncludingTax: number;
    depositPercentage?: number;
    notes?: string | null;
    stripePaymentLinkId?: string | null;
    stripeDepositLinkId?: string | null;
    clientSnapshot: {
      fullName: string;
      companyName?: string | null;
      phone?: string | null;
      address?: string | null;
      email?: string | null;
      vatNumber?: string | null;
    };
  };

  if (invoiceDoc.status === 'paid') {
    return { ok: false, status: 400, message: 'Invoice is already paid' };
  }

  const clientDoc = await Client.findOne({ _id: invoiceDoc.clientId, user: toObjectId(userId) })
    .select('billingEmail')
    .lean<{ billingEmail?: string | null } | null>();

  const recipient = clientDoc?.billingEmail?.trim() || invoiceDoc.clientSnapshot.email?.trim();
  if (!recipient) {
    return { ok: false, status: 400, message: 'Client email is required for reminder' };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const depositPercentage = typeof invoiceDoc.depositPercentage === 'number' ? invoiceDoc.depositPercentage : 100;
  const paymentUrl = depositPercentage < 100
    ? invoiceDoc.stripeDepositLinkId
    : invoiceDoc.stripePaymentLinkId;
  const fallbackPaymentUrl = paymentUrl
    ? `${appUrl}/invoices`
    : `${appUrl}/invoices`;

  const amount = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(invoiceDoc.totalIncludingTax / 100);

  const companyResult = await getCompanyProfileByUserId(userId);
  const profile = companyResult.success
    ? (companyResult.profile as {
        companyName?: string | null;
        ownerName?: string | null;
        address?: string | null;
        streetNumber?: string | null;
        streetName?: string | null;
        postalCode?: string | null;
        city?: string | null;
        country?: string | null;
        phone?: string | null;
        businessEmail?: string | null;
        vatNumber?: string | null;
        logoUrl?: string | null;
      })
    : null;
  const companyName = profile?.companyName || profile?.ownerName || 'CRM';

  const totalExcludingTaxBeforeDiscount = invoiceDoc.lineItems.reduce(
    (sum, item) => sum + item.baseUnitPriceExcludingTax * item.quantity,
    0
  );
  const totalDiscountExcludingTax = invoiceDoc.lineItems.reduce(
    (sum, item) => sum + item.discountAmountExcludingTax,
    0
  );

  const invoicePdf = React.createElement(InvoicePdfTemplate, {
    invoice: {
      invoiceNumber: invoiceDoc.invoiceNumber,
      quoteNumber: invoiceDoc.quoteNumber ?? null,
      date: invoiceDoc.date ?? new Date(),
      dueDate: invoiceDoc.dueDate ?? null,
      clientSnapshot: extractClientSnapshot(invoiceDoc.clientSnapshot),
      lineItems: invoiceDoc.lineItems,
      totalExcludingTaxBeforeDiscount,
      totalDiscountExcludingTax,
      totalExcludingTax: invoiceDoc.totalExcludingTax,
      totalVat: invoiceDoc.totalVat,
      totalIncludingTax: invoiceDoc.totalIncludingTax,
      depositPercentage,
      notes: invoiceDoc.notes ?? null,
    },
    company: profile
      ? {
          companyName: profile.companyName ?? profile.ownerName ?? 'CRM',
          ownerName: profile.ownerName ?? null,
          address: profile.address ?? null,
          streetNumber: profile.streetNumber ?? null,
          streetName: profile.streetName ?? null,
          postalCode: profile.postalCode ?? null,
          city: profile.city ?? null,
          country: profile.country ?? null,
          phone: profile.phone ?? null,
          businessEmail: profile.businessEmail ?? null,
          vatNumber: profile.vatNumber ?? null,
          logoUrl: profile.logoUrl ?? null,
        }
      : null,
    paymentUrl: fallbackPaymentUrl,
    locale,
  }) as unknown as React.ReactElement<DocumentProps>;

  const pdfBuffer = await renderToBuffer(invoicePdf);

  await sendInvoice({
    to: recipient,
    clientName: invoiceDoc.clientSnapshot.fullName,
    invoiceNumber: invoiceDoc.invoiceNumber,
    paymentUrl: fallbackPaymentUrl,
    amount,
    companyName,
    pdfBuffer,
    locale,
  });

  return { ok: true, status: 200, message: 'Invoice reminder sent' };
}

export async function GET() {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const data = await buildSmartActions(me.user.id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error loading smart actions: ${String(error)}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      action?: string;
      quoteId?: string;
      invoiceId?: string;
      locale?: Locale;
    };

    if (body.action === 'create-invoice-from-quote') {
      const quoteId = body.quoteId?.trim();
      if (!quoteId) {
        return NextResponse.json({ success: false, message: 'quoteId is required' }, { status: 400 });
      }

      const result = await createInvoiceFromQuote(me.user.id, quoteId);
      return NextResponse.json(
        { success: result.ok, message: result.message, invoiceId: result.invoiceId, created: result.created },
        { status: result.status }
      );
    }

    if (body.action === 'send-invoice-reminder') {
      const invoiceId = body.invoiceId?.trim();
      if (!invoiceId) {
        return NextResponse.json({ success: false, message: 'invoiceId is required' }, { status: 400 });
      }

      const locale = resolveLocaleFromRequest(request, { rawLocale: body.locale }) as Locale;
      const result = await sendInvoiceReminder(me.user.id, invoiceId, locale);
      return NextResponse.json({ success: result.ok, message: result.message }, { status: result.status });
    }

    return NextResponse.json({ success: false, message: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error applying smart action: ${String(error)}` }, { status: 500 });
  }
}
