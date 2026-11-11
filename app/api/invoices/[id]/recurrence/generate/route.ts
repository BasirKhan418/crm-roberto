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
import { authorizeCompanyRoute } from '@/lib/company-route-access';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const access = await authorizeCompanyRoute({ moduleKey: 'invoices', action: 'create' });
    if (!access.success) {
      return access.response;
    }
    const { user } = access;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    await ConnectDb();

    const sourceInvoice = await Invoice.findOne({ _id: id, ...access.scope('userId') })
      .select(
        '_id userId invoiceNumber quoteNumber date dueDate status clientId clientSnapshot lineItems totalExcludingTax totalVat totalIncludingTax depositPercentage notes recurrence'
      )
      .lean<RecurrenceInvoiceLike | null>();

    if (!sourceInvoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const recurrence = sourceInvoice.recurrence;
    const recurrenceNextOccurrenceAt = recurrence?.nextOccurrenceAt;

    if (recurrence?.isActive && !recurrenceNextOccurrenceAt) {
      const stoppedAt = new Date();

      await Invoice.updateOne(
        { _id: sourceInvoice._id, userId: sourceInvoice.userId },
        {
          $set: {
            'recurrence.isActive': false,
            'recurrence.stoppedAt': stoppedAt,
            'recurrence.stoppedReason': recurrence.endDate ? 'end_date_reached' : 'schedule_unavailable',
            'recurrence.nextOccurrenceAt': null,
          },
        }
      );

      return NextResponse.json(
        {
          success: false,
          message: recurrence.endDate
            ? 'Recurrence has ended for this invoice'
            : 'Recurrence schedule is unavailable for this invoice',
        },
        { status: 422 }
      );
    }

    if (!recurrence?.isActive) {
      return NextResponse.json({ success: false, message: 'Recurrence is not active for this invoice' }, { status: 422 });
    }

    if (!recurrenceNextOccurrenceAt) {
      return NextResponse.json(
        { success: false, message: 'Recurrence schedule is unavailable for this invoice' },
        { status: 422 }
      );
    }

    const lockKey = `recurrence:${String(sourceInvoice._id)}:${new Date(recurrenceNextOccurrenceAt).toISOString()}`;
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
          nextOccurrenceAt: new Date(recurrenceNextOccurrenceAt),
          endDate: recurrence.endDate ?? null,
          template: recurrence.template ?? null,
        },
      });

      const generatedAt = new Date();
      const recurrenceStatusUpdate = nextOccurrenceAt
        ? {
            'recurrence.nextOccurrenceAt': nextOccurrenceAt,
          }
        : {
            'recurrence.isActive': false,
            'recurrence.stoppedAt': generatedAt,
            'recurrence.stoppedReason': 'end_date_reached',
            'recurrence.nextOccurrenceAt': null,
          };

      await Invoice.updateOne(
        { _id: sourceInvoice._id, userId: sourceInvoice.userId },
        {
          $set: {
            'recurrence.lastGeneratedAt': generatedAt,
            'recurrence.lastGeneratedInvoiceId': newInvoice._id,
            ...recurrenceStatusUpdate,
          },
        }
      );

      if (recurrence.autoSend === true) {
        await autoSendRecurringInvoiceToClient({
          invoice: newInvoice,
          userId: String(sourceInvoice.userId),
        });
      }

      await createActivityLog(user.id, {
        action: 'invoice_recurrence_generated',
        entityType: 'invoice',
        entityName: sourceInvoice.invoiceNumber,
        entityId: String(sourceInvoice._id),
        metadata: {
          sourceInvoiceId: String(sourceInvoice._id),
          newInvoiceId: String(newInvoice._id),
          newInvoiceNumber: newInvoice.invoiceNumber,
          generatedAt: dayjs(generatedAt).toISOString(),
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
