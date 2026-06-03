import mongoose from 'mongoose';
import { NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Expense from '@/db/models/Expense';
import Invoice from '@/db/models/Invoice';
import Ticket from '@/db/models/Ticket';
import { getCompanyUserObjectIds } from '@/lib/company-scope';
import getAccountantSession from '@/utils/middlewares/accountantSession';

export async function GET() {
  try {
    const session = await getAccountantSession();
    if (!session.success || !session.user) {
      return NextResponse.json({ success: false, message: session.message || 'Unauthorized' }, { status: 401 });
    }

    await ConnectDb();

    const companyObjectId = new mongoose.Types.ObjectId(session.user.companyId);
    const userObjectId = new mongoose.Types.ObjectId(session.user.id);
    const scopedUserObjectIds = await getCompanyUserObjectIds({
      companyId: session.user.companyId,
      fallbackUserId: session.user.id,
    });

    const [purchaseToProcessCount, salesToProcessCount, unreadTicketCount, assignedOpenCount] = await Promise.all([
      Expense.countDocuments({
        companyId: companyObjectId,
        deletedAt: null,
        archivedAt: null,
        status: 'active',
        accountantProcessed: { $ne: true },
      }),
      Invoice.countDocuments({
        userId: { $in: scopedUserObjectIds },
        accountantProcessed: { $ne: true },
      }),
      Ticket.countDocuments({
        companyId: companyObjectId,
        archivedAt: null,
        unreadBy: userObjectId,
      }),
      Ticket.countDocuments({
        companyId: companyObjectId,
        archivedAt: null,
        assignedTo: userObjectId,
        status: { $in: ['open', 'waiting'] },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        purchaseInvoices: {
          toProcessCount: purchaseToProcessCount,
        },
        salesInvoices: {
          toProcessCount: salesToProcessCount,
        },
        tickets: {
          unreadCount: unreadTicketCount,
          assignedOpenCount,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching accountant sidebar badges: ${String(error)}` },
      { status: 500 }
    );
  }
}