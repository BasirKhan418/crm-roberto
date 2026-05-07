import type { DocumentProps } from '@react-pdf/renderer';
import { renderToBuffer } from '@react-pdf/renderer';
import dayjs from 'dayjs';
import mongoose from 'mongoose';
import React from 'react';

import { formatStructuredAddress, hasStructuredAddress } from '@/lib/address';
import { extractClientSnapshot } from '@/lib/address';
import { getInvoiceDaysOverdue } from '@/lib/invoices/overdue';
import { formatInvoiceDisplayNumber } from '@/lib/i18n/messages';
import { InvoicePdfTemplate } from '@/lib/pdf/InvoicePdfTemplate';
import { type LegalNoticePdfProps, renderLegalNoticePdf } from '@/lib/pdf/LegalNoticePdfTemplate';

export type ReminderLocale = 'en' | 'fr';

export interface CompanyProfileForReminder {
  companyName?: string | null;
  ownerName?: string | null;
  address?: string | null;
  streetNumber?: string | null;
  streetName?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  businessEmail?: string | null;
  vatNumber?: string | null;
  rcsNumber?: string | null;
  businessAuthorizationNumber?: string | null;
  matriculeNumber?: string | null;
  iban?: string | null;
  bankName?: string | null;
  legalIdentifier?: string | null;
  logoUrl?: string | null;
  locale?: string | null;
}

export interface InvoiceForPdf {
  _id: mongoose.Types.ObjectId;
  invoiceNumber: string;
  quoteNumber?: string | null;
  date?: Date | null;
  dueDate?: Date | null;
  status?: 'unpaid' | 'partial_paid' | 'paid' | 'overdue';
  totalExcludingTax?: number;
  totalVat?: number;
  totalIncludingTax?: number;
  depositPercentage?: number;
  notes?: string | null;
  lineItems: Array<{
    name: string;
    quantity: number;
    baseUnitPriceExcludingTax: number;
    discountPercentage: number;
    discountAmountExcludingTax: number;
    vatRate: number;
    totalExcludingTax: number;
    lineType?: 'catalog' | 'custom' | 'free_text' | 'item' | null;
  }>;
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
  };
}

export interface PaymentHistoryItem {
  amount: number;
  method: string;
  type: 'deposit' | 'full' | 'remaining_balance';
  paidAt?: Date | null;
  createdAt?: Date | null;
}

function isNonEmpty(value?: string | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeReminderLocale(value: unknown): ReminderLocale {
  if (typeof value === 'string' && value.toLowerCase().startsWith('en')) {
    return 'en';
  }

  return 'fr';
}

export function resolveReminderLocalePreference(...values: unknown[]): ReminderLocale {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase();
      if (trimmed === 'en' || trimmed.startsWith('en-')) {
        return 'en';
      }
      if (trimmed === 'fr' || trimmed.startsWith('fr-')) {
        return 'fr';
      }
    }
  }

  return 'fr';
}

export function formatDateForLocale(date: Date | string | null | undefined, locale: ReminderLocale): string {
  if (!date) {
    return '';
  }

  const parsed = new Date(date);
  if (!Number.isFinite(parsed.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .format(parsed)
    .replace(/[\u00a0\u202f]/g, ' ');
}

export function formatEurFromCents(cents: number, locale: ReminderLocale): string {
  const normalized = Number.isFinite(cents) ? cents : 0;

  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
  })
    .format(normalized / 100)
    .replace(/[\u00a0\u202f]/g, ' ');
}

export function resolveCompanyDisplayName(profile: CompanyProfileForReminder | null): string {
  if (isNonEmpty(profile?.companyName)) {
    return profile!.companyName.trim();
  }

  if (isNonEmpty(profile?.ownerName)) {
    return profile!.ownerName.trim();
  }

  return 'CRM';
}

export function resolveClientAddress(snapshot: InvoiceForPdf['clientSnapshot']): string {
  if (hasStructuredAddress(snapshot.addressDetails)) {
    return formatStructuredAddress(snapshot.addressDetails) || '';
  }

  return (snapshot.address || '').trim();
}

export function computeLegalDeadline(baseDate: Date, delayDays: 8 | 15): Date {
  return dayjs(baseDate).add(delayDays, 'day').toDate();
}

export async function renderInvoicePdfForReminder({
  invoice,
  companyProfile,
  locale,
  paymentUrl,
  lateFeeAmountCents,
  payments,
}: {
  invoice: InvoiceForPdf;
  companyProfile: CompanyProfileForReminder | null;
  locale: ReminderLocale;
  paymentUrl?: string | null;
  lateFeeAmountCents: number;
  payments: PaymentHistoryItem[];
}): Promise<Buffer> {
  const totalExcludingTaxBeforeDiscount = invoice.lineItems.reduce(
    (sum, item) => sum + item.baseUnitPriceExcludingTax * item.quantity,
    0
  );

  const totalDiscountExcludingTax = invoice.lineItems.reduce(
    (sum, item) => sum + item.discountAmountExcludingTax,
    0
  );

  const baseCompanyData = companyProfile
    ? {
        companyName: companyProfile.companyName ?? companyProfile.ownerName ?? 'CRM',
        ownerName: companyProfile.ownerName ?? null,
        address: companyProfile.address ?? null,
        streetNumber: companyProfile.streetNumber ?? null,
        streetName: companyProfile.streetName ?? null,
        postalCode: companyProfile.postalCode ?? null,
        city: companyProfile.city ?? null,
        country: companyProfile.country ?? null,
        phone: companyProfile.phone ?? null,
        businessEmail: companyProfile.businessEmail ?? null,
        vatNumber: companyProfile.vatNumber ?? null,
        rcsNumber: companyProfile.rcsNumber ?? null,
        businessAuthorizationNumber: companyProfile.businessAuthorizationNumber ?? null,
        matriculeNumber: companyProfile.matriculeNumber ?? null,
        iban: companyProfile.iban ?? null,
        bankName: companyProfile.bankName ?? null,
        legalIdentifier: companyProfile.legalIdentifier ?? null,
        logoUrl: companyProfile.logoUrl ?? null,
      }
    : null;

  const createPdfDocument = (logoUrlOverride?: string | null) =>
    React.createElement(InvoicePdfTemplate, {
      invoice: {
        status: invoice.status,
        invoiceNumber: invoice.invoiceNumber,
        quoteNumber: invoice.quoteNumber ?? null,
        date: invoice.date ?? new Date(),
        dueDate: invoice.dueDate ?? null,
        clientSnapshot: extractClientSnapshot(invoice.clientSnapshot),
        lineItems: invoice.lineItems,
        totalExcludingTaxBeforeDiscount,
        totalDiscountExcludingTax,
        totalExcludingTax: Math.max(0, Math.round(invoice.totalExcludingTax ?? 0)),
        totalVat: Math.max(0, Math.round(invoice.totalVat ?? 0)),
        totalIncludingTax: Math.max(0, Math.round(invoice.totalIncludingTax ?? 0)),
        lateFeeAmountCents,
        depositPercentage: typeof invoice.depositPercentage === 'number' ? invoice.depositPercentage : 100,
        notes: invoice.notes ?? null,
        payments,
      },
      company: baseCompanyData
        ? {
            ...baseCompanyData,
            logoUrl: logoUrlOverride ?? baseCompanyData.logoUrl,
          }
        : null,
      paymentUrl: paymentUrl ?? null,
      locale,
    }) as unknown as React.ReactElement<DocumentProps>;

  try {
    return await renderToBuffer(createPdfDocument());
  } catch {
    if (!baseCompanyData?.logoUrl) {
      throw new Error('Failed to render invoice PDF');
    }

    return renderToBuffer(createPdfDocument(''));
  }
}

export async function renderLegalNoticePdfForReminder({
  invoice,
  companyProfile,
  locale,
  remainingAmountCents,
  lateFeeAmountCents,
  legalNoticeDate,
  delayDays,
  includeInterestClause,
  customFooter,
}: {
  invoice: InvoiceForPdf;
  companyProfile: CompanyProfileForReminder | null;
  locale: ReminderLocale;
  remainingAmountCents: number;
  lateFeeAmountCents: number;
  legalNoticeDate: Date;
  delayDays: 8 | 15;
  includeInterestClause: boolean;
  customFooter?: string | null;
}): Promise<{ pdfBuffer: Buffer; legalDeadline: Date; props: LegalNoticePdfProps }> {
  const legalDeadline = computeLegalDeadline(legalNoticeDate, delayDays);
  const daysOverdue = getInvoiceDaysOverdue(invoice.dueDate);

  // Formal notices are allowed even when the invoice is not yet overdue. `getInvoiceDaysOverdue`
  // safely returns 0 in that case, which renders correctly in the PDF.

  const props: LegalNoticePdfProps = {
    companyProfile: {
      logo: companyProfile?.logoUrl ?? null,
      name: resolveCompanyDisplayName(companyProfile),
      ownerName: companyProfile?.ownerName ?? null,
      address: companyProfile?.address ?? null,
      vatNumber: companyProfile?.vatNumber ?? null,
      iban: companyProfile?.iban ?? null,
      bankName: companyProfile?.bankName ?? null,
    },
    clientName: invoice.clientSnapshot.fullName || 'Client',
    clientAddress: resolveClientAddress(invoice.clientSnapshot),
    invoiceNumber: formatInvoiceDisplayNumber(locale, invoice.invoiceNumber),
    invoiceDate: formatDateForLocale(invoice.date, locale),
    dueDate: formatDateForLocale(invoice.dueDate, locale),
    daysOverdue,
    amountDue: formatEurFromCents(Math.max(0, remainingAmountCents + lateFeeAmountCents), locale),
    amountOriginal: formatEurFromCents(Math.max(0, Math.round(invoice.totalIncludingTax ?? 0)), locale),
    lateFees: lateFeeAmountCents > 0 ? formatEurFromCents(lateFeeAmountCents, locale) : '',
    legalDeadline: formatDateForLocale(legalDeadline, locale),
    legalNoticeDate: formatDateForLocale(legalNoticeDate, locale),
    delayDays,
    includeInterestClause,
    customFooter: customFooter ?? undefined,
    locale,
  };

  const pdfBuffer = await renderLegalNoticePdf(props);
  return { pdfBuffer, legalDeadline, props };
}
