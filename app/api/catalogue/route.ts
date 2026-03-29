import { NextRequest, NextResponse } from 'next/server';

import { createActivityLog } from '@/db/repository/activity';
import { createCatalogueItem, listCatalogueItems, type CatalogueType } from '@/db/repository/catalogue';
import { parseListQuery } from '@/utils/api/query';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { createCatalogueItemSchema } from '@/validators/catalogue.schema';

export async function GET(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const options = parseListQuery(request.nextUrl.searchParams, {
      defaultSortBy: 'createdAt',
      allowedSortBy: ['createdAt', 'updatedAt', 'name', 'priceExcludingTax', 'priceIncludingTax', 'type'],
      defaultLimit: 10,
      maxLimit: 100,
    });

    const rawType = request.nextUrl.searchParams.get('type');
    const type: CatalogueType | undefined = rawType === 'product' || rawType === 'service' ? rawType : undefined;

    const result = await listCatalogueItems(me.user.id, options, { type });

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching catalogue items: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createCatalogueItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const created = await createCatalogueItem(me.user.id, parsed.data);

    await createActivityLog(me.user.id, {
      action: 'product_created',
      entityType: 'product',
      entityName: created.name,
      entityId: created._id,
    });

    return NextResponse.json(
      { success: true, message: 'Catalogue item created successfully', data: created },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error creating catalogue item: ${String(error)}` },
      { status: 500 }
    );
  }
}
