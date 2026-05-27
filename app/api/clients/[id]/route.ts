import { NextRequest, NextResponse } from 'next/server';

import { createActivityLog, listClientActivities } from '@/db/repository/activity';
import {
  deleteClientById,
  getClientById,
  listClientTimelineNotes,
  updateClientById,
} from '@/db/repository/client';
import { listClientInteractions } from '@/db/repository/interaction';
import { listClientAttachments } from '@/db/repository/attachment';
import { getCompanyUserIdStrings } from '@/lib/company-scope';
import { requireModulePermission } from '@/lib/role-matrix';
import { parseListQuery } from '@/utils/api/query';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { updateClientSchema } from '@/validators/client.schema';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'clients', action: 'view' });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    const scopedUserIds = await getCompanyUserIdStrings({ companyId: me.user.companyId, fallbackUserId: me.user.id });
    const client = await getClientById(scopedUserIds, id);
    if (!client) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }

    const timelineOptions = parseListQuery(request.nextUrl.searchParams, {
      defaultSortBy: 'createdAt',
      allowedSortBy: ['createdAt'],
      defaultLimit: 10,
      maxLimit: 100,
    });

    const [timeline, interactions, attachments, activities] = await Promise.all([
      listClientTimelineNotes(scopedUserIds, id, {
        page: timelineOptions.page,
        limit: timelineOptions.limit,
        search: timelineOptions.search,
      }),
      listClientInteractions(me.user.id, id),
      listClientAttachments(me.user.id, id),
      listClientActivities(me.user.id, id),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        client,
        timeline: timeline.notes,
        interactions,
        attachments,
        activities,
      },
      pagination: timeline.pagination,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error fetching client detail: ${String(error)}` }, { status: 500 });
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
    const parsed = updateClientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'clients', action: 'edit' });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    const scopedUserIds = await getCompanyUserIdStrings({ companyId: me.user.companyId, fallbackUserId: me.user.id });
    const updated = await updateClientById(scopedUserIds, id, parsed.data);
    if (!updated) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }

    await createActivityLog(me.user.id, {
      action: 'client_updated',
      entityType: 'client',
      entityName: updated.fullName,
      entityId: updated._id,
    });

    return NextResponse.json({ success: true, message: 'Client updated successfully', data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error updating client: ${String(error)}` }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'clients', action: 'delete' });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    const scopedUserIds = await getCompanyUserIdStrings({ companyId: me.user.companyId, fallbackUserId: me.user.id });
    const existing = await getClientById(scopedUserIds, id);

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }

    const removed = await deleteClientById(scopedUserIds, id);
    if (!removed) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }

    await createActivityLog(me.user.id, {
      action: 'client_deleted',
      entityType: 'client',
      entityName: existing.fullName,
      entityId: existing._id,
    });

    return NextResponse.json({ success: true, message: 'Client deleted successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error deleting client: ${String(error)}` }, { status: 500 });
  }
}
