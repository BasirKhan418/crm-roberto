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
import { sendInvoiceReminder } from '@/lib/email';
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
import { buildReminderVars, substituteVariables } from '@/lib/reminders/substitute-variables';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { sendReminderBodySchema } from '@/validators/reminder-actions.schema';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type InvoiceForReminder = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  date?: Date | null;
  dueDate?: Date | null;
  status: 'unpaid' | 'partial_paid' | 'paid' | 'overdue';
  totalIncludingTax?: number | null;
  clientSnapshot?: {
    fullName?: string | null;
    email?: string | null;
  } | null;
  paymentToken?: string | null;
  paymentTokenExpiry?: Date | null;
  reminderState?: {
    level?: number | null;
  } | null;
};

function normalizeLocale(value: unknown): 'en' | 'fr' {
  if (typeof value === 'string' && value.toLowerCase().startsWith('en')) {
    return 'en';
  }

  return 'fr';
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

    if (parsed.data.level === 4) {
      return NextResponse.json({ success: false, message: 'Formal notice sending is available in milestone 4' }, { status: 422 });
    }

    await ConnectDb();

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id })
      .select('_id userId invoiceNumber date dueDate status totalIncludingTax clientSnapshot paymentToken paymentTokenExpiry reminderState')
      .lean<InvoiceForReminder | null>();

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ success: false, message: 'Invoice is already paid' }, { status: 400 });
    }

    const settingsDoc = await ReminderSettings.findOne({ userId: me.user.id }).lean();
    const settings = settingsDoc ?? (new ReminderSettings({ userId: me.user.id }).toObject() as Record<string, unknown>);

    const companyProfile = await CompanyProfile.findOne({ user: me.user.id })
      .select('companyName ownerName locale')
      .lean<{ companyName?: string | null; ownerName?: string | null; locale?: string | null } | null>();

    const locale = normalizeLocale(companyProfile?.locale);
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

    const subject = parsed.data.subject?.trim()
      ? parsed.data.subject.trim()
      : substituteVariables(template?.subject || buildFallbackReminderSubject(level, invoice.invoiceNumber), vars);

    const renderedBody = parsed.data.body?.trim()
      ? parsed.data.body.trim()
      : substituteVariables(template?.body || '', vars);

    const recipientEmail = invoice.clientSnapshot?.email?.trim() || '';
    if (!recipientEmail) {
      return NextResponse.json({ success: false, message: 'Client email is required to send reminder' }, { status: 400 });
    }

    await sendInvoiceReminder({
      to: recipientEmail,
      clientName: invoice.clientSnapshot?.fullName || 'Client',
      companyName: companyProfile?.companyName || companyProfile?.ownerName || 'CRM',
      invoiceNumber: invoice.invoiceNumber,
      subject,
      htmlBody: renderedBody,
      locale,
    });

    const now = new Date();
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

    const log = await ReminderLog.create({
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

    return NextResponse.json({ success: true, log: log.toObject() });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error sending reminder: ${String(error)}` }, { status: 500 });
  }
}
