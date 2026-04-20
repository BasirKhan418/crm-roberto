import type { DocumentProps } from '@react-pdf/renderer';
import { renderToBuffer } from '@react-pdf/renderer';
import dayjs from 'dayjs';
import mongoose from 'mongoose';
import React from 'react';

import ConnectDb from '@/db/connectDb';
import CompanyProfile from '@/db/models/CompanyProfile';
import Invoice from '@/db/models/Invoice';
import { ensureInvoiceIndexes } from '@/db/repository/ensureInvoiceIndexes';
import ConnectEmailClient from '@/emails/connectEmailClient';
import { sendInvoice } from '@/lib/email';
import { InvoicePdfTemplate } from '@/lib/pdf/InvoicePdfTemplate';
import { nextInvoiceNumber } from '@/lib/price';
import { normalizeReminderLocale } from '@/lib/reminders/formal-notice';

export type RecurrenceFrequency = 'monthly' | 'quarterly' | 'yearly' | 'custom';

export interface RecurrenceInput {
  frequency: RecurrenceFrequency;
  customIntervalDays?: number | null;
  endDate?: Date | null;
  nextOccurrenceAt?: Date | null;
  autoGenerate?: boolean;
  autoSend?: boolean;
}

export interface RecurrenceInvoiceLike {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  quoteNumber?: string | null;
  date?: Date | null;
  dueDate?: Date | null;
  status?: 'unpaid' | 'partial_paid' | 'paid' | 'overdue';
  clientId: mongoose.Types.ObjectId;
  clientSnapshot: {
    fullName: string;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    addressDetails?: {
      streetNumber?: string | null;
      streetName?: string | null;
      postalCode?: string | null;
      city?: string | null;
      country?: string | null;
    } | null;
    vatNumber?: string | null;
  };
  lineItems: Array<{
    productId?: mongoose.Types.ObjectId | null;
    productImageUrl?: string | null;
    name: string;
    quantity: number;
    unitPriceExcludingTax: number;
    baseUnitPriceExcludingTax: number;
    discountPercentage: number;
    vatRate: number;
    totalExcludingTaxBeforeDiscount: number;
    discountAmountExcludingTax: number;
    totalExcludingTax: number;
    vatAmount: number;
    totalIncludingTax: number;
  }>;
  totalExcludingTax: number;
  totalVat: number;
  totalIncludingTax: number;
  depositPercentage?: number | null;
  notes?: string | null;
  recurrence?: {
    isActive?: boolean;
    frequency?: RecurrenceFrequency | null;
    customIntervalDays?: number | null;
    nextOccurrenceAt?: Date | null;
    lastGeneratedAt?: Date | null;
    lastGeneratedInvoiceId?: mongoose.Types.ObjectId | null;
    endDate?: Date | null;
    stoppedAt?: Date | null;
    stoppedReason?: string | null;
    autoGenerate?: boolean;
    autoSend?: boolean;
  } | null;
}

export interface DuplicateRecurrenceResult {
  newInvoice: RecurrenceInvoiceLike;
  nextOccurrenceAt: Date | null;
}

function toDateOrNull(value?: string | Date | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function computeNextOccurrence(baseDate: Date, frequency: RecurrenceFrequency, customIntervalDays?: number | null): Date {
  if (frequency === 'monthly') {
    return dayjs(baseDate).add(1, 'month').toDate();
  }

  if (frequency === 'quarterly') {
    return dayjs(baseDate).add(3, 'month').toDate();
  }

  if (frequency === 'yearly') {
    return dayjs(baseDate).add(1, 'year').toDate();
  }

  return dayjs(baseDate).add(Math.max(1, Math.round(customIntervalDays ?? 1)), 'day').toDate();
}

export function normalizeRecurrencePayload(input: RecurrenceInput, invoiceDueDate?: Date | null): {
  isActive: true;
  frequency: RecurrenceFrequency;
  customIntervalDays: number | null;
  nextOccurrenceAt: Date;
  endDate: Date | null;
  autoGenerate: boolean;
  autoSend: boolean;
  stoppedAt: null;
  stoppedReason: null;
} {
  const dueDate = toDateOrNull(invoiceDueDate) ?? new Date();
  const customIntervalDays = input.frequency === 'custom' ? Math.max(1, Math.round(input.customIntervalDays ?? 1)) : null;
  const nextOccurrenceAt =
    toDateOrNull(input.nextOccurrenceAt) ?? computeNextOccurrence(dueDate, input.frequency, customIntervalDays);

  return {
    isActive: true,
    frequency: input.frequency,
    customIntervalDays,
    nextOccurrenceAt,
    endDate: toDateOrNull(input.endDate),
    autoGenerate: input.autoGenerate === true,
    autoSend: input.autoSend === true,
    stoppedAt: null,
    stoppedReason: null,
  };
}

async function getNextInvoiceNumberForYear(userId: string, year: number): Promise<string> {
  const yearPrefix = `INV-${year}-`;
  const lastInvoice = await Invoice.findOne({
    userId,
    invoiceNumber: { $regex: `^${yearPrefix}` },
  })
    .sort({ invoiceNumber: -1 })
    .select('invoiceNumber')
    .lean<{ invoiceNumber?: string } | null>();

  return nextInvoiceNumber(lastInvoice?.invoiceNumber ?? null, year);
}

function isInvoiceNumberDuplicateError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('E11000') && error.message.includes('invoiceNumber');
}

async function createInvoiceWithUniqueNumber(
  userId: string,
  year: number,
  payloadFactory: (invoiceNumber: string) => Record<string, unknown>
): Promise<RecurrenceInvoiceLike> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invoiceNumber = await getNextInvoiceNumberForYear(userId, year);

    try {
      const created = await Invoice.create(payloadFactory(invoiceNumber));
      return created.toObject() as RecurrenceInvoiceLike;
    } catch (error) {
      if (!isInvoiceNumberDuplicateError(error) || attempt === 4) {
        throw error;
      }
    }
  }

  throw new Error('Could not generate a unique invoice number');
}

export async function duplicateInvoiceForRecurrence({
  sourceInvoice,
  recurrence,
}: {
  sourceInvoice: RecurrenceInvoiceLike;
  recurrence: {
    frequency: RecurrenceFrequency;
    customIntervalDays?: number | null;
    nextOccurrenceAt: Date;
    endDate?: Date | null;
  };
}): Promise<DuplicateRecurrenceResult> {
  await ConnectDb();
  await ensureInvoiceIndexes();

  const userId = String(sourceInvoice.userId);
  const now = new Date();
  const nextDueDate = computeNextOccurrence(now, recurrence.frequency, recurrence.customIntervalDays);

  const newInvoice = await createInvoiceWithUniqueNumber(userId, now.getFullYear(), (invoiceNumber) => ({
    userId: sourceInvoice.userId,
    invoiceNumber,
    quoteId: null,
    quoteNumber: null,
    date: now,
    dueDate: nextDueDate,
    status: 'unpaid',
    clientId: sourceInvoice.clientId,
    clientSnapshot: sourceInvoice.clientSnapshot,
    lineItems: sourceInvoice.lineItems,
    totalExcludingTax: sourceInvoice.totalExcludingTax,
    totalVat: sourceInvoice.totalVat,
    totalIncludingTax: sourceInvoice.totalIncludingTax,
    depositPercentage: typeof sourceInvoice.depositPercentage === 'number' ? sourceInvoice.depositPercentage : 100,
    notes: sourceInvoice.notes ?? null,
    paymentToken: null,
    paymentTokenExpiry: null,
    reminderState: {
      level: 0,
      isPaused: false,
      lastSentAt: null,
      nextScheduledAt: null,
      lateFeeAmount: 0,
      formalNoticeSentAt: null,
      formalNoticeDeadline: null,
    },
    recurrence: null,
  }));

  const advancedNextOccurrenceAt = computeNextOccurrence(
    recurrence.nextOccurrenceAt,
    recurrence.frequency,
    recurrence.customIntervalDays
  );

  return {
    newInvoice,
    nextOccurrenceAt: recurrence.endDate && advancedNextOccurrenceAt > recurrence.endDate ? null : advancedNextOccurrenceAt,
  };
}

async function renderInvoicePdfForAutoSend({
  invoice,
  companyProfile,
  locale,
}: {
  invoice: RecurrenceInvoiceLike;
  companyProfile: Record<string, unknown> | null;
  locale: 'en' | 'fr';
}): Promise<Buffer> {
  const createPdfDocument = (logoUrlOverride?: string | null) =>
    React.createElement(InvoicePdfTemplate, {
      invoice: {
        status: invoice.status,
        invoiceNumber: invoice.invoiceNumber,
        quoteNumber: invoice.quoteNumber ?? null,
        date: invoice.date ?? new Date(),
        dueDate: invoice.dueDate ?? null,
        clientSnapshot: invoice.clientSnapshot,
        lineItems: invoice.lineItems,
        totalExcludingTaxBeforeDiscount: invoice.lineItems.reduce(
          (sum, item) => sum + item.baseUnitPriceExcludingTax * item.quantity,
          0
        ),
        totalDiscountExcludingTax: invoice.lineItems.reduce((sum, item) => sum + item.discountAmountExcludingTax, 0),
        totalExcludingTax: invoice.totalExcludingTax,
        totalVat: invoice.totalVat,
        totalIncludingTax: invoice.totalIncludingTax,
        depositPercentage: typeof invoice.depositPercentage === 'number' ? invoice.depositPercentage : 100,
        notes: invoice.notes ?? null,
        payments: [],
      },
      company: companyProfile
        ? {
            companyName: (companyProfile.companyName as string | null) ?? (companyProfile.ownerName as string | null) ?? 'CRM',
            ownerName: (companyProfile.ownerName as string | null) ?? null,
            address: (companyProfile.address as string | null) ?? null,
            streetNumber: (companyProfile.streetNumber as string | null) ?? null,
            streetName: (companyProfile.streetName as string | null) ?? null,
            postalCode: (companyProfile.postalCode as string | null) ?? null,
            city: (companyProfile.city as string | null) ?? null,
            country: (companyProfile.country as string | null) ?? null,
            phone: (companyProfile.phone as string | null) ?? null,
            businessEmail: (companyProfile.businessEmail as string | null) ?? null,
            vatNumber: (companyProfile.vatNumber as string | null) ?? null,
            rcsNumber: (companyProfile.rcsNumber as string | null) ?? null,
            businessAuthorizationNumber: (companyProfile.businessAuthorizationNumber as string | null) ?? null,
            matriculeNumber: (companyProfile.matriculeNumber as string | null) ?? null,
            iban: (companyProfile.iban as string | null) ?? null,
            bankName: (companyProfile.bankName as string | null) ?? null,
            legalIdentifier: (companyProfile.legalIdentifier as string | null) ?? null,
            logoUrl: logoUrlOverride ?? ((companyProfile.logoUrl as string | null) ?? null),
          }
        : null,
      paymentUrl: null,
      locale,
    }) as unknown as React.ReactElement<DocumentProps>;

  try {
    return await renderToBuffer(createPdfDocument());
  } catch {
    if (!companyProfile?.logoUrl) {
      throw new Error('Failed to generate recurring invoice PDF');
    }

    return renderToBuffer(createPdfDocument(''));
  }
}

export async function autoSendRecurringInvoiceToClient({
  invoice,
  userId,
}: {
  invoice: RecurrenceInvoiceLike;
  userId: string;
}): Promise<void> {
  const recipient = invoice.clientSnapshot?.email?.trim();
  if (!recipient) {
    throw new Error('Client email is required for auto-send');
  }

  const companyProfile = await CompanyProfile.findOne({ user: userId }).lean<Record<string, unknown> | null>();
  const locale = normalizeReminderLocale(companyProfile?.locale);
  const amount = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(Math.max(0, Math.round(invoice.totalIncludingTax ?? 0)) / 100);

  const pdfBuffer = await renderInvoicePdfForAutoSend({
    invoice,
    companyProfile,
    locale,
  });

  await sendInvoice({
    to: recipient,
    clientName: invoice.clientSnapshot?.fullName || 'Client',
    invoiceNumber: invoice.invoiceNumber,
    amount,
    companyName:
      ((companyProfile?.companyName as string | null) ?? (companyProfile?.ownerName as string | null) ?? 'CRM') ||
      'CRM',
    pdfBuffer,
    locale,
    includeOnlinePayment: false,
  });
}

export async function sendRecurrenceDueNotificationToOwner({
  ownerEmail,
  ownerName,
  invoiceNumber,
  invoiceDetailUrl,
  companyName,
}: {
  ownerEmail: string;
  ownerName: string;
  invoiceNumber: string;
  invoiceDetailUrl: string;
  companyName: string;
}): Promise<void> {
  const transporter = await ConnectEmailClient();
  if (!transporter) {
    throw new Error('Failed to connect to email service');
  }

  const subject = `Invoice ${invoiceNumber} is due to be renewed today`;
  const text = [
    `Hello ${ownerName},`,
    '',
    `Invoice ${invoiceNumber} is due to be renewed today.`,
    `Open invoice: ${invoiceDetailUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#1f2937;">
      <p>Hello ${ownerName},</p>
      <p>Invoice <strong>${invoiceNumber}</strong> is due to be renewed today.</p>
      <p><a href="${invoiceDetailUrl}">Open invoice</a></p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${companyName || 'CRM'}" <${process.env.EMAIL_USER_V2 || process.env.EMAIL_USER}>`,
    to: ownerEmail,
    subject,
    text,
    html,
  });
}
