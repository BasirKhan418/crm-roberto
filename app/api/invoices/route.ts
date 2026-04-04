import mongoose from 'mongoose';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Client from '@/db/models/Client';
import Invoice from '@/db/models/Invoice';
import Quote from '@/db/models/Quote';
import { createActivityLog } from '@/db/repository/activity';
import { computeQuoteLine, computeQuoteTotalsFromComputedLines } from '@/lib/quote-calculations';
import { nextInvoiceNumber } from '@/lib/price';
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
  dueDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  depositPercentage: z.preprocess(toNumber, z.number().min(0).max(100).optional()).default(100),
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

async function getNextInvoiceNumberForYear(year: number): Promise<string> {
  const yearPrefix = `INV-${year}-`;
  const lastInvoice = await Invoice.findOne({
    invoiceNumber: { $regex: `^${yearPrefix}` },
  })
    .sort({ invoiceNumber: -1 })
    .select('invoiceNumber')
    .lean<{ invoiceNumber?: string } | null>();

  return nextInvoiceNumber(lastInvoice?.invoiceNumber ?? null, year);
}

function isInvoiceNumberDuplicateError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('E11000') && error.message.includes('invoiceNumber');
}

type CreatedInvoiceLike = {
  _id: mongoose.Types.ObjectId;
  invoiceNumber: string;
  dueDate?: Date | null;
};

async function createInvoiceWithUniqueNumber(
  year: number,
  payloadFactory: (invoiceNumber: string) => Record<string, unknown>
): Promise<CreatedInvoiceLike> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invoiceNumber = await getNextInvoiceNumberForYear(year);
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
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const isPastDue = Boolean(dueDate && Number.isFinite(dueDate.getTime()) && dueDate.getTime() < Date.now());

  if ((invoice.status === 'unpaid' || invoice.status === 'deposit_paid') && isPastDue) {
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

    const statusParam = request.nextUrl.searchParams.get('status');
    const searchParam = request.nextUrl.searchParams.get('search')?.trim();
    const sortParam = request.nextUrl.searchParams.get('sort');
    const pageParam = Number(request.nextUrl.searchParams.get('page') ?? '1');
    const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '10');

    const status =
      statusParam === 'unpaid' ||
      statusParam === 'deposit_paid' ||
      statusParam === 'paid' ||
      statusParam === 'overdue'
        ? statusParam
        : undefined;

    const sort: 'date' | 'amount' = sortParam === 'amount' ? 'amount' : 'date';
    const page = Number.isFinite(pageParam) ? Math.max(1, pageParam) : 1;
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(100, limitParam)) : 10;
    const skip = (page - 1) * limit;

    const now = new Date();
    const query: Record<string, unknown> = { userId: me.user.id };

    if (status) {
      if (status === 'overdue') {
        query.$or = [
          { status: 'overdue' },
          {
            status: { $in: ['unpaid', 'deposit_paid'] },
            dueDate: { $lt: now },
          },
        ];
      } else {
        query.status = status;
      }
    }

    if (searchParam) {
      const searchFilter = {
        $or: [
          { invoiceNumber: { $regex: searchParam, $options: 'i' } },
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
      sort === 'amount' ? { totalIncludingTax: -1, createdAt: -1 } : { date: -1, createdAt: -1 };

    const [items, total] = await Promise.all([
      Invoice.find(query).sort(sortSpec).skip(skip).limit(limit).lean(),
      Invoice.countDocuments(query),
    ]);

    const data = items.map((invoice) => {
      const normalized = withComputedInvoiceStatus(invoice);
      return {
        ...normalized,
        _id: String(normalized._id),
        quoteId: normalized.quoteId ? String(normalized.quoteId) : null,
        clientId: String(normalized.clientId),
        lineItems: normalized.lineItems.map((line) => ({
          ...line,
          productId: line.productId ? String(line.productId) : null,
        })),
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

      const currentYear = new Date().getFullYear();
      const invoice = await createInvoiceWithUniqueNumber(currentYear, (invoiceNumber) => ({
            userId,
            invoiceNumber,
            quoteId: quote._id,
            quoteNumber: quote.quoteNumber,
            date: new Date(),
            dueDate: parsed.data.dueDate ?? null,
            status: 'unpaid',
            clientId: quote.clientId,
            clientSnapshot: quote.clientSnapshot,
            lineItems: quote.lineItems,
            totalExcludingTax: quote.totalExcludingTax,
            totalVat: quote.totalVat,
            totalIncludingTax: quote.totalIncludingTax,
            depositPercentage: parsed.data.depositPercentage,
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

    if (!mongoose.Types.ObjectId.isValid(parsed.data.clientId)) {
      return NextResponse.json({ message: 'Client not found' }, { status: 404 });
    }

    const client = await Client.findOne({ _id: parsed.data.clientId, user: userId })
      .select('fullName email phone address companyName vatNumber')
      .lean<{
        _id: mongoose.Types.ObjectId;
        fullName: string;
        email?: string | null;
        phone?: string | null;
        address?: string | null;
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
    const invoice = await createInvoiceWithUniqueNumber(currentYear, (invoiceNumber) => ({
          userId,
          invoiceNumber,
          date: parsed.data.date ?? new Date(),
          dueDate: parsed.data.dueDate ?? null,
          status: 'unpaid',
          clientId: client._id,
          clientSnapshot: {
            fullName: client.fullName,
            email: client.email ?? null,
            phone: client.phone ?? null,
            address: client.address ?? null,
            companyName: client.companyName ?? null,
            vatNumber: client.vatNumber ?? null,
          },
          lineItems: computedLineItems,
          totalExcludingTax: totals.totalExcludingTax,
          totalVat: totals.totalVat,
          totalIncludingTax: totals.totalIncludingTax,
          depositPercentage: parsed.data.depositPercentage,
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
