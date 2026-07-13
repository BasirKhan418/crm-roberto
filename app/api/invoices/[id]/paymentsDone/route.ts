import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import { buildUserScopeQuery, getCompanyUserObjectIds } from '@/lib/company-scope';
import { requireModulePermission } from '@/lib/role-matrix';
import getMe from '@/utils/middlewares/useMe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/invoices/:id/paymentsDone
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'invoices', action: 'view' });
    if (!permission.success) {
      return NextResponse.json({ message: permission.message }, { status: permission.status });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    await ConnectDb();

    const scopedUserObjectIds = await getCompanyUserObjectIds({ companyId: me.user.companyId, fallbackUserId: me.user.id });
    const invoice = await Invoice.findOne({ _id: id, ...buildUserScopeQuery('userId', scopedUserObjectIds) }).select('_id userId').lean<{
      _id: mongoose.Types.ObjectId;
      userId: mongoose.Types.ObjectId;
    }>();
    if (!invoice) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    const payments = await Payment.find({ invoiceId: invoice._id, userId: invoice.userId })
      .sort({ paidAt: -1, createdAt: -1 })
      .lean();

    return NextResponse.json(payments);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load payments';
    return NextResponse.json({ message }, { status: 500 });
  }
}
