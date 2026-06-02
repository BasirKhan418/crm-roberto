import mongoose from 'mongoose';
import { NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Expense from '@/db/models/Expense';
import Invoice from '@/db/models/Invoice';
import Ticket from '@/db/models/Ticket';
import { getCompanyUserObjectIds } from '@/lib/company-scope';
import getAccountantSession from '@/utils/middlewares/accountantSession';

const UNPAID_EXPENSE_STATUSES = ['unpaid', 'partial'] as const;

export async function GET() {
  try {
    const session = await getAccountantSession();
    if (!session.success || !session.user) {
      return NextResponse.json({ success: false, message: session.message || 'Unauthorized' }, { status: 401 });
    }

    await ConnectDb();

    const now = new Date();
    const companyObjectId = new mongoose.Types.ObjectId(session.user.companyId);
    const userObjectId = new mongoose.Types.ObjectId(session.user.id);
    const scopedUserObjectIds = await getCompanyUserObjectIds({
      companyId: session.user.companyId,
      fallbackUserId: session.user.id,
    });

    const [purchaseUnpaidCount, purchaseOverdueCount, salesDocs, unreadTicketCount, assignedOpenCount] = await Promise.all([
      Expense.countDocuments({
        companyId: companyObjectId,
        deletedAt: null,
        archivedAt: null,
        status: 'active',
        paymentStatus: { $in: UNPAID_EXPENSE_STATUSES },
      }),
      Expense.countDocuments({
        companyId: companyObjectId,
        deletedAt: null,
        archivedAt: null,
        status: 'active',
        paymentStatus: { $in: UNPAID_EXPENSE_STATUSES },
        dueDate: { $ne: null, $lt: now },
      }),
      Invoice.find({
        userId: { $in: scopedUserObjectIds },
        status: { $in: ['unpaid', 'partial_paid', 'overdue'] },
      })
        .select('status dueDate')
        .lean<Array<{ status?: string; dueDate?: Date | null }>>(),
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

    const salesUnpaidCount = salesDocs.length;
    const salesOverdueCount = salesDocs.reduce((sum, invoice) => {
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
      const isOverdue =
        invoice.status === 'overdue' ||
        ((invoice.status === 'unpaid' || invoice.status === 'partial_paid') &&
          Boolean(dueDate && Number.isFinite(dueDate.getTime()) && dueDate.getTime() < now.getTime()));

      return sum + (isOverdue ? 1 : 0);
    }, 0);

    return NextResponse.json({
      success: true,
      data: {
        purchaseInvoices: {
          unpaidCount: purchaseUnpaidCount,
          overdueCount: purchaseOverdueCount,
        },
        salesInvoices: {
          unpaidCount: salesUnpaidCount,
          overdueCount: salesOverdueCount,
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