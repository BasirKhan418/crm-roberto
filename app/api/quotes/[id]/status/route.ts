import { NextRequest, NextResponse } from 'next/server';

import { createActivityLog } from '@/db/repository/activity';
import { updateQuoteStatusById } from '@/db/repository/quote';
import { getCompanyUserIdStrings } from '@/lib/company-scope';
import { requireModulePermission } from '@/lib/role-matrix';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { updateQuoteStatusSchema } from '@/validators/quote.schema';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'quotes', action: 'manage' });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    const body = await request.json();
    const parsed = updateQuoteStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const { id } = await params;
    const scopedUserIds = await getCompanyUserIdStrings({ companyId: me.user.companyId, fallbackUserId: me.user.id });
    const result = await updateQuoteStatusById(scopedUserIds, id, parsed.data);

    if (result.kind === 'not-found') {
      return NextResponse.json({ success: false, message: 'Quote not found' }, { status: 404 });
    }

    if (result.kind === 'invalid-transition') {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot change status from "${result.from}" to "${result.to}"`,
        },
        { status: 422 }
      );
    }

    await createActivityLog(me.user.id, {
      action: 'quote_status_changed',
      entityType: 'quote',
      entityName: result.quote.quoteNumber,
      entityId: result.quote._id,
      metadata: {
        from: result.from,
        to: result.to,
      },
    });

    return NextResponse.json({ success: true, data: result.quote });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error changing quote status: ${String(error)}` }, { status: 500 });
  }
}
