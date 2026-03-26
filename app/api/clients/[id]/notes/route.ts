import { NextRequest, NextResponse } from 'next/server';

import { createActivityLog } from '@/db/repository/activity';
import { getClientById, listClientTimelineNotes } from '@/db/repository/client';
import { createNote } from '@/db/repository/note';
import { parseListQuery } from '@/utils/api/query';
import getMe from '@/utils/middlewares/useMe';
import { createNoteSchema } from '@/validators/note.schema';

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
    const existing = await getClientById(me.user.id, id);

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }

    const options = parseListQuery(request.nextUrl.searchParams, {
      defaultSortBy: 'createdAt',
      allowedSortBy: ['createdAt'],
      defaultLimit: 10,
      maxLimit: 100,
    });

    const timeline = await listClientTimelineNotes(me.user.id, id, {
      page: options.page,
      limit: options.limit,
      search: options.search,
    });

    return NextResponse.json({ success: true, data: timeline.notes, pagination: timeline.pagination });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error fetching client notes: ${String(error)}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await getClientById(me.user.id, id);

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createNoteSchema.safeParse({ ...body, linkedType: 'client', linkedId: id });

    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 });
    }

    const created = await createNote(me.user.id, parsed.data);
    if (!created) {
      return NextResponse.json({ success: false, message: 'Unable to create note for this client' }, { status: 400 });
    }

    await createActivityLog(me.user.id, {
      action: 'note_created',
      entityType: 'note',
      entityName: created.title,
      entityId: created._id,
    });

    return NextResponse.json({ success: true, message: 'Client note created successfully', data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error creating client note: ${String(error)}` }, { status: 500 });
  }
}
