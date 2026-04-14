import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import { createActivityLog } from '@/db/repository/activity';
import { deleteQuoteById, getQuoteById, updateQuoteById } from '@/db/repository/quote';
import { buildQuoteConversation } from '@/lib/quote-conversation';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { updateQuoteSchema } from '@/validators/quote.schema';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const quote = await getQuoteById(me.user.id, id);

    if (!quote) {
      return NextResponse.json({ success: false, message: 'Quote not found' }, { status: 404 });
    }

    let convertedAt: Date | null = null;
    let convertedInvoiceNumber: string | null = null;

    if (quote.convertedToInvoice && quote.invoiceId) {
      await ConnectDb();
      const linkedInvoice = await Invoice.findOne({ _id: quote.invoiceId, userId: me.user.id })
        .select('invoiceNumber date createdAt')
        .lean<{ invoiceNumber?: string; date?: Date | null; createdAt?: Date | null } | null>();

      convertedInvoiceNumber = linkedInvoice?.invoiceNumber ?? null;
      convertedAt = linkedInvoice?.createdAt ?? linkedInvoice?.date ?? quote.updatedAt ?? null;
    }

    return NextResponse.json({
      success: true,
      data: {
        ...quote,
        conversationMessages: buildQuoteConversation(quote),
        clientId: String(quote.clientId),
        invoiceId: quote.invoiceId ? String(quote.invoiceId) : null,
        convertedToInvoice: Boolean(quote.convertedToInvoice),
        convertedAt,
        convertedInvoiceNumber,
        signedStatus: quote.signedStatus ?? 'not_signed',
        lineItems: quote.lineItems.map((line) => ({
          ...line,
          productId: line.productId ? String(line.productId) : null,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error loading quote: ${String(error)}` }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateQuoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const { id } = await params;
    const result = await updateQuoteById(me.user.id, id, parsed.data);

    if (result.kind === 'not-found') {
      return NextResponse.json({ success: false, message: 'Quote not found' }, { status: 404 });
    }

    if (result.kind === 'locked') {
      return NextResponse.json(
        {
          success: false,
          message: 'Accepted and refused quotes cannot be edited. Duplicate this quote to create a new one.',
        },
        { status: 403 }
      );
    }

    if (result.kind === 'client-not-found') {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }

    await createActivityLog(me.user.id, {
      action: 'quote_updated',
      entityType: 'quote',
      entityName: result.quote.quoteNumber,
      entityId: result.quote._id,
    });

    return NextResponse.json({ success: true, data: result.quote });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error updating quote: ${String(error)}` }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const deleted = await deleteQuoteById(me.user.id, id);
    if (!deleted) {
      return NextResponse.json({ success: false, message: 'Quote not found' }, { status: 404 });
    }

    await createActivityLog(me.user.id, {
      action: 'quote_deleted',
      entityType: 'quote',
      entityName: deleted.quoteNumber,
      entityId: deleted._id,
    });

    return NextResponse.json({ success: true, message: 'Quote deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error deleting quote: ${String(error)}` }, { status: 500 });
  }
}
