import { NextRequest, NextResponse } from 'next/server';

import {
  deleteActivityById,
  getActivityById,
  updateActivityById,
} from '@/db/repository/activity';
import getMe from '@/utils/middlewares/useMe';
import { updateActivitySchema } from '@/validators/activity.schema';

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
    const item = await getActivityById(me.user.id, id);

    if (!item) {
      return NextResponse.json({ success: false, message: 'Activity log not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error fetching activity log: ${String(error)}` }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateActivitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 });
    }

    const updated = await updateActivityById(me.user.id, id, parsed.data);
    if (!updated) {
      return NextResponse.json({ success: false, message: 'Activity log not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Activity log updated', data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error updating activity log: ${String(error)}` }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const removed = await deleteActivityById(me.user.id, id);

    if (!removed) {
      return NextResponse.json({ success: false, message: 'Activity log not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Activity log deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error deleting activity log: ${String(error)}` }, { status: 500 });
  }
}
