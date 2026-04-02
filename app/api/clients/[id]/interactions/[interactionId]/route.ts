import { NextRequest, NextResponse } from 'next/server';

import { deleteInteraction } from '@/db/repository/interaction';
import getMe from '@/utils/middlewares/useMe';

interface RouteParams {
  params: Promise<{ id: string; interactionId: string }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { interactionId } = await params;

    const deleted = await deleteInteraction(me.user.id, interactionId);
    if (!deleted) {
      return NextResponse.json({ success: false, message: 'Interaction not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Interaction deleted' });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error deleting interaction: ${String(error)}` },
      { status: 500 },
    );
  }
}
