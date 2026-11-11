import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import Quote from '@/db/models/Quote';
import { buildUserScopeQuery, getCompanyUserObjectIds } from '@/lib/company-scope';
import getMe from '@/utils/middlewares/useMe';

type EntityType = 'quote' | 'invoice';

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { entityType?: EntityType; id?: string } | null;
    const entityType = body?.entityType;
    const id = body?.id;

    if (!entityType || !id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
    }

    await ConnectDb();

    // Sidebar badges are company-wide, so any member can clear them.
    const scopedUserObjectIds = await getCompanyUserObjectIds({ companyId: me.user.companyId, fallbackUserId: me.user.id });

    if (entityType === 'quote') {
      await Quote.updateOne(
        { _id: id, ...buildUserScopeQuery('user', scopedUserObjectIds) },
        { $set: { ownerHasUnread: false } },
        { timestamps: false, strict: false }
      );
    } else {
      await Invoice.updateOne(
        { _id: id, ...buildUserScopeQuery('userId', scopedUserObjectIds) },
        { $set: { ownerHasUnread: false } },
        { timestamps: false, strict: false }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error marking sidebar item as read: ${String(error)}` },
      { status: 500 }
    );
  }
}