import mongoose from 'mongoose';
import { NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import Quote from '@/db/models/Quote';
import Ticket from '@/db/models/Ticket';
import { getFinancialSmartAlertsData } from '@/db/repository/financial-dashboard';
import { getCompanyUserObjectIds } from '@/lib/company-scope';
import getMe from '@/utils/middlewares/useMe';

interface QuoteSidebarItem {
  id: string;
  bucket: 'accepted' | 'pending' | 'rejected';
  updatedAt: string;
}

interface InvoiceSidebarItem {
  id: string;
  bucket: 'paid' | 'pending' | 'overdue';
  updatedAt: string;
}

interface TicketSidebarMeta {
  unreadCount: number;
}

interface ExpenseSidebarMeta {
  unpaidCount: number;
  overdueCount: number;
}

export async function GET() {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    await ConnectDb();

    const userObjectId = new mongoose.Types.ObjectId(me.user.id);
    const scopedUserObjectIds = await getCompanyUserObjectIds({ companyId: me.user.companyId, fallbackUserId: me.user.id });
    const now = new Date();

    const [quoteDocs, invoiceDocs, unreadTicketCount, smartAlertsResult] = await Promise.all([
      Quote.find({ user: { $in: scopedUserObjectIds } })
        .select('_id status createdAt updatedAt')
        .lean<Array<{ _id: mongoose.Types.ObjectId; status?: string; createdAt?: Date | null; updatedAt?: Date | null }>>(),
      Invoice.find({ userId: { $in: scopedUserObjectIds } })
        .select('_id status dueDate createdAt updatedAt')
        .lean<Array<{ _id: mongoose.Types.ObjectId; status?: string; dueDate?: Date | null; createdAt?: Date | null; updatedAt?: Date | null }>>(),
      me.user.companyId && mongoose.Types.ObjectId.isValid(me.user.companyId)
        ? Ticket.countDocuments({
            companyId: new mongoose.Types.ObjectId(me.user.companyId),
            archivedAt: null,
            unreadBy: userObjectId,
          })
        : Promise.resolve(0),
      getFinancialSmartAlertsData({
        companyId: me.user.companyId,
        userId: me.user.id,
        role: me.user.role,
      }),
    ]);

    const quotes: QuoteSidebarItem[] = quoteDocs.flatMap((quote) => {
      let bucket: QuoteSidebarItem['bucket'] | null = null;

      if (quote.status === 'accepted') bucket = 'accepted';
      else if (quote.status === 'draft' || quote.status === 'sent') bucket = 'pending';
      else if (quote.status === 'rejected' || quote.status === 'refused') bucket = 'rejected';

      if (!bucket) return [];

      const touchedAt = quote.updatedAt ?? quote.createdAt ?? now;
      return [{ id: String(quote._id), bucket, updatedAt: touchedAt.toISOString() }];
    });

    const invoices: InvoiceSidebarItem[] = invoiceDocs.map((invoice) => {
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
      const isOverdue =
        (invoice.status === 'unpaid' || invoice.status === 'partial_paid') &&
        Boolean(dueDate && Number.isFinite(dueDate.getTime()) && dueDate.getTime() < now.getTime());

      const bucket: InvoiceSidebarItem['bucket'] =
        invoice.status === 'paid' ? 'paid' : isOverdue ? 'overdue' : 'pending';

      const touchedAt = invoice.updatedAt ?? invoice.createdAt ?? now;
      return { id: String(invoice._id), bucket, updatedAt: touchedAt.toISOString() };
    });

    const tickets: TicketSidebarMeta = {
      unreadCount: unreadTicketCount,
    };

    const expenses: ExpenseSidebarMeta = smartAlertsResult.success
      ? {
          unpaidCount: smartAlertsResult.data.alerts.unpaidSupplierInvoices.count,
          overdueCount: smartAlertsResult.data.alerts.overdueSupplierInvoices.count,
        }
      : {
          unpaidCount: 0,
          overdueCount: 0,
        };

    return NextResponse.json({ success: true, data: { quotes, invoices, tickets, expenses } });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching sidebar badges: ${String(error)}` },
      { status: 500 }
    );
  }
}
