import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import Quote from '@/db/models/Quote';
import { createActivityLog } from '@/db/repository/activity';
import { deleteQuoteById, getQuoteById, updateQuoteById } from '@/db/repository/quote';
import { getCompanyUserIdStrings } from '@/lib/company-scope';
import { buildQuoteConversation } from '@/lib/quote-conversation';
import { requireModulePermission } from '@/lib/role-matrix';
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
    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'quotes', action: 'view' });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    const scopedUserIds = await getCompanyUserIdStrings({ companyId: me.user.companyId, fallbackUserId: me.user.id });
    const quote = await getQuoteById(scopedUserIds, id);

    if (!quote) {
      return NextResponse.json({ success: false, message: 'Quote not found' }, { status: 404 });
    }

    // Mark the quote as read by the owner. Fire-and-forget: we don't want
    // to block the detail page on this. Explicitly setting `ownerHasUnread`
    // tells the schema hook not to auto-flip it back to `true`.
    Quote.updateOne(
      { _id: quote._id, user: { $in: scopedUserIds } },
      { $set: { ownerHasUnread: false } },
      { timestamps: false, strict: false }
    ).catch(() => {
      // Silent: viewed-at tracking must not break the detail page.
    });

    let convertedAt: Date | null = null;
    let convertedInvoiceNumber: string | null = null;

    if (quote.convertedToInvoice && quote.invoiceId) {
      await ConnectDb();
      const linkedInvoice = await Invoice.findOne({ _id: quote.invoiceId, userId: { $in: scopedUserIds } })
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

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'quotes', action: 'edit' });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    const scopedUserIds = await getCompanyUserIdStrings({ companyId: me.user.companyId, fallbackUserId: me.user.id });
    const result = await updateQuoteById(scopedUserIds, id, parsed.data);

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

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'quotes', action: 'delete' });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    const scopedUserIds = await getCompanyUserIdStrings({ companyId: me.user.companyId, fallbackUserId: me.user.id });
    const deleted = await deleteQuoteById(scopedUserIds, id);
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
