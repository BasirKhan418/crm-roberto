import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Client from '@/db/models/Client';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import Quote from '@/db/models/Quote';
import { buildUserScopeQuery, getCompanyUserObjectIds } from '@/lib/company-scope';
import { computeQuoteLine, computeQuoteTotalsFromComputedLines } from '@/lib/quote-calculations';
import { isInvoiceDueOnOrBeforeToday } from '@/lib/invoices/overdue';
import { requireModulePermission } from '@/lib/role-matrix';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { updateInvoiceSchema } from '@/validators/invoice.schema';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function withComputedInvoiceStatus<T extends { status: string; dueDate?: Date | string | null }>(invoice: T): T {
  if (
    (invoice.status === 'unpaid' || invoice.status === 'partial_paid') &&
    isInvoiceDueOnOrBeforeToday(invoice.dueDate)
  ) {
    return {
      ...invoice,
      status: 'overdue',
    };
  }

  return invoice;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'invoices', action: 'view' });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    await ConnectDb();
    const scopedUserObjectIds = await getCompanyUserObjectIds({ companyId: me.user.companyId, fallbackUserId: me.user.id });
    const userScope = buildUserScopeQuery('userId', scopedUserObjectIds);
    const linkedEntityUserScope = buildUserScopeQuery('user', scopedUserObjectIds);

    const invoice = await Invoice.findOne({ _id: id, ...userScope }).lean();
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    // Mark the invoice as read by the owner. Fire-and-forget. Explicitly
    // setting `ownerHasUnread` tells the schema hook not to auto-flip it
    // back to `true`.
    Invoice.updateOne(
      { _id: invoice._id, ...userScope },
      { $set: { ownerHasUnread: false } },
      { timestamps: false, strict: false }
    ).catch(() => {
      // Silent: viewed-at tracking must not break the detail page.
    });

    const normalized = withComputedInvoiceStatus(invoice);
    const client = await Client.findOne({ _id: normalized.clientId, ...linkedEntityUserScope })
      .select('billingEmail')
      .lean<{ billingEmail?: string | null } | null>();

    return NextResponse.json({
      success: true,
      data: {
        ...normalized,
        clientBillingEmail: client?.billingEmail ?? null,
        _id: String(normalized._id),
        quoteId: normalized.quoteId ? String(normalized.quoteId) : null,
        clientId: String(normalized.clientId),
        lineItems: normalized.lineItems.map((line) => ({
          ...line,
          productId: line.productId ? String(line.productId) : null,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error loading invoice: ${String(error)}` }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'invoices', action: 'edit' });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    await ConnectDb();
    const scopedUserObjectIds = await getCompanyUserObjectIds({ companyId: me.user.companyId, fallbackUserId: me.user.id });
    const userScope = buildUserScopeQuery('userId', scopedUserObjectIds);
    const linkedEntityUserScope = buildUserScopeQuery('user', scopedUserObjectIds);

    const payload: {
      subject?: string | null;
      notes?: string | null;
      dueDate?: Date | null;
      lineItems?: Array<{
        lineType: 'catalog' | 'custom' | 'free_text' | 'item';
        productId: mongoose.Types.ObjectId | null;
        productImageUrl: string | null;
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
      totalExcludingTax?: number;
      totalVat?: number;
      totalIncludingTax?: number;
      legalRecoveryCourtLocation?: 'luxembourg' | 'esch_sur_alzette' | 'diekirch' | null;
    } = {};

    if ('subject' in parsed.data) {
      payload.subject = parsed.data.subject ?? null;
    }
    if ('notes' in parsed.data) {
      payload.notes = parsed.data.notes ?? null;
    }
    if ('dueDate' in parsed.data) {
      payload.dueDate = parsed.data.dueDate ?? null;
    }
    if ('lineItems' in parsed.data && parsed.data.lineItems) {
      const computedLineItems = parsed.data.lineItems.map((item) => {
        if (item.lineType === 'free_text') {
          return {
            lineType: 'free_text' as const,
            productId: null,
            productImageUrl: null,
            name: item.name,
            quantity: 1,
            unitPriceExcludingTax: 0,
            baseUnitPriceExcludingTax: 0,
            discountPercentage: 0,
            vatRate: 0,
            totalExcludingTaxBeforeDiscount: 0,
            discountAmountExcludingTax: 0,
            totalExcludingTax: 0,
            vatAmount: 0,
            totalIncludingTax: 0,
          };
        }

        const computed = computeQuoteLine({
          quantity: item.quantity,
          unitPriceExcludingTax: item.unitPriceExcludingTax,
          baseUnitPriceExcludingTax: item.baseUnitPriceExcludingTax,
          discountPercentage: item.discountPercentage,
          vatRate: item.vatRate,
        });

        return {
          lineType: (item.lineType === 'catalog' ? 'catalog' : item.lineType === 'item' ? 'item' : 'custom') as 'catalog' | 'custom' | 'item',
          productId: item.lineType === 'catalog' && item.productId ? new mongoose.Types.ObjectId(item.productId) : null,
          productImageUrl: item.lineType === 'catalog' ? item.productImageUrl ?? null : null,
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

      payload.lineItems = computedLineItems;
      payload.totalExcludingTax = totals.totalExcludingTax;
      payload.totalVat = totals.totalVat;
      payload.totalIncludingTax = totals.totalIncludingTax;
    }
    if ('legalRecoveryCourtLocation' in parsed.data) {
      payload.legalRecoveryCourtLocation = parsed.data.legalRecoveryCourtLocation ?? null;
    }
    const existing = await Invoice.findOne({ _id: id, ...userScope }).select('status quoteId sentAt').lean();

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const updatesEditableFields = 'subject' in parsed.data || 'notes' in parsed.data || 'dueDate' in parsed.data || 'lineItems' in parsed.data;
    const isQuoteBasedInvoice = Boolean(existing.quoteId);
    const isSentInvoice = Boolean(existing.sentAt);
    const isEditableManualInvoice = !isQuoteBasedInvoice && !isSentInvoice;
    if (updatesEditableFields && !isEditableManualInvoice) {
      return NextResponse.json(
        { success: false, message: 'Only unsent manual invoices can be edited.' },
        { status: 403 }
      );
    }

    if ('legalRecoveryCourtLocation' in parsed.data && existing.status === 'paid') {
      return NextResponse.json(
        { success: false, message: 'Paid invoices cannot be used for legal recovery.' },
        { status: 403 }
      );
    }

    const updated = await Invoice.findOneAndUpdate(
      { _id: id, ...userScope },
      payload,
      { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const normalized = withComputedInvoiceStatus(updated);
    const client = await Client.findOne({ _id: normalized.clientId, ...linkedEntityUserScope })
      .select('billingEmail')
      .lean<{ billingEmail?: string | null } | null>();

    return NextResponse.json({
      success: true,
      data: {
        ...normalized,
        clientBillingEmail: client?.billingEmail ?? null,
        _id: String(normalized._id),
        quoteId: normalized.quoteId ? String(normalized.quoteId) : null,
        clientId: String(normalized.clientId),
        lineItems: normalized.lineItems.map((line) => ({
          ...line,
          productId: line.productId ? String(line.productId) : null,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error updating invoice: ${String(error)}` }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'invoices', action: 'delete' });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    await ConnectDb();
    const scopedUserObjectIds = await getCompanyUserObjectIds({ companyId: me.user.companyId, fallbackUserId: me.user.id });
    const userScope = buildUserScopeQuery('userId', scopedUserObjectIds);
    const linkedEntityUserScope = buildUserScopeQuery('user', scopedUserObjectIds);

    const invoice = await Invoice.findOne({ _id: id, ...userScope }).select('_id quoteId invoiceNumber').lean();
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    await Invoice.deleteOne({ _id: invoice._id, ...userScope });
    await Payment.deleteMany({ invoiceId: invoice._id, ...userScope });

    await Quote.updateMany(
      {
        ...linkedEntityUserScope,
        $or: [
          ...(invoice.quoteId ? [{ _id: invoice.quoteId }] : []),
          { invoiceId: invoice._id },
        ],
      },
      { $set: { convertedToInvoice: false, invoiceId: null, invoicepdfUrl: null } }
    );

    return NextResponse.json({ success: true, message: 'Invoice deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error deleting invoice: ${String(error)}` }, { status: 500 });
  }
}
