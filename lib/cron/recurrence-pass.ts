export interface RecurrencePassTotals {
  processed: number;
  generated: number;
  skipped: number;
}

import ConnectDb from '@/db/connectDb';
import CompanyProfile from '@/db/models/CompanyProfile';
import Invoice from '@/db/models/Invoice';
import Notification from '@/db/models/Notification';
import ReminderSettings from '@/db/models/ReminderSettings';
import User from '@/db/models/User';
import { createActivityLog } from '@/db/repository/activity';
import {
  autoSendRecurringInvoiceToClient,
  duplicateInvoiceForRecurrence,
  sendRecurrenceDueNotificationToOwner,
  type RecurrenceInvoiceLike,
} from '@/lib/recurrence/core';

import { acquireLock, releaseLock } from './redis-lock';

export interface RecurrencePassTotals {
  processed: number;
  generated: number;
  skipped: number;
}

type RecurrenceCandidate = RecurrenceInvoiceLike;

type CompanyProfileLite = {
  companyName?: string | null;
  ownerName?: string | null;
  businessEmail?: string | null;
};

export async function runRecurrencePass(): Promise<RecurrencePassTotals> {
  await ConnectDb();

  const totals: RecurrencePassTotals = {
    processed: 0,
    generated: 0,
    skipped: 0,
  };

  const now = new Date();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  const remindersCache = new Map<string, unknown>();
  const companyCache = new Map<string, CompanyProfileLite | null>();
  const userCache = new Map<string, { email?: string | null; name?: string | null } | null>();

  const invoices = await Invoice.find({
    'recurrence.isActive': true,
    'recurrence.nextOccurrenceAt': { $lte: now },
    'recurrence.stoppedAt': null,
  })
    .select(
      '_id userId invoiceNumber quoteNumber date dueDate status clientId clientSnapshot lineItems totalExcludingTax totalVat totalIncludingTax depositPercentage notes recurrence'
    )
    .lean<RecurrenceCandidate[]>();

  for (const invoice of invoices) {
    totals.processed += 1;

    const recurrence = invoice.recurrence;
    const nextOccurrenceAt = recurrence?.nextOccurrenceAt;
    if (!nextOccurrenceAt) {
      totals.skipped += 1;
      continue;
    }

    const lockKey = `recurrence:${String(invoice._id)}:${new Date(nextOccurrenceAt).toISOString()}`;
    const locked = await acquireLock(lockKey, 600);
    if (!locked) {
      totals.skipped += 1;
      continue;
    }

    try {
      const userId = String(invoice.userId);

      if (!remindersCache.has(userId)) {
        const reminderSettings = await ReminderSettings.findOne({ userId: invoice.userId }).lean();
        remindersCache.set(userId, reminderSettings ?? null);
      }

      let companyProfile = companyCache.get(userId);
      if (companyProfile === undefined) {
        const loadedProfile = await CompanyProfile.findOne({ user: invoice.userId })
          .select('companyName ownerName businessEmail')
          .lean<CompanyProfileLite | null>();
        companyProfile = loadedProfile;
        companyCache.set(userId, loadedProfile);
      }

      if (recurrence?.endDate && now > new Date(recurrence.endDate)) {
        await Invoice.updateOne(
          { _id: invoice._id, userId: invoice.userId },
          {
            $set: {
              'recurrence.isActive': false,
              'recurrence.stoppedAt': now,
              'recurrence.stoppedReason': 'end_date_reached',
              'recurrence.nextOccurrenceAt': null,
            },
          }
        );
        totals.skipped += 1;
        continue;
      }

      if (recurrence?.autoGenerate === true) {
        const { newInvoice, nextOccurrenceAt: advancedNext } = await duplicateInvoiceForRecurrence({
          sourceInvoice: invoice,
          recurrence: {
            frequency: recurrence.frequency || 'monthly',
            customIntervalDays: recurrence.customIntervalDays ?? null,
            nextOccurrenceAt: new Date(nextOccurrenceAt),
            endDate: recurrence.endDate ?? null,
          },
        });

        await Invoice.updateOne(
          { _id: invoice._id, userId: invoice.userId },
          {
            $set: {
              'recurrence.lastGeneratedAt': now,
              'recurrence.lastGeneratedInvoiceId': newInvoice._id,
              'recurrence.nextOccurrenceAt': advancedNext,
            },
          }
        );

        if (recurrence.autoSend === true) {
          await autoSendRecurringInvoiceToClient({
            invoice: newInvoice,
            userId,
          });
        }

        await createActivityLog(userId, {
          action: 'invoice_recurrence_generated',
          entityType: 'invoice',
          entityName: invoice.invoiceNumber,
          entityId: String(invoice._id),
          metadata: {
            sourceInvoiceId: String(invoice._id),
            newInvoiceId: String(newInvoice._id),
            newInvoiceNumber: newInvoice.invoiceNumber,
          },
        });

        await Notification.create({
          userId: invoice.userId,
          type: 'recurrence_generated',
          title: `Recurrence generated - ${invoice.invoiceNumber}`,
          message: `Generated invoice ${newInvoice.invoiceNumber} from recurrence`,
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
        });

        totals.generated += 1;
        continue;
      }

      let userRecord = userCache.get(userId);
      if (userRecord === undefined) {
        const loadedUser = await User.findById(invoice.userId).select('email name').lean<{ email?: string | null; name?: string | null } | null>();
        userRecord = loadedUser;
        userCache.set(userId, loadedUser);
      }

      const ownerEmail = companyProfile?.businessEmail?.trim() || userRecord?.email?.trim() || '';
      if (!ownerEmail) {
        totals.skipped += 1;
        continue;
      }

      const companyName = companyProfile?.companyName || companyProfile?.ownerName || 'CRM';
      const ownerName = userRecord?.name || companyProfile?.ownerName || 'Owner';
      const invoiceDetailUrl = appUrl ? `${appUrl}/invoices/${String(invoice._id)}` : `/invoices/${String(invoice._id)}`;

      await sendRecurrenceDueNotificationToOwner({
        ownerEmail,
        ownerName,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDetailUrl,
        companyName,
      });

      await createActivityLog(userId, {
        action: 'invoice_recurrence_due',
        entityType: 'invoice',
        entityName: invoice.invoiceNumber,
        entityId: String(invoice._id),
        metadata: {
          channel: 'email',
          recipientEmail: ownerEmail,
          invoiceDetailUrl,
        },
      });

      await Notification.create({
        userId: invoice.userId,
        type: 'recurrence_due',
        title: `Recurrence due - ${invoice.invoiceNumber}`,
        message: `Recurrence due and owner notified at ${ownerEmail}`,
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
      });

      totals.skipped += 1;
    } catch {
      totals.skipped += 1;
    } finally {
      await releaseLock(lockKey);
    }
  }

  return totals;
}
