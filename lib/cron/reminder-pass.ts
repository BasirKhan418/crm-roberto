import dayjs from 'dayjs';
import mongoose from 'mongoose';

import ConnectDb from '@/db/connectDb';
import CompanyProfile from '@/db/models/CompanyProfile';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import ReminderLog from '@/db/models/ReminderLog';
import ReminderSettings from '@/db/models/ReminderSettings';
import { createActivityLog } from '@/db/repository/activity';
import { sendInvoiceReminder } from '@/lib/email';
import {
  buildBodyPreview,
  buildFallbackReminderSubject,
  computeDaysOverdue,
  computeLateFeeAmountCents,
  computeNextScheduledAt,
  getReminderLevelKey,
  getTargetReminderLevel,
  mergeLateFeeIntoVariables,
  normalizeOffsets,
  type ReminderLevel,
} from '@/lib/reminders/core';
import { buildReminderVars, substituteVariables } from '@/lib/reminders/substitute-variables';

import { acquireLock, releaseLock } from './redis-lock';

export interface ReminderPassTotals {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

type InvoiceReminderCandidate = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  date?: Date | null;
  dueDate?: Date | null;
  status: 'unpaid' | 'partial_paid' | 'paid' | 'overdue';
  totalIncludingTax?: number | null;
  paymentToken?: string | null;
  paymentTokenExpiry?: Date | null;
  clientSnapshot?: {
    fullName?: string | null;
    email?: string | null;
  } | null;
  reminderState?: {
    level?: number | null;
    isPaused?: boolean | null;
    nextScheduledAt?: Date | null;
  } | null;
};

type SettingsLike = {
  offsets?: { soft?: number; medium?: number; firm?: number; formalNotice?: number };
  templates?: {
    en?: Record<'soft' | 'medium' | 'firm' | 'formalNotice', { subject: string; body: string }>;
    fr?: Record<'soft' | 'medium' | 'firm' | 'formalNotice', { subject: string; body: string }>;
  };
  lateFee?: {
    enabled?: boolean;
    type?: 'fixed' | 'percentage';
    value?: number;
    applyFrom?: 'medium' | 'firm' | 'formalNotice';
  };
};

function normalizeLocale(locale: unknown): 'en' | 'fr' {
  if (typeof locale === 'string' && locale.toLowerCase().startsWith('en')) {
    return 'en';
  }

  return 'fr';
}

function buildSkipLog(args: {
  userId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  level: ReminderLevel;
  reason: string;
  invoiceNumber: string;
  recipientEmail: string;
}) {
  return ReminderLog.create({
    userId: args.userId,
    invoiceId: args.invoiceId,
    level: args.level,
    channel: 'email',
    status: 'skipped',
    skippedReason: args.reason,
    subject: `Reminder skipped - ${args.invoiceNumber}`,
    bodyPreview: '',
    recipientEmail: args.recipientEmail,
    lateFeeAmount: 0,
    error: null,
    sentAt: new Date(),
    pdfAttached: false,
  });
}

async function loadPaidTotals(invoiceIds: mongoose.Types.ObjectId[]): Promise<Map<string, number>> {
  if (invoiceIds.length === 0) {
    return new Map();
  }

  const totals = await Payment.aggregate<{ _id: mongoose.Types.ObjectId; totalPaid: number }>([
    {
      $match: {
        invoiceId: { $in: invoiceIds },
        status: 'succeeded',
      },
    },
    { $group: { _id: '$invoiceId', totalPaid: { $sum: '$amount' } } },
  ]);

  const map = new Map<string, number>();
  for (const row of totals) {
    map.set(String(row._id), Math.max(0, Math.round(row.totalPaid ?? 0)));
  }

  return map;
}

async function checkConsecutiveFailuresAndPause(invoice: InvoiceReminderCandidate): Promise<void> {
  const recentLogs = await ReminderLog.find({ userId: invoice.userId, invoiceId: invoice._id })
    .sort({ sentAt: -1 })
    .limit(3)
    .select('status')
    .lean<Array<{ status?: string }>>();

  if (recentLogs.length < 3) {
    return;
  }

  const hasThreeConsecutiveFailures = recentLogs.every((item) => item.status === 'failed');
  if (!hasThreeConsecutiveFailures) {
    return;
  }

  await Invoice.updateOne(
    { _id: invoice._id, userId: invoice.userId },
    {
      $set: {
        'reminderState.isPaused': true,
        'reminderState.nextScheduledAt': null,
      },
    }
  );

  console.warn({
    event: 'reminder-paused-after-failures',
    invoiceId: String(invoice._id),
    userId: String(invoice.userId),
    invoiceNumber: invoice.invoiceNumber,
  });
}

export async function runReminderPass(): Promise<ReminderPassTotals> {
  await ConnectDb();

  const totals: ReminderPassTotals = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  const now = new Date();
  const settingsCache = new Map<string, SettingsLike>();
  const profileCache = new Map<string, { companyName?: string | null; ownerName?: string | null; locale?: string | null } | null>();

  let lastId: mongoose.Types.ObjectId | null = null;

  while (true) {
    const baseQuery: Record<string, unknown> = {
      status: { $in: ['unpaid', 'partial_paid', 'overdue'] },
      'reminderState.isPaused': { $ne: true },
      $or: [
        { 'reminderState.nextScheduledAt': { $lte: now } },
        { 'reminderState.nextScheduledAt': null, dueDate: { $lt: now } },
      ],
    };

    if (lastId) {
      baseQuery._id = { $gt: lastId };
    }

    const invoices = await Invoice.find(baseQuery)
      .sort({ _id: 1 })
      .limit(100)
      .select(
        '_id userId invoiceNumber date dueDate status totalIncludingTax paymentToken paymentTokenExpiry clientSnapshot reminderState'
      )
      .lean<InvoiceReminderCandidate[]>();

    if (invoices.length === 0) {
      break;
    }

    lastId = invoices[invoices.length - 1]._id;
    const paidMap = await loadPaidTotals(invoices.map((invoice) => invoice._id));

    for (const invoice of invoices) {
      totals.processed += 1;

      if (invoice.status === 'paid') {
        await buildSkipLog({
          userId: invoice.userId,
          invoiceId: invoice._id,
          level: 1,
          reason: 'invoice_paid',
          invoiceNumber: invoice.invoiceNumber,
          recipientEmail: invoice.clientSnapshot?.email || '',
        });
        totals.skipped += 1;
        continue;
      }

      const userId = String(invoice.userId);

      let settings = settingsCache.get(userId);
      if (!settings) {
        const loadedSettings = await ReminderSettings.findOne({ userId: invoice.userId }).lean<SettingsLike | null>();
        settings = loadedSettings ?? (new ReminderSettings({ userId: invoice.userId }).toObject() as SettingsLike);
        settingsCache.set(userId, settings);
      }

      const offsets = normalizeOffsets(settings.offsets);
      const daysOverdue = computeDaysOverdue(invoice.dueDate);
      const targetLevel = getTargetReminderLevel(daysOverdue, offsets);

      if (!targetLevel) {
        totals.skipped += 1;
        continue;
      }

      const currentLevel = Math.max(0, Math.min(4, Math.round(invoice.reminderState?.level ?? 0)));
      if (targetLevel === currentLevel) {
        totals.skipped += 1;
        continue;
      }

      if (targetLevel === 4) {
        await buildSkipLog({
          userId: invoice.userId,
          invoiceId: invoice._id,
          level: 4,
          reason: 'formal_notice_deferred',
          invoiceNumber: invoice.invoiceNumber,
          recipientEmail: invoice.clientSnapshot?.email || '',
        });
        totals.skipped += 1;
        continue;
      }

      const lockKey = `reminder:${String(invoice._id)}:${targetLevel}`;
      const lockAcquired = await acquireLock(lockKey, 600);
      if (!lockAcquired) {
        totals.skipped += 1;
        continue;
      }

      try {
        let companyProfile = profileCache.get(userId);
        if (companyProfile === undefined) {
          const loadedProfile = await CompanyProfile.findOne({ user: invoice.userId })
            .select('companyName ownerName locale')
            .lean<{ companyName?: string | null; ownerName?: string | null; locale?: string | null } | null>();
          companyProfile = loadedProfile;
          profileCache.set(userId, companyProfile);
        }

        const locale = normalizeLocale(companyProfile?.locale);
        const levelKey = getReminderLevelKey(targetLevel);
        const template = settings.templates?.[locale]?.[levelKey] ?? settings.templates?.fr?.[levelKey] ?? settings.templates?.en?.[levelKey];

        const remainingAmount = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0) - (paidMap.get(String(invoice._id)) ?? 0));
        const lateFeeAmount = computeLateFeeAmountCents(remainingAmount, targetLevel, settings.lateFee);

        const recipientEmail = invoice.clientSnapshot?.email?.trim() || '';
        if (!recipientEmail) {
          await buildSkipLog({
            userId: invoice.userId,
            invoiceId: invoice._id,
            level: targetLevel,
            reason: 'missing_recipient_email',
            invoiceNumber: invoice.invoiceNumber,
            recipientEmail: '',
          });
          totals.skipped += 1;
          continue;
        }

        const vars = mergeLateFeeIntoVariables(buildReminderVars(invoice, settings, companyProfile, locale), lateFeeAmount, locale);
        const subject = substituteVariables(template?.subject || buildFallbackReminderSubject(targetLevel, invoice.invoiceNumber), vars);
        const renderedBody = substituteVariables(template?.body || '', vars);

        await sendInvoiceReminder({
          to: recipientEmail,
          clientName: invoice.clientSnapshot?.fullName || 'Client',
          companyName: companyProfile?.companyName || companyProfile?.ownerName || 'CRM',
          invoiceNumber: invoice.invoiceNumber,
          subject,
          htmlBody: renderedBody,
          locale,
        });

        const nextScheduledAt = computeNextScheduledAt(invoice.dueDate, targetLevel, offsets);

        await Invoice.updateOne(
          { _id: invoice._id, userId: invoice.userId },
          {
            $set: {
              'reminderState.level': targetLevel,
              'reminderState.lastSentAt': now,
              'reminderState.nextScheduledAt': nextScheduledAt,
              'reminderState.isPaused': false,
              'reminderState.lateFeeAmount': lateFeeAmount,
            },
          }
        );

        await ReminderLog.create({
          userId: invoice.userId,
          invoiceId: invoice._id,
          level: targetLevel,
          channel: 'email',
          status: 'sent',
          skippedReason: null,
          subject,
          bodyPreview: buildBodyPreview(renderedBody),
          recipientEmail,
          lateFeeAmount,
          error: null,
          sentAt: now,
          pdfAttached: false,
        });

        await createActivityLog(userId, {
          action: 'invoice_reminder_sent',
          entityType: 'invoice',
          entityName: invoice.invoiceNumber,
          entityId: String(invoice._id),
          metadata: {
            level: targetLevel,
            channel: 'email',
            recipientEmail,
            lateFeeAmount,
            sentAt: dayjs(now).toISOString(),
          },
        });

        totals.sent += 1;
      } catch (error) {
        await ReminderLog.create({
          userId: invoice.userId,
          invoiceId: invoice._id,
          level: targetLevel,
          channel: 'email',
          status: 'failed',
          skippedReason: null,
          subject: `Reminder failed - ${invoice.invoiceNumber}`,
          bodyPreview: '',
          recipientEmail: invoice.clientSnapshot?.email || '',
          lateFeeAmount: 0,
          error: error instanceof Error ? error.message : String(error),
          sentAt: new Date(),
          pdfAttached: false,
        });

        await checkConsecutiveFailuresAndPause(invoice);
        totals.failed += 1;
      } finally {
        await releaseLock(lockKey);
      }
    }
  }

  return totals;
}
