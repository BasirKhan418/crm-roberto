import { NextRequest, NextResponse } from 'next/server';

import { createActivityLog } from '@/db/repository/activity';
import { deleteQuoteById, updateQuoteById } from '@/db/repository/quote';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { updateQuoteSchema } from '@/validators/quote.schema';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return NextResponse.json({ success: false, message: `Quote detail route not implemented yet for id ${id}.` }, { status: 501 });
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
