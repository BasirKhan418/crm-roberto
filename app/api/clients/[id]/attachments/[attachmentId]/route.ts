import { NextRequest, NextResponse } from 'next/server';

import { deleteAttachment } from '@/db/repository/attachment';
import { authorizeCompanyRoute } from '@/lib/company-route-access';

interface RouteParams {
  params: Promise<{ id: string; attachmentId: string }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const access = await authorizeCompanyRoute({ moduleKey: 'clients', action: 'edit' });
    if (!access.success) {
      return access.response;
    }

    const { id, attachmentId } = await params;

    const deleted = await deleteAttachment(access.companyUserIds.map(String), id, attachmentId);
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
