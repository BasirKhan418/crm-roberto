import { NextRequest, NextResponse } from 'next/server';

import { createActivityLog } from '@/db/repository/activity';
import { createSupplier, listSuppliers } from '@/db/repository/supplier';
import { getCompanyUserIdStrings } from '@/lib/company-scope';
import { requireModulePermission } from '@/lib/role-matrix';
import { parseListQuery } from '@/utils/api/query';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { createSupplierSchema } from '@/validators/supplier.schema';

export async function GET(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'suppliers', action: 'view' });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    const options = parseListQuery(request.nextUrl.searchParams, {
      defaultSortBy: 'createdAt',
      allowedSortBy: ['createdAt', 'updatedAt', 'fullName', 'contactName', 'email', 'city', 'country', 'category'],
      defaultLimit: 10,
      maxLimit: 100,
    });

    const rawCategory = request.nextUrl.searchParams.get('category');
    const category =
      rawCategory === 'materials' ||
      rawCategory === 'logistics' ||
      rawCategory === 'services' ||
      rawCategory === 'technology' ||
      rawCategory === 'other'
        ? rawCategory
        : undefined;

    const scopedUserIds = await getCompanyUserIdStrings({ companyId: me.user.companyId, fallbackUserId: me.user.id });
    const result = await listSuppliers(scopedUserIds, options, { category });

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error fetching suppliers: ${String(error)}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'suppliers', action: 'create' });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    const body = await request.json();
    const parsed = createSupplierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const created = await createSupplier(me.user.id, parsed.data);

    await createActivityLog(me.user.id, {
      action: 'supplier_created',
      entityType: 'supplier',
      entityName: created.fullName,
      entityId: created._id,
    });

    return NextResponse.json({ success: true, message: 'Supplier created successfully', data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error creating supplier: ${String(error)}` }, { status: 500 });
  }
}
