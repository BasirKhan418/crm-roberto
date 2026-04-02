import { NextRequest, NextResponse } from 'next/server';

import { deleteAttachment } from '@/db/repository/attachment';
import getMe from '@/utils/middlewares/useMe';

interface RouteParams {
  params: Promise<{ id: string; attachmentId: string }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { attachmentId } = await params;

    const deleted = await deleteAttachment(me.user.id, attachmentId);
    if (!deleted) {
      return NextResponse.json({ success: false, message: 'Attachment not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Attachment deleted' });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error deleting attachment: ${String(error)}` },
      { status: 500 },
    );
  }
}
