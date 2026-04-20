import dayjs from 'dayjs';
import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import { createActivityLog } from '@/db/repository/activity';
import { acquireLock, releaseLock } from '@/lib/cron/redis-lock';
import {
  autoSendRecurringInvoiceToClient,
  duplicateInvoiceForRecurrence,
  type RecurrenceInvoiceLike,
} from '@/lib/recurrence/core';
import getMe from '@/utils/middlewares/useMe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    await ConnectDb();

    const sourceInvoice = await Invoice.findOne({ _id: id, userId: me.user.id })
      .select(
        '_id userId invoiceNumber quoteNumber date dueDate status clientId clientSnapshot lineItems totalExcludingTax totalVat totalIncludingTax depositPercentage notes recurrence'
      )
      .lean<RecurrenceInvoiceLike | null>();

    if (!sourceInvoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    if (!sourceInvoice.recurrence?.isActive || !sourceInvoice.recurrence.nextOccurrenceAt) {
      return NextResponse.json({ success: false, message: 'Recurrence is not active for this invoice' }, { status: 422 });
    }

    const recurrence = sourceInvoice.recurrence;
    const lockKey = `recurrence:${String(sourceInvoice._id)}:${new Date(recurrence.nextOccurrenceAt).toISOString()}`;
    const lockAcquired = await acquireLock(lockKey, 600);

    if (!lockAcquired) {
      return NextResponse.json({ success: false, message: 'Recurring generation is already in progress' }, { status: 409 });
    }

    try {
      const { newInvoice, nextOccurrenceAt } = await duplicateInvoiceForRecurrence({
        sourceInvoice,
        recurrence: {
          frequency: recurrence.frequency || 'monthly',
          customIntervalDays: recurrence.customIntervalDays ?? null,
          nextOccurrenceAt: new Date(recurrence.nextOccurrenceAt),
          endDate: recurrence.endDate ?? null,
        },
      });

      await Invoice.updateOne(
        { _id: sourceInvoice._id, userId: me.user.id },
        {
          $set: {
            'recurrence.lastGeneratedAt': new Date(),
            'recurrence.lastGeneratedInvoiceId': newInvoice._id,
            'recurrence.nextOccurrenceAt': nextOccurrenceAt,
          },
        }
      );

      if (recurrence.autoSend === true) {
        await autoSendRecurringInvoiceToClient({
          invoice: newInvoice,
          userId: me.user.id,
        });
      }

      await createActivityLog(me.user.id, {
        action: 'invoice_recurrence_generated',
        entityType: 'invoice',
        entityName: sourceInvoice.invoiceNumber,
        entityId: String(sourceInvoice._id),
        metadata: {
          sourceInvoiceId: String(sourceInvoice._id),
          newInvoiceId: String(newInvoice._id),
          newInvoiceNumber: newInvoice.invoiceNumber,
          generatedAt: dayjs().toISOString(),
        },
      });

      return NextResponse.json({ success: true, newInvoice });
    } finally {
      await releaseLock(lockKey);
    }
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error generating recurring invoice: ${String(error)}` }, { status: 500 });
  }
}
