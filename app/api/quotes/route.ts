import { NextRequest, NextResponse } from 'next/server';

import { createActivityLog } from '@/db/repository/activity';
import { createQuote, listQuotes, type QuoteStatus } from '@/db/repository/quote';
import { getCompanyUserIdStrings } from '@/lib/company-scope';
import { requireModulePermission } from '@/lib/role-matrix';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { createQuoteSchema } from '@/validators/quote.schema';

export async function GET(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'quotes', action: 'view' });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    const statusParam = request.nextUrl.searchParams.get('status');
    const searchParam = request.nextUrl.searchParams.get('search')?.trim();
    const sortParam = request.nextUrl.searchParams.get('sort');
    const clientIdParam = request.nextUrl.searchParams.get('clientId')?.trim();
    const pageParam = Number(request.nextUrl.searchParams.get('page') ?? '1');
    const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '10');

    const status: QuoteStatus | undefined =
      statusParam === 'draft' || statusParam === 'sent' || statusParam === 'accepted' || statusParam === 'rejected'
        ? statusParam
        : statusParam === 'refused' || statusParam === 'refuse'
          ? 'rejected'
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

    const scopedUserIds = await getCompanyUserIdStrings({ companyId: me.user.companyId, fallbackUserId: me.user.id });
    const result = await listQuotes(scopedUserIds, {
      status: statusParam === 'pending' ? 'pending' : status,
      search: searchParam,
      sort,
      page,
      limit,
      clientId: clientIdParam || undefined,
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error fetching quotes: ${String(error)}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'quotes', action: 'create' });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    const body = await request.json();
    const parsed = createQuoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const result = await createQuote(me.user.id, parsed.data);
    if (result.kind === 'client-not-found') {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }

    await createActivityLog(me.user.id, {
      action: 'quote_created',
      entityType: 'quote',
      entityName: result.quote.quoteNumber,
      entityId: result.quote._id,
    });

    return NextResponse.json({ success: true, data: result.quote }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error creating quote: ${String(error)}` }, { status: 500 });
  }
}
