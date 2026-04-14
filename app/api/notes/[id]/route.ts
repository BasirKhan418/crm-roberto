import { NextRequest, NextResponse } from 'next/server';

import { createActivityLog } from '@/db/repository/activity';
import { deleteNoteById, getNoteById, updateNoteById } from '@/db/repository/note';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { updateNoteSchema } from '@/validators/note.schema';

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
    const note = await getNoteById(me.user.id, id);

    if (!note) {
      return NextResponse.json({ success: false, message: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: note });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error fetching note: ${String(error)}` }, { status: 500 });
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
    const parsed = updateNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const updated = await updateNoteById(me.user.id, id, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'Note not found or linked client/supplier inaccessible' },
        { status: 404 }
      );
    }

    await createActivityLog(me.user.id, {
      action: 'note_updated',
      entityType: 'note',
      entityName: updated.title,
      entityId: updated._id,
    });

    return NextResponse.json({ success: true, message: 'Note updated successfully', data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error updating note: ${String(error)}` }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await getNoteById(me.user.id, id);

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Note not found' }, { status: 404 });
    }

    const removed = await deleteNoteById(me.user.id, id);
    if (!removed) {
      return NextResponse.json({ success: false, message: 'Note not found' }, { status: 404 });
    }

    await createActivityLog(me.user.id, {
      action: 'note_deleted',
      entityType: 'note',
      entityName: existing.title,
      entityId: existing._id,
    });

    return NextResponse.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error deleting note: ${String(error)}` }, { status: 500 });
  }
}
