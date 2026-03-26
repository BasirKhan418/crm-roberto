import { NextRequest, NextResponse } from 'next/server';

import { createActivityLog, listActivities } from '@/db/repository/activity';
import { parseListQuery } from '@/utils/api/query';
import getMe from '@/utils/middlewares/useMe';
import { createActivitySchema } from '@/validators/activity.schema';

export async function GET(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const options = parseListQuery(request.nextUrl.searchParams, {
      defaultSortBy: 'createdAt',
      allowedSortBy: ['createdAt', 'updatedAt', 'action', 'entityType', 'entityName'],
      defaultLimit: 10,
      maxLimit: 100,
    });

    const result = await listActivities(me.user.id, options);

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error fetching activity logs: ${String(error)}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createActivitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 });
    }

    const created = await createActivityLog(me.user.id, parsed.data);

    return NextResponse.json({ success: true, message: 'Activity log created', data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error creating activity log: ${String(error)}` }, { status: 500 });
  }
}
