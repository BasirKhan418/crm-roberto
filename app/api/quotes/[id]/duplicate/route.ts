import { NextRequest, NextResponse } from 'next/server';

import { createActivityLog } from '@/db/repository/activity';
import { duplicateQuoteById } from '@/db/repository/quote';
import getMe from '@/utils/middlewares/useMe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await duplicateQuoteById(me.user.id, id);

    if (result.kind === 'not-found') {
      return NextResponse.json({ success: false, message: 'Quote not found' }, { status: 404 });
    }

    // Activity log should not block duplication if a stale runtime model is loaded.
    try {
      await createActivityLog(me.user.id, {
        action: 'quote_duplicated',
        entityType: 'quote',
        entityName: result.quote.quoteNumber,
        entityId: result.quote._id,
        metadata: {
          sourceQuoteId: result.sourceQuoteId,
        },
      });
    } catch (activityError) {
      console.warn('Quote duplicated, but activity log failed:', activityError);
    }

    return NextResponse.json({ success: true, data: result.quote }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error duplicating quote: ${String(error)}` }, { status: 500 });
  }
}
