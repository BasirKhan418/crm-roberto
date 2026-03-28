import { NextRequest, NextResponse } from 'next/server';

import { createActivityLog } from '@/db/repository/activity';
import { createNote, listNotes } from '@/db/repository/note';
import { parseListQuery } from '@/utils/api/query';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { createNoteSchema } from '@/validators/note.schema';

export async function GET(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const linkedTypeRaw = params.get('linkedType');
    const linkedType = linkedTypeRaw === 'client' || linkedTypeRaw === 'supplier' ? linkedTypeRaw : undefined;
    const linkedId = (params.get('linkedId') || '').trim() || undefined;

    const options = parseListQuery(params, {
      defaultSortBy: 'createdAt',
      allowedSortBy: ['createdAt', 'updatedAt', 'title', 'followUpDate'],
      defaultLimit: 10,
      maxLimit: 100,
    });

    const result = await listNotes(me.user.id, {
      ...options,
      linkedType,
      linkedId,
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error fetching notes: ${String(error)}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const created = await createNote(me.user.id, parsed.data);

    if (!created) {
      return NextResponse.json(
        { success: false, message: 'Linked client/supplier not found or inaccessible' },
        { status: 404 }
      );
    }

    await createActivityLog(me.user.id, {
      action: 'note_created',
      entityType: 'note',
      entityName: created.title,
      entityId: created._id,
    });

    return NextResponse.json({ success: true, message: 'Note created successfully', data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error creating note: ${String(error)}` }, { status: 500 });
  }
}
