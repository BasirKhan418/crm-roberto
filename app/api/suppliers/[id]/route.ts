import { NextRequest, NextResponse } from 'next/server';

import { createActivityLog } from '@/db/repository/activity';
import {
  deleteSupplierById,
  getSupplierById,
  listSupplierTimelineNotes,
  updateSupplierById,
} from '@/db/repository/supplier';
import { getCompanyUserIdStrings } from '@/lib/company-scope';
import { requireModulePermission } from '@/lib/role-matrix';
import { parseListQuery } from '@/utils/api/query';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { updateSupplierSchema } from '@/validators/supplier.schema';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'suppliers', action: 'view' });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    const { id } = await params;
    const scopedUserIds = await getCompanyUserIdStrings({ companyId: me.user.companyId, fallbackUserId: me.user.id });

    const supplier = await getSupplierById(scopedUserIds, id);
    if (!supplier) {
      return NextResponse.json({ success: false, message: 'Supplier not found' }, { status: 404 });
    }

    const timelineOptions = parseListQuery(request.nextUrl.searchParams, {
      defaultSortBy: 'createdAt',
      allowedSortBy: ['createdAt'],
      defaultLimit: 10,
      maxLimit: 100,
    });

    const timeline = await listSupplierTimelineNotes(scopedUserIds, id, {
      page: timelineOptions.page,
      limit: timelineOptions.limit,
      search: timelineOptions.search,
    });

    return NextResponse.json({
      success: true,
      data: {
        supplier,
        timeline: timeline.notes,
      },
      pagination: timeline.pagination,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error fetching supplier detail: ${String(error)}` }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'suppliers', action: 'edit' });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    const { id } = await params;
    const scopedUserIds = await getCompanyUserIdStrings({ companyId: me.user.companyId, fallbackUserId: me.user.id });
    const body = await request.json();
    const parsed = updateSupplierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const updated = await updateSupplierById(scopedUserIds, id, parsed.data);
    if (!updated) {
      return NextResponse.json({ success: false, message: 'Supplier not found' }, { status: 404 });
    }

    await createActivityLog(me.user.id, {
      action: 'supplier_updated',
      entityType: 'supplier',
      entityName: updated.fullName,
      entityId: updated._id,
    });

    return NextResponse.json({ success: true, message: 'Supplier updated successfully', data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error updating supplier: ${String(error)}` }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'suppliers', action: 'delete' });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    const { id } = await params;
    const scopedUserIds = await getCompanyUserIdStrings({ companyId: me.user.companyId, fallbackUserId: me.user.id });
    const existing = await getSupplierById(scopedUserIds, id);

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Supplier not found' }, { status: 404 });
    }

    const removed = await deleteSupplierById(scopedUserIds, id);
    if (!removed) {
      return NextResponse.json({ success: false, message: 'Supplier not found' }, { status: 404 });
    }

    await createActivityLog(me.user.id, {
      action: 'supplier_deleted',
      entityType: 'supplier',
      entityName: existing.fullName,
      entityId: existing._id,
    });

    return NextResponse.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error deleting supplier: ${String(error)}` }, { status: 500 });
  }
}
