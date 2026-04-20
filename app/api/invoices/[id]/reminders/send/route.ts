import dayjs from 'dayjs';
import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import CompanyProfile from '@/db/models/CompanyProfile';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import ReminderLog from '@/db/models/ReminderLog';
import ReminderSettings from '@/db/models/ReminderSettings';
import { createActivityLog } from '@/db/repository/activity';
import { sendFormalNotice, sendInvoiceReminder } from '@/lib/email';
import {
  buildBodyPreview,
  buildFallbackReminderSubject,
  computeLateFeeAmountCents,
  computeNextScheduledAt,
  getReminderLevelKey,
  mergeLateFeeIntoVariables,
  normalizeOffsets,
  type ReminderLevel,
} from '@/lib/reminders/core';
import {
  computeLegalDeadline,
  normalizeReminderLocale,
  renderInvoicePdfForReminder,
  renderLegalNoticePdfForReminder,
  type CompanyProfileForReminder,
  type InvoiceForPdf,
  type PaymentHistoryItem,
} from '@/lib/reminders/formal-notice';
import { buildReminderVars, substituteVariables } from '@/lib/reminders/substitute-variables';
import { buildInvoicePayUrl, isTokenExpired } from '@/lib/tokens';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { sendReminderBodySchema } from '@/validators/reminder-actions.schema';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const DEFAULT_REMINDER_STATE = {
  level: 0,
  lastSentAt: null,
  nextScheduledAt: null,
  isPaused: false,
  lateFeeAmount: 0,
  formalNoticeSentAt: null,
  formalNoticeDeadline: null,
};

type InvoiceForReminder = {
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
  paymentToken?: string | null;
  paymentTokenExpiry?: Date | null;
  reminderState?: {
    level?: number | null;
  } | null;
};

async function loadPaymentHistory(invoiceId: mongoose.Types.ObjectId, userId: string): Promise<PaymentHistoryItem[]> {
  const payments = await Payment.find({ invoiceId, userId, status: 'succeeded' })
    .sort({ paidAt: -1, createdAt: -1 })
    .select('amount method type paidAt createdAt')
    .lean<Array<{ amount: number; method: string; type: 'deposit' | 'full' | 'remaining_balance'; paidAt?: Date | null; createdAt?: Date | null }>>();

  return payments.map((item) => ({
    amount: item.amount,
    method: item.method,
    type: item.type,
    paidAt: item.paidAt ?? null,
    createdAt: item.createdAt ?? null,
  }));
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const payload = await request.json();
    const parsed = sendReminderBodySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    await ConnectDb();

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id })
      .select('_id userId invoiceNumber quoteNumber date dueDate status lineItems totalExcludingTax totalVat totalIncludingTax depositPercentage notes clientSnapshot paymentToken paymentTokenExpiry reminderState')
      .lean<InvoiceForReminder | null>();

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    await Invoice.updateOne(
      {
        _id: invoice._id,
        userId: me.user.id,
        $or: [{ reminderState: null }, { reminderState: { $exists: false } }],
      },
      { $set: { reminderState: DEFAULT_REMINDER_STATE } }
    );

    if (invoice.status === 'paid') {
      return NextResponse.json({ success: false, message: 'Invoice is already paid' }, { status: 400 });
    }

    const settingsDoc = await ReminderSettings.findOne({ userId: me.user.id }).lean();
    const settings = settingsDoc ?? (new ReminderSettings({ userId: me.user.id }).toObject() as Record<string, unknown>);

    const companyProfile = await CompanyProfile.findOne({ user: me.user.id })
      .select('companyName ownerName locale address streetNumber streetName postalCode city country phone businessEmail vatNumber rcsNumber businessAuthorizationNumber matriculeNumber iban bankName legalIdentifier logoUrl')
      .lean<CompanyProfileForReminder | null>();

    const resolvedByProfile = normalizeReminderLocale(companyProfile?.locale);
    const messageLocale = (settings as { messageLocale?: 'auto' | 'en' | 'fr' }).messageLocale ?? 'auto';
    const locale =
      messageLocale === 'en' || messageLocale === 'fr'
        ? messageLocale
        : parsed.data.locale === 'en' || parsed.data.locale === 'fr'
          ? parsed.data.locale
          : resolvedByProfile;
    const offsets = normalizeOffsets((settings as { offsets?: { soft?: number; medium?: number; firm?: number; formalNotice?: number } }).offsets);

    const level = parsed.data.level as ReminderLevel;
    const levelKey = getReminderLevelKey(level);

    const totals = await Payment.aggregate<{ _id: null; totalPaid: number }>([
      { $match: { invoiceId: invoice._id, status: 'succeeded' } },
      { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
    ]);

    const totalPaid = Math.max(0, Math.round(totals[0]?.totalPaid ?? 0));
    const remainingAmount = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0) - totalPaid);

    const lateFeeAmount = computeLateFeeAmountCents(
      remainingAmount,
      level,
      (settings as { lateFee?: { enabled?: boolean; type?: 'fixed' | 'percentage'; value?: number; applyFrom?: 'medium' | 'firm' | 'formalNotice' } }).lateFee
    );

    const vars = mergeLateFeeIntoVariables(
      buildReminderVars(invoice, settings, companyProfile, locale),
      lateFeeAmount,
      locale
    );

    const template = (
      settings as {
        templates?: {
          en?: Record<'soft' | 'medium' | 'firm' | 'formalNotice', { subject: string; body: string }>;
          fr?: Record<'soft' | 'medium' | 'firm' | 'formalNotice', { subject: string; body: string }>;
        };
      }
    ).templates?.[locale]?.[levelKey];

    const subjectTemplate = parsed.data.subject?.trim()
      ? parsed.data.subject.trim()
      : template?.subject || buildFallbackReminderSubject(level, invoice.invoiceNumber);

    const bodyTemplate = parsed.data.body?.trim()
      ? parsed.data.body.trim()
      : template?.body || '';

    const recipientEmail = invoice.clientSnapshot?.email?.trim() || '';
    if (!recipientEmail) {
      return NextResponse.json({ success: false, message: 'Client email is required to send reminder' }, { status: 400 });
    }

    const now = new Date();
    let log;

    if (level === 4) {
      const legalNoticeSettings = (settings as {
        legalNotice?: { delayDays?: 8 | 15; includeInterestClause?: boolean; customFooter?: string | null };
      }).legalNotice;

      const delayDays = legalNoticeSettings?.delayDays === 15 ? 15 : 8;
      const includeInterestClause = legalNoticeSettings?.includeInterestClause !== false;
      const customFooter = legalNoticeSettings?.customFooter ?? null;
      const legalDeadline = computeLegalDeadline(now, delayDays);
      const paymentUrl =
        (process.env.NEXT_PUBLIC_APP_URL || '') &&
        typeof invoice.paymentToken === 'string' &&
        invoice.paymentToken.trim() &&
        !isTokenExpired(invoice.paymentTokenExpiry ?? null)
          ? buildInvoicePayUrl(invoice.paymentToken.trim(), process.env.NEXT_PUBLIC_APP_URL || '')
          : null;

      const invoicePdfBuffer = await renderInvoicePdfForReminder({
        invoice: {
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
        } satisfies InvoiceForPdf,
        companyProfile,
        locale,
        paymentUrl,
        lateFeeAmountCents: lateFeeAmount,
        payments: await loadPaymentHistory(invoice._id, me.user.id),
      });

      const legalVars = {
        ...vars,
        legalDeadline: dayjs(legalDeadline).format('DD/MM/YYYY'),
      };

      const subject = substituteVariables(subjectTemplate, legalVars);
      const renderedBody = substituteVariables(bodyTemplate, legalVars);

      const legalNoticeResult = await renderLegalNoticePdfForReminder({
        invoice: {
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
        } satisfies InvoiceForPdf,
        companyProfile,
        locale,
        remainingAmountCents: remainingAmount,
        lateFeeAmountCents: lateFeeAmount,
        legalNoticeDate: now,
        delayDays,
        includeInterestClause,
        customFooter,
      });

      await sendFormalNotice({
        to: recipientEmail,
        clientName: invoice.clientSnapshot?.fullName || 'Client',
        companyName: companyProfile?.companyName || companyProfile?.ownerName || 'CRM',
        invoiceNumber: invoice.invoiceNumber,
        subject,
        htmlBody: renderedBody,
        pdfBuffer: invoicePdfBuffer,
        legalNoticePdfBuffer: legalNoticeResult.pdfBuffer,
        locale,
      });

      await Invoice.updateOne(
        { _id: invoice._id, userId: me.user.id },
        {
          $set: {
            'reminderState.level': 4,
            'reminderState.lastSentAt': now,
            'reminderState.nextScheduledAt': null,
            'reminderState.isPaused': false,
            'reminderState.lateFeeAmount': lateFeeAmount,
            'reminderState.formalNoticeSentAt': now,
            'reminderState.formalNoticeDeadline': legalDeadline,
          },
        }
      );

      log = await ReminderLog.create({
        userId: me.user.id,
        invoiceId: invoice._id,
        level: 4,
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

      await createActivityLog(me.user.id, {
        action: 'invoice_formal_notice_sent',
        entityType: 'invoice',
        entityName: invoice.invoiceNumber,
        entityId: String(invoice._id),
        metadata: {
          deadline: legalDeadline.toISOString(),
          lateFeeAmount,
        },
      });
    } else {
      const subject = substituteVariables(subjectTemplate, vars);
      const renderedBody = substituteVariables(bodyTemplate, vars);

      await sendInvoiceReminder({
        to: recipientEmail,
        clientName: invoice.clientSnapshot?.fullName || 'Client',
        companyName: companyProfile?.companyName || companyProfile?.ownerName || 'CRM',
        invoiceNumber: invoice.invoiceNumber,
        subject,
        htmlBody: renderedBody,
        locale,
      });

      const nextScheduledAt = computeNextScheduledAt(invoice.dueDate, level, offsets);

      await Invoice.updateOne(
        { _id: invoice._id, userId: me.user.id },
        {
          $set: {
            'reminderState.level': level,
            'reminderState.lastSentAt': now,
            'reminderState.nextScheduledAt': nextScheduledAt,
            'reminderState.isPaused': false,
            'reminderState.lateFeeAmount': lateFeeAmount,
          },
        }
      );

      log = await ReminderLog.create({
        userId: me.user.id,
        invoiceId: invoice._id,
        level,
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

      await createActivityLog(me.user.id, {
        action: 'invoice_reminder_sent',
        entityType: 'invoice',
        entityName: invoice.invoiceNumber,
        entityId: String(invoice._id),
        metadata: {
          level,
          channel: 'email',
          recipientEmail,
          lateFeeAmount,
          sentAt: dayjs(now).toISOString(),
        },
      });
    }

    return NextResponse.json({ success: true, log: log.toObject() });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error sending reminder: ${String(error)}` }, { status: 500 });
  }
}
