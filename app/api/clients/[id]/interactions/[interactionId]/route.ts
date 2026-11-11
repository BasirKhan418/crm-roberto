import { NextRequest, NextResponse } from 'next/server';

import { deleteInteraction } from '@/db/repository/interaction';
import { authorizeCompanyRoute } from '@/lib/company-route-access';

interface RouteParams {
  params: Promise<{ id: string; interactionId: string }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const access = await authorizeCompanyRoute({ moduleKey: 'clients', action: 'edit' });
    if (!access.success) {
      return access.response;
    }

    const { id, interactionId } = await params;

    const deleted = await deleteInteraction(access.companyUserIds.map(String), id, interactionId);
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
