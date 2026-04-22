import dayjs from 'dayjs';
import mongoose from 'mongoose';

import ConnectDb from '@/db/connectDb';
import CompanyProfile from '@/db/models/CompanyProfile';
import Invoice from '@/db/models/Invoice';
import Notification from '@/db/models/Notification';
import Payment from '@/db/models/Payment';
import ReminderLog from '@/db/models/ReminderLog';
import ReminderSettings from '@/db/models/ReminderSettings';
import StripeConnect from '@/db/models/StripeConnect';
import { createActivityLog } from '@/db/repository/activity';
import { sendFormalNotice, sendInvoiceReminder } from '@/lib/email';
import { buildInvoicePayUrl, generatePaymentToken, generateTokenExpiry, isTokenExpired } from '@/lib/tokens';
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
  type LateFeeConfig,
  type ReminderLevel,
} from '@/lib/reminders/core';
import {
  normalizeReminderLocale,
  renderInvoicePdfForReminder,
  renderLegalNoticePdfForReminder,
  type CompanyProfileForReminder,
  type InvoiceForPdf,
  type PaymentHistoryItem,
} from '@/lib/reminders/formal-notice';
import { buildReminderVars, ensureReminderBodyHasPaymentLink, substituteVariables } from '@/lib/reminders/substitute-variables';

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
  totalExcludingTax?: number | null;
  totalVat?: number | null;
  quoteNumber?: string | null;
  depositPercentage?: number | null;
  notes?: string | null;
  lineItems?: Array<{
    name: string;
    quantity: number;
    baseUnitPriceExcludingTax: number;
    discountPercentage: number;
    discountAmountExcludingTax: number;
    vatRate: number;
    totalExcludingTax: number;
  }>;
  paymentToken?: string | null;
  paymentTokenExpiry?: Date | null;
  clientSnapshot?: {
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    companyName?: string | null;
    address?: string | null;
    addressDetails?: {
      streetNumber?: string | null;
      streetName?: string | null;
      postalCode?: string | null;
      city?: string | null;
      country?: string | null;
    } | null;
  } | null;
  reminderState?: {
    level?: number | null;
    isPaused?: boolean | null;
    nextScheduledAt?: Date | null;
  } | null;
};

type SettingsLike = {
  messageLocale?: 'auto' | 'en' | 'fr';
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
    stages?: Partial<Record<'soft' | 'medium' | 'firm' | 'formalNotice', { enabled?: boolean; type?: 'fixed' | 'percentage'; value?: number }>>;
  } | LateFeeConfig;
  legalNotice?: {
    delayDays?: 8 | 15;
    includeInterestClause?: boolean;
    customFooter?: string | null;
  };
};

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

async function loadPaymentHistory(invoiceId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId): Promise<PaymentHistoryItem[]> {
  const payments = await Payment.find({
    invoiceId,
    userId,
    status: 'succeeded',
  })
    .sort({ paidAt: -1, createdAt: -1 })
    .select('amount method type paidAt createdAt')
    .lean<Array<{
      amount: number;
      method: string;
      type: 'deposit' | 'full' | 'remaining_balance';
      paidAt?: Date | null;
      createdAt?: Date | null;
    }>>();

  return payments.map((item) => ({
    amount: item.amount,
    method: item.method,
    type: item.type,
    paidAt: item.paidAt ?? null,
    createdAt: item.createdAt ?? null,
  }));
}

function toInvoicePdfInput(invoice: InvoiceReminderCandidate): InvoiceForPdf {
  return {
    _id: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    quoteNumber: invoice.quoteNumber ?? null,
    date: invoice.date ?? null,
    dueDate: invoice.dueDate ?? null,
    status: invoice.status,
    lineItems: invoice.lineItems ?? [],
    totalExcludingTax: Math.max(0, Math.round(invoice.totalExcludingTax ?? 0)),
    totalVat: Math.max(0, Math.round(invoice.totalVat ?? 0)),
    totalIncludingTax: Math.max(0, Math.round(invoice.totalIncludingTax ?? 0)),
    depositPercentage: invoice.depositPercentage ?? 100,
    notes: invoice.notes ?? null,
    clientSnapshot: {
      fullName: invoice.clientSnapshot?.fullName || 'Client',
      companyName: invoice.clientSnapshot?.companyName ?? null,
      email: invoice.clientSnapshot?.email ?? null,
      phone: invoice.clientSnapshot?.phone ?? null,
      address: invoice.clientSnapshot?.address ?? null,
      addressDetails: invoice.clientSnapshot?.addressDetails ?? null,
    },
  };
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
  const profileCache = new Map<string, CompanyProfileForReminder | null>();
  const stripeConnectedCache = new Map<string, boolean>();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

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
        '_id userId invoiceNumber quoteNumber date dueDate status lineItems totalExcludingTax totalVat totalIncludingTax depositPercentage notes paymentToken paymentTokenExpiry clientSnapshot reminderState'
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
        const existingLevel = Math.max(
          1,
          Math.min(4, Math.round(Number(invoice.reminderState?.level ?? 0)) || 1)
        ) as ReminderLevel;
        try {
          await buildSkipLog({
            userId: invoice.userId,
            invoiceId: invoice._id,
            level: existingLevel,
            reason: 'invoice_paid',
            invoiceNumber: invoice.invoiceNumber,
            recipientEmail: invoice.clientSnapshot?.email || '',
          });
        } catch (err) {
          console.error('[reminder-pass] failed to write paid-skip log', err);
        }
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
            .select('companyName ownerName locale address streetNumber streetName postalCode city country phone businessEmail vatNumber rcsNumber businessAuthorizationNumber matriculeNumber iban bankName legalIdentifier logoUrl')
            .lean<CompanyProfileForReminder | null>();
          companyProfile = loadedProfile;
          profileCache.set(userId, companyProfile);
        }

        const locale =
          settings.messageLocale === 'en' || settings.messageLocale === 'fr'
            ? settings.messageLocale
            : normalizeReminderLocale(companyProfile?.locale);
        const levelKey = getReminderLevelKey(targetLevel);
        const template = settings.templates?.[locale]?.[levelKey] ?? settings.templates?.fr?.[levelKey] ?? settings.templates?.en?.[levelKey];

        const remainingAmount = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0) - (paidMap.get(String(invoice._id)) ?? 0));
        const lateFeeAmount = computeLateFeeAmountCents(remainingAmount, targetLevel, settings.lateFee);

        let stripeConnected = stripeConnectedCache.get(userId);
        if (stripeConnected === undefined) {
          const stripeConnect = await StripeConnect.findOne({ userId: invoice.userId })
            .select('onboardingComplete chargesEnabled')
            .lean<{ onboardingComplete?: boolean; chargesEnabled?: boolean } | null>();
          stripeConnected = Boolean(stripeConnect?.onboardingComplete && stripeConnect?.chargesEnabled);
          stripeConnectedCache.set(userId, stripeConnected);
        }

        let paymentLink = '';
        if (stripeConnected && appUrl) {
          let paymentToken = typeof invoice.paymentToken === 'string' && invoice.paymentToken.trim() ? invoice.paymentToken.trim() : '';
          let paymentTokenExpiry = invoice.paymentTokenExpiry ?? null;

          if (!paymentToken || isTokenExpired(paymentTokenExpiry)) {
            paymentToken = generatePaymentToken();
            paymentTokenExpiry = generateTokenExpiry(30);
            await Invoice.updateOne(
              { _id: invoice._id, userId: invoice.userId },
              { $set: { paymentToken, paymentTokenExpiry } }
            );
            invoice.paymentToken = paymentToken;
            invoice.paymentTokenExpiry = paymentTokenExpiry;
          }

          paymentLink = buildInvoicePayUrl(paymentToken, appUrl);
        }

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

        const vars = mergeLateFeeIntoVariables(
          {
            ...buildReminderVars(invoice, settings, companyProfile, locale),
            paymentLink,
          },
          lateFeeAmount,
          locale
        );
        const subject = substituteVariables(template?.subject || buildFallbackReminderSubject(targetLevel, invoice.invoiceNumber), vars);
        const renderedBody = ensureReminderBodyHasPaymentLink({
          renderedBody: substituteVariables(template?.body || '', vars),
          paymentLink: vars.paymentLink,
          locale,
        });
        const invoicePdfInput = toInvoicePdfInput(invoice);
        const invoicePdfBuffer = await renderInvoicePdfForReminder({
          invoice: invoicePdfInput,
          companyProfile,
          locale,
          paymentUrl: vars.paymentLink || null,
          lateFeeAmountCents: lateFeeAmount,
          payments: await loadPaymentHistory(invoice._id, invoice.userId),
        });

        if (targetLevel === 4) {
          const delayDays = settings.legalNotice?.delayDays === 15 ? 15 : 8;
          const includeInterestClause = settings.legalNotice?.includeInterestClause !== false;
          const customFooter = settings.legalNotice?.customFooter ?? null;
          const legalNoticeDate = new Date();
          const paymentUrl = vars.paymentLink || null;

          const formalVars = {
            ...vars,
            legalDeadline: dayjs(legalNoticeDate).add(delayDays, 'day').format('DD/MM/YYYY'),
          };
          const formalBody = ensureReminderBodyHasPaymentLink({
            renderedBody: substituteVariables(template?.body || '', formalVars),
            paymentLink: vars.paymentLink,
            locale,
          });
          const formalSubject = substituteVariables(
            template?.subject || buildFallbackReminderSubject(targetLevel, invoice.invoiceNumber),
            formalVars
          );

          const legalNoticeResult = await renderLegalNoticePdfForReminder({
            invoice: invoicePdfInput,
            companyProfile,
            locale,
            remainingAmountCents: remainingAmount,
            lateFeeAmountCents: lateFeeAmount,
            legalNoticeDate,
            delayDays,
            includeInterestClause,
            customFooter,
          });

          await sendFormalNotice({
            to: recipientEmail,
            clientName: invoice.clientSnapshot?.fullName || 'Client',
            companyName: companyProfile?.companyName || companyProfile?.ownerName || 'CRM',
            invoiceNumber: invoice.invoiceNumber,
            subject: formalSubject,
            htmlBody: formalBody,
            pdfBuffer: invoicePdfBuffer,
            legalNoticePdfBuffer: legalNoticeResult.pdfBuffer,
            locale,
          });

          await Invoice.updateOne(
            { _id: invoice._id, userId: invoice.userId },
            {
              $set: {
                'reminderState.level': 4,
                'reminderState.lastSentAt': legalNoticeDate,
                'reminderState.nextScheduledAt': null,
                'reminderState.isPaused': false,
                'reminderState.lateFeeAmount': lateFeeAmount,
                'reminderState.formalNoticeSentAt': legalNoticeDate,
                'reminderState.formalNoticeDeadline': legalNoticeResult.legalDeadline,
              },
            }
          );

          await ReminderLog.create({
            userId: invoice.userId,
            invoiceId: invoice._id,
            level: 4,
            channel: 'email',
            status: 'sent',
            skippedReason: null,
            subject: formalSubject,
            bodyPreview: buildBodyPreview(formalBody),
            recipientEmail,
            lateFeeAmount,
            error: null,
            sentAt: legalNoticeDate,
            pdfAttached: true,
          });

          await createActivityLog(userId, {
            action: 'invoice_formal_notice_sent',
            entityType: 'invoice',
            entityName: invoice.invoiceNumber,
            entityId: String(invoice._id),
            metadata: {
              deadline: legalNoticeResult.legalDeadline.toISOString(),
              lateFeeAmount,
            },
          });

          await Notification.create({
            userId: invoice.userId,
            type: 'formal_notice_sent',
            title: `Formal notice sent - ${invoice.invoiceNumber}`,
            message: `Formal notice sent to ${recipientEmail}`,
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
          });
        } else {
          await sendInvoiceReminder({
            to: recipientEmail,
            clientName: invoice.clientSnapshot?.fullName || 'Client',
            companyName: companyProfile?.companyName || companyProfile?.ownerName || 'CRM',
            invoiceNumber: invoice.invoiceNumber,
            subject,
            htmlBody: renderedBody,
            pdfBuffer: invoicePdfBuffer,
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
            pdfAttached: true,
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

          await Notification.create({
            userId: invoice.userId,
            type: 'reminder_sent',
            title: `Reminder sent - ${invoice.invoiceNumber}`,
            message: `Level ${targetLevel} reminder sent to ${recipientEmail}`,
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
          });
        }

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
