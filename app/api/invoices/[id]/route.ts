import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import Quote from '@/db/models/Quote';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { updateInvoiceSchema } from '@/validators/invoice.schema';

interface RouteParams {
  params: Promise<{ id: string }>;
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

    await ConnectDb();

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id }).lean();
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const normalized = withComputedInvoiceStatus(invoice);

    return NextResponse.json({
      success: true,
      data: {
        ...normalized,
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

    await ConnectDb();

    const payload: {
      notes?: string | null;
      dueDate?: Date | null;
      depositPercentage?: number;
    } = {};

    if ('notes' in parsed.data) {
      payload.notes = parsed.data.notes ?? null;
    }
    if ('dueDate' in parsed.data) {
      payload.dueDate = parsed.data.dueDate ?? null;
    }
    if (typeof parsed.data.depositPercentage === 'number') {
      payload.depositPercentage = parsed.data.depositPercentage;
    }

    const updated = await Invoice.findOneAndUpdate(
      { _id: id, userId: me.user.id },
      payload,
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const normalized = withComputedInvoiceStatus(updated);
    return NextResponse.json({
      success: true,
      data: {
        ...normalized,
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

    await ConnectDb();

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id }).select('_id quoteId invoiceNumber').lean();
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    await Invoice.deleteOne({ _id: invoice._id, userId: me.user.id });

    if (invoice.quoteId) {
      await Quote.updateOne(
        { _id: invoice.quoteId, user: me.user.id },
        { $set: { convertedToInvoice: false, invoiceId: null } }
      );
    }

    return NextResponse.json({ success: true, message: 'Invoice deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error deleting invoice: ${String(error)}` }, { status: 500 });
  }
}
