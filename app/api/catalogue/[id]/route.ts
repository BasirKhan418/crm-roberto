import { NextRequest, NextResponse } from 'next/server';

import { createActivityLog } from '@/db/repository/activity';
import { deleteCatalogueItemById, getCatalogueItemById, updateCatalogueItemById } from '@/db/repository/catalogue';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { updateCatalogueItemSchema } from '@/validators/catalogue.schema';

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
    const item = await getCatalogueItemById(me.user.id, id);
    if (!item) {
      return NextResponse.json({ success: false, message: 'Catalogue item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching catalogue item: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateCatalogueItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const { id } = await params;
    const updated = await updateCatalogueItemById(me.user.id, id, parsed.data);
    if (!updated) {
      return NextResponse.json({ success: false, message: 'Catalogue item not found' }, { status: 404 });
    }

    await createActivityLog(me.user.id, {
      action: 'product_updated',
      entityType: 'product',
      entityName: updated.name,
      entityId: updated._id,
    });

    return NextResponse.json({ success: true, message: 'Catalogue item updated successfully', data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error updating catalogue item: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const deleted = await deleteCatalogueItemById(me.user.id, id);
    if (!deleted) {
      return NextResponse.json({ success: false, message: 'Catalogue item not found' }, { status: 404 });
    }

    await createActivityLog(me.user.id, {
      action: 'product_deleted',
      entityType: 'product',
      entityName: deleted.name,
      entityId: deleted._id,
    });

    return NextResponse.json({ success: true, message: 'Catalogue item deleted successfully' });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error deleting catalogue item: ${String(error)}` },
      { status: 500 }
    );
  }
}
