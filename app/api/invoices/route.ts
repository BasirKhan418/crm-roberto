import mongoose from 'mongoose';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Client from '@/db/models/Client';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import Quote from '@/db/models/Quote';
import { createActivityLog } from '@/db/repository/activity';
import { ensureInvoiceIndexes } from '@/db/repository/ensureInvoiceIndexes';
import { getStartOfTomorrow, isInvoiceDueOnOrBeforeToday } from '@/lib/invoices/overdue';
import { getNextInvoiceNumberForYear, isInvoiceNumberDuplicateError } from '@/lib/invoice-number';
import { normalizeInvoiceNumberSearchTerm } from '@/lib/i18n/messages';
import { computeQuoteLine, computeQuoteTotalsFromComputedLines } from '@/lib/quote-calculations';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

const toNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
};

const baseInvoiceSchema = z.object({
  dueDate: z.preprocess(emptyToUndefined, z.coerce.date()),
  notes: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
});

const convertQuoteToInvoiceSchema = baseInvoiceSchema.extend({
  quoteId: objectIdSchema,
});

const standaloneInvoiceSchema = baseInvoiceSchema.extend({
  clientId: objectIdSchema,
  date: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  lineItems: z
    .array(
      z.object({
        productId: objectIdSchema.optional().nullable(),
        productImageUrl: z.preprocess(emptyToNull, z.string().trim().url().nullable().optional()),
        name: z.string().trim().min(1),
        quantity: z.preprocess(toNumber, z.number().min(1)),
        unitPriceExcludingTax: z.preprocess(toNumber, z.number().min(0)),
        baseUnitPriceExcludingTax: z.preprocess(toNumber, z.number().min(0).optional()),
        discountPercentage: z.preprocess(toNumber, z.number().min(0).max(100).optional()),
        vatRate: z.preprocess(toNumber, z.number().min(0).max(100)),
      })
    )
    .min(1),
});

type CreatedInvoiceLike = {
  _id: mongoose.Types.ObjectId;
  invoiceNumber: string;
  dueDate?: Date | null;
};

type InvoiceListQueryResult = {
  _id: mongoose.Types.ObjectId;
  invoiceNumber: string;
  quoteId?: mongoose.Types.ObjectId | null;
  quoteNumber?: string | null;
  date: Date;
  dueDate?: Date | null;
  status: string;
  totalExcludingTax: number;
  totalVat: number;
  totalIncludingTax: number;
  depositPercentage?: number | null;
  depositAmount?: number | null;
  recurrence?: {
    isActive?: boolean;
  } | null;
  reminderState?: {
    level?: number | null;
    lastSentAt?: Date | null;
    nextScheduledAt?: Date | null;
    isPaused?: boolean;
  } | null;
  clientId: mongoose.Types.ObjectId;
  clientSnapshot: {
    fullName: string;
    email?: string | null;
  };
};

type PaymentTimelineItem = {
  invoiceId: mongoose.Types.ObjectId;
  amount: number;
  paidAt?: Date | null;
  createdAt?: Date | null;
};

function getInvoiceDepositTarget(invoice: {
  depositPercentage?: number | null;
  depositAmount?: number | null;
  totalIncludingTax?: number | null;
}): number {
  const invoiceTotal = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0));
  const depositPercentage = typeof invoice.depositPercentage === 'number' ? invoice.depositPercentage : 100;
  const configuredDeposit = Math.max(0, Math.round(invoice.depositAmount ?? 0));

  if (invoiceTotal <= 0 || depositPercentage >= 100 || configuredDeposit <= 0) {
    return 0;
  }

  return Math.min(configuredDeposit, invoiceTotal - 1);
}

async function createInvoiceWithUniqueNumber(
  userId: string,
  year: number,
  payloadFactory: (invoiceNumber: string) => Record<string, unknown>
): Promise<CreatedInvoiceLike> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invoiceNumber = await getNextInvoiceNumberForYear(userId, year);
    try {
      const created = await Invoice.create(payloadFactory(invoiceNumber));
      return created as unknown as CreatedInvoiceLike;
    } catch (creationError) {
      if (!isInvoiceNumberDuplicateError(creationError) || attempt === 4) {
        throw creationError;
      }
    }
  }

  throw new Error('Could not generate a unique invoice number');
}

function withComputedInvoiceStatus<T extends { status: string; dueDate?: Date | string | null }>(invoice: T): T {
  if (
    invoice.status === 'unpaid' ||
    invoice.status === 'partial_paid'
  ) {
    if (!isInvoiceDueOnOrBeforeToday(invoice.dueDate)) {
      return invoice;
    }

    return {
      ...invoice,
      status: 'overdue',
    };
  }

  return invoice;
}

export async function GET(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    await ConnectDb();
    await ensureInvoiceIndexes();

    const statusParam = request.nextUrl.searchParams.get('status');
    const searchParam = request.nextUrl.searchParams.get('search')?.trim();
    const sortParam = request.nextUrl.searchParams.get('sort');
    const clientIdParam = request.nextUrl.searchParams.get('clientId')?.trim();
    const pageParam = Number(request.nextUrl.searchParams.get('page') ?? '1');
    const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '10');

    const status =
      statusParam === 'unpaid' ||
      statusParam === 'partial_paid' ||
      statusParam === 'paid' ||
      statusParam === 'overdue'
        ? statusParam
        : statusParam === 'deposit_paid' || statusParam === 'initial_paid'
          ? 'partial_paid'
        : undefined;

    const sort: 'number_desc' | 'number_asc' | 'date' | 'amount' =
      sortParam === 'number_asc'
        ? 'number_asc'
        : sortParam === 'date'
          ? 'date'
          : sortParam === 'amount'
            ? 'amount'
            : 'number_desc';
    const page = Number.isFinite(pageParam) ? Math.max(1, pageParam) : 1;
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(100, limitParam)) : 10;
    const skip = (page - 1) * limit;

    if (clientIdParam && !objectIdSchema.safeParse(clientIdParam).success) {
      return NextResponse.json({ success: false, message: 'Invalid client id' }, { status: 400 });
    }

    const tomorrowStart = getStartOfTomorrow();
    const query: Record<string, unknown> = { userId: me.user.id };

    if (clientIdParam) {
      query.clientId = new mongoose.Types.ObjectId(clientIdParam);
    }

    if (status) {
      if (status === 'overdue') {
        query.$or = [
          { status: 'overdue' },
          {
            status: { $in: ['unpaid', 'partial_paid'] },
                    dueDate: { $lt: tomorrowStart },
          },
        ];
      } else if (status === 'partial_paid') {
        query.status = 'partial_paid';
      } else {
        query.status = status;
      }
    }

    // Sidebar badges opt in to this flag so "unpaid" and "partial_paid" counts
    // exclude invoices that are already surfaced in the "overdue" bucket,
    // keeping the three badges mutually exclusive.
    const excludeOverdueParam = request.nextUrl.searchParams.get('excludeOverdue');
    if (
      excludeOverdueParam === 'true' &&
      (status === 'unpaid' || status === 'partial_paid')
    ) {
      query.$and = [
        ...((query.$and as unknown[] | undefined) ?? []),
        {
          $and: [
            { status: { $ne: 'overdue' } },
            { $or: [{ dueDate: null }, { dueDate: { $exists: false } }, { dueDate: { $gte: tomorrowStart } }] },
          ],
        },
      ];
    }

    if (searchParam) {
      const normalizedInvoiceSearch = normalizeInvoiceNumberSearchTerm(searchParam);
      const invoiceNumberSearchTerms = Array.from(new Set([searchParam, normalizedInvoiceSearch]));
      const searchFilter = {
        $or: [
          ...invoiceNumberSearchTerms.map((value) => ({ invoiceNumber: { $regex: value, $options: 'i' } })),
          { 'clientSnapshot.fullName': { $regex: searchParam, $options: 'i' } },
        ],
      };

      if (query.$or) {
        query.$and = [searchFilter, { $or: query.$or as unknown[] }];
        delete query.$or;
      } else {
        query.$or = searchFilter.$or;
      }
    }

    const sortSpec: Record<string, 1 | -1> =
      sort === 'number_asc'
        ? { invoiceNumberYear: 1, invoiceNumberSequence: 1, createdAt: 1 }
        : sort === 'amount'
          ? { totalIncludingTax: -1, createdAt: -1 }
          : sort === 'date'
            ? { date: -1, createdAt: -1 }
            : { invoiceNumberYear: -1, invoiceNumberSequence: -1, createdAt: -1 };

    const [items, total] = await Promise.all([
      Invoice.find(query)
        .select(
          '_id invoiceNumber quoteId quoteNumber date dueDate status totalExcludingTax totalVat totalIncludingTax depositPercentage depositAmount recurrence.isActive reminderState clientId clientSnapshot.fullName clientSnapshot.email'
        )
        .sort(sortSpec)
        .skip(skip)
        .limit(limit)
        .lean<InvoiceListQueryResult[]>(),
      Invoice.countDocuments(query),
    ]);

    const depositTargetByInvoiceId = new Map<string, number>();
    const paymentInvoiceIds: mongoose.Types.ObjectId[] = [];

    for (const invoice of items) {
      paymentInvoiceIds.push(invoice._id);

      const depositTarget = getInvoiceDepositTarget(invoice);
      if (depositTarget <= 0) {
        continue;
      }

      depositTargetByInvoiceId.set(String(invoice._id), depositTarget);
    }

    const depositPaidAtByInvoiceId = new Map<string, Date | null>();
    const totalPaidByInvoiceId = new Map<string, number>();

    if (paymentInvoiceIds.length > 0) {
      const paymentTimeline = await Payment.find({
        userId: me.user.id,
        invoiceId: { $in: paymentInvoiceIds },
        status: 'succeeded',
      })
        .select('invoiceId amount paidAt createdAt')
        .sort({ paidAt: 1, createdAt: 1, _id: 1 })
        .lean<PaymentTimelineItem[]>();

      for (const payment of paymentTimeline) {
        const invoiceId = String(payment.invoiceId);
        const paymentAmount = Math.max(0, Math.round(payment.amount ?? 0));
        const nextPaidAmount = (totalPaidByInvoiceId.get(invoiceId) ?? 0) + paymentAmount;
        totalPaidByInvoiceId.set(invoiceId, nextPaidAmount);

        const depositTarget = depositTargetByInvoiceId.get(invoiceId);
        if (!depositTarget || depositPaidAtByInvoiceId.has(invoiceId)) {
          continue;
        }

        if (nextPaidAmount >= depositTarget) {
          depositPaidAtByInvoiceId.set(invoiceId, payment.paidAt ?? payment.createdAt ?? null);
        }
      }
    }

    const data = items.map((invoice) => {
      const normalized = withComputedInvoiceStatus(invoice);
      const invoiceId = String(normalized._id);
      const depositTarget = depositTargetByInvoiceId.get(invoiceId) ?? 0;
      const totalInvoiceAmount = Math.max(0, Math.round(normalized.totalIncludingTax ?? 0));
      const amountPaid = Math.max(0, totalPaidByInvoiceId.get(invoiceId) ?? 0);
      const remainingAmount = Math.max(0, totalInvoiceAmount - amountPaid);
      const paymentProgressPercent =
        totalInvoiceAmount > 0 ? Math.min(100, Math.round((amountPaid / totalInvoiceAmount) * 100)) : 0;

      return {
        ...normalized,
        _id: invoiceId,
        quoteId: normalized.quoteId ? String(normalized.quoteId) : null,
        clientId: String(normalized.clientId),
        depositAmount: depositTarget > 0 ? depositTarget : null,
        depositPaidAt: depositTarget > 0 ? depositPaidAtByInvoiceId.get(invoiceId) ?? null : null,
        recurrence: {
          isActive: normalized.recurrence?.isActive === true,
        },
        reminderState: {
          level: Number.isFinite(normalized.reminderState?.level)
            ? Math.max(0, Math.min(4, Math.round(Number(normalized.reminderState?.level))))
            : 0,
          lastSentAt: normalized.reminderState?.lastSentAt
            ? new Date(normalized.reminderState.lastSentAt).toISOString()
            : null,
          nextScheduledAt: normalized.reminderState?.nextScheduledAt
            ? new Date(normalized.reminderState.nextScheduledAt).toISOString()
            : null,
          isPaused: normalized.reminderState?.isPaused === true,
        },
        amountPaid,
        remainingAmount,
        paymentProgressPercent,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error fetching invoices: ${String(error)}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ message: me.message || 'Unauthorized' }, { status: 401 });
    }
    const userId = me.user.id;

    const body = await request.json();
    const shouldConvertFromQuote = typeof body?.quoteId === 'string' && body.quoteId.trim().length > 0;

    if (shouldConvertFromQuote) {
      const parsed = convertQuoteToInvoiceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
      }

      await ConnectDb();
      await ensureInvoiceIndexes();

      const quote = await Quote.findOne({ _id: parsed.data.quoteId, user: userId });
      if (!quote) {
        return NextResponse.json({ message: 'Quote not found' }, { status: 404 });
      }

      if (quote.signedStatus !== 'signed') {
        return NextResponse.json({ message: 'Only signed quotes can be converted to invoices' }, { status: 422 });
      }

      if (quote.convertedToInvoice || quote.invoiceId) {
        return NextResponse.json({ message: 'This quote has already been converted to an invoice' }, { status: 409 });
      }

      const existingInvoice = await Invoice.findOne({ userId, quoteId: quote._id }).select('_id');
      if (existingInvoice) {
        quote.convertedToInvoice = true;
        quote.invoiceId = existingInvoice._id;
        await quote.save();
        return NextResponse.json({ message: 'This quote has already been converted to an invoice' }, { status: 409 });
      }

      const sourceClient = await Client.findOne({ _id: quote.clientId, user: userId })
        .select('billingEmail email')
        .lean<{ billingEmail?: string | null; email?: string | null } | null>();

      const preferredInvoiceEmail = sourceClient?.billingEmail ?? sourceClient?.email ?? quote.clientSnapshot.email ?? null;

      const currentYear = new Date().getFullYear();
      const invoice = await createInvoiceWithUniqueNumber(userId, currentYear, (invoiceNumber) => ({
            userId,
            invoiceNumber,
            quoteId: quote._id,
            quoteNumber: quote.quoteNumber,
            date: new Date(),
            dueDate: parsed.data.dueDate ?? null,
            status: 'unpaid',
            clientId: quote.clientId,
            clientSnapshot: {
              ...quote.clientSnapshot,
              email: preferredInvoiceEmail,
            },
            lineItems: quote.lineItems,
            totalExcludingTax: quote.totalExcludingTax,
            totalVat: quote.totalVat,
            totalIncludingTax: quote.totalIncludingTax,
            notes: parsed.data.notes ?? quote.notes ?? null,
          }));

      quote.convertedToInvoice = true;
      quote.invoiceId = invoice._id;
      await quote.save();

      await createActivityLog(userId, {
        action: 'invoice_created',
        entityType: 'invoice',
        entityName: invoice.invoiceNumber,
        entityId: String(invoice._id),
        metadata: {
          source: 'quote_conversion',
          quoteNumber: quote.quoteNumber,
          dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : null,
        },
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            _id: String(invoice._id),
            invoiceNumber: invoice.invoiceNumber,
          },
        },
        { status: 201 }
      );
    }

    const parsed = standaloneInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    await ConnectDb();
    await ensureInvoiceIndexes();

    if (!mongoose.Types.ObjectId.isValid(parsed.data.clientId)) {
      return NextResponse.json({ message: 'Client not found' }, { status: 404 });
    }

    const client = await Client.findOne({ _id: parsed.data.clientId, user: userId })
      .select('fullName email billingEmail phone address addressDetails companyName vatNumber')
      .lean<{
        _id: mongoose.Types.ObjectId;
        fullName: string;
        email?: string | null;
        billingEmail?: string | null;
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
      } | null>();

    if (!client) {
      return NextResponse.json({ message: 'Client not found' }, { status: 404 });
    }

    const computedLineItems = parsed.data.lineItems.map((item) => {
      const computed = computeQuoteLine({
        quantity: item.quantity,
        unitPriceExcludingTax: item.unitPriceExcludingTax,
        baseUnitPriceExcludingTax: item.baseUnitPriceExcludingTax,
        discountPercentage: item.discountPercentage,
        vatRate: item.vatRate,
      });

      return {
        productId: item.productId ? new mongoose.Types.ObjectId(item.productId) : null,
        productImageUrl: item.productImageUrl ?? null,
        name: item.name,
        quantity: computed.quantity,
        unitPriceExcludingTax: computed.unitPriceExcludingTax,
        baseUnitPriceExcludingTax: computed.baseUnitPriceExcludingTax,
        discountPercentage: computed.discountPercentage,
        vatRate: computed.vatRate,
        totalExcludingTaxBeforeDiscount: computed.totalExcludingTaxBeforeDiscount,
        discountAmountExcludingTax: computed.discountAmountExcludingTax,
        totalExcludingTax: computed.totalExcludingTax,
        vatAmount: computed.vatAmount,
        totalIncludingTax: computed.totalIncludingTax,
      };
    });

    const totals = computeQuoteTotalsFromComputedLines(computedLineItems);
    const currentYear = new Date().getFullYear();
    const invoice = await createInvoiceWithUniqueNumber(userId, currentYear, (invoiceNumber) => ({
          userId,
          invoiceNumber,
          date: parsed.data.date ?? new Date(),
          dueDate: parsed.data.dueDate ?? null,
          status: 'unpaid',
          clientId: client._id,
          clientSnapshot: {
            fullName: client.fullName,
            email: client.billingEmail ?? client.email ?? null,
            phone: client.phone ?? null,
            address: client.address ?? null,
            addressDetails: client.addressDetails ?? null,
            companyName: client.companyName ?? null,
            vatNumber: client.vatNumber ?? null,
          },
          lineItems: computedLineItems,
          totalExcludingTax: totals.totalExcludingTax,
          totalVat: totals.totalVat,
          totalIncludingTax: totals.totalIncludingTax,
          notes: parsed.data.notes ?? null,
        }));

    await createActivityLog(userId, {
      action: 'invoice_created',
      entityType: 'invoice',
      entityName: invoice.invoiceNumber,
      entityId: String(invoice._id),
      metadata: {
        source: 'standalone',
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          _id: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ message: `Error creating invoice: ${String(error)}` }, { status: 500 });
  }
}
