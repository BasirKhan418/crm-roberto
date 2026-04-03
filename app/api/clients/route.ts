import { NextRequest, NextResponse } from 'next/server';

import { createActivityLog } from '@/db/repository/activity';
import { createClient, listClients } from '@/db/repository/client';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { createClientSchema } from '@/validators/client.schema';
import { parseListQuery } from '@/utils/api/query';

export async function GET(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const options = parseListQuery(request.nextUrl.searchParams, {
      defaultSortBy: 'createdAt',
      allowedSortBy: ['createdAt', 'updatedAt', 'fullName', 'email', 'companyName'],
      defaultLimit: 10,
      maxLimit: 100,
    });

    const clientTypeRaw = request.nextUrl.searchParams.get('clientType');
    const clientType = (clientTypeRaw === 'company' || clientTypeRaw === 'individual') ? clientTypeRaw : undefined;

    const result = await listClients(me.user.id, options, clientType);

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error fetching clients: ${String(error)}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createClientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const created = await createClient(me.user.id, parsed.data);

    await createActivityLog(me.user.id, {
      action: 'client_created',
      entityType: 'client',
      entityName: created.fullName,
      entityId: created._id,
    });

    return NextResponse.json({ success: true, message: 'Client created successfully', data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error creating client: ${String(error)}` }, { status: 500 });
  }
}
