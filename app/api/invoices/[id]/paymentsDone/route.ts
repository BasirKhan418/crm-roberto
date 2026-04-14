import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
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

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    await ConnectDb();

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id }).select('_id').lean();
    if (!invoice) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    const payments = await Payment.find({ invoiceId: id, userId: me.user.id })
      .sort({ paidAt: -1, createdAt: -1 })
      .lean();

    return NextResponse.json(payments);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load payments';
    return NextResponse.json({ message }, { status: 500 });
  }
}
