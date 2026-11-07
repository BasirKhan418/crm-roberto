import { NextRequest, NextResponse } from 'next/server';

import { createActivityLog } from '@/db/repository/activity';
import { createNote } from '@/db/repository/note';
import { listSupplierTimelineNotes, getSupplierById } from '@/db/repository/supplier';
import { parseListQuery } from '@/utils/api/query';
import { buildValidationError } from '@/utils/api/validation';
import { createNoteSchema } from '@/validators/note.schema';
import { authorizeCompanyRoute } from '@/lib/company-route-access';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await authorizeCompanyRoute({ moduleKey: 'suppliers', action: 'view' });
    if (!access.success) {
      return access.response;
    }
    const companyUserIds = access.companyUserIds.map(String);

    const { id } = await params;
    const existing = await getSupplierById(companyUserIds, id);

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Supplier not found' }, { status: 404 });
    }

    const options = parseListQuery(request.nextUrl.searchParams, {
      defaultSortBy: 'createdAt',
      allowedSortBy: ['createdAt'],
      defaultLimit: 10,
      maxLimit: 100,
    });

    const timeline = await listSupplierTimelineNotes(companyUserIds, id, {
      page: options.page,
      limit: options.limit,
      search: options.search,
    });

    return NextResponse.json({ success: true, data: timeline.notes, pagination: timeline.pagination });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error fetching supplier notes: ${String(error)}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await authorizeCompanyRoute({ moduleKey: 'notes', action: 'create' });
    if (!access.success) {
      return access.response;
    }
    const { user } = access;
    const companyUserIds = access.companyUserIds.map(String);

    const { id } = await params;
    const existing = await getSupplierById(companyUserIds, id);

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Supplier not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createNoteSchema.safeParse({ ...body, linkedType: 'supplier', linkedId: id });

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const created = await createNote(user.id, parsed.data, companyUserIds);
    if (!created) {
      return NextResponse.json({ success: false, message: 'Unable to create note for this supplier' }, { status: 400 });
    }

    await createActivityLog(user.id, {
      action: 'note_created',
      entityType: 'note',
      entityName: created.title,
      entityId: created._id,
    });

    return NextResponse.json({ success: true, message: 'Supplier note created successfully', data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error creating supplier note: ${String(error)}` }, { status: 500 });
  }
}
