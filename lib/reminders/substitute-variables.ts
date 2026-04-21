import dayjs from 'dayjs';

import { buildInvoicePayUrl, isTokenExpired } from '@/lib/tokens';

export interface ReminderVariables {
  clientName: string;
  companyName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  daysOverdue: number;
  amountDue: string;
  amountOriginal: string;
  lateFees: string;
  paymentLink: string;
  legalDeadline: string;
}

type Locale = 'en' | 'fr';

const PAYMENT_LINK_VARIABLE_REGEX = /\{\{\s*paymentLink\s*\}\}|\{\s*paymentLink\s*\}/i;

type InvoiceLike = {
  invoiceNumber?: string | null;
  date?: Date | string | null;
  dueDate?: Date | string | null;
  totalIncludingTax?: number | null;
  clientSnapshot?: {
    fullName?: string | null;
  } | null;
  paymentToken?: string | null;
  paymentTokenExpiry?: Date | string | null;
  amountPaid?: number | null;
  paidAmount?: number | null;
  paymentsTotal?: number | null;
  payments?: Array<{ amount?: number | null }> | null;
};

type CompanyProfileLike = {
  companyName?: string | null;
  ownerName?: string | null;
};

const DEFAULT_APP_URL = '';

function asDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value as string | number | Date);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function formatDateByLocale(value: Date | null, locale: Locale): string {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value);
}

function formatCurrencyEur(cents: number, locale: Locale): string {
  const normalized = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(normalized / 100);
}

function resolvePaidAmount(invoice: InvoiceLike): number {
  if (typeof invoice.amountPaid === 'number') {
    return Math.max(0, Math.round(invoice.amountPaid));
  }

  if (typeof invoice.paidAmount === 'number') {
    return Math.max(0, Math.round(invoice.paidAmount));
  }

  if (typeof invoice.paymentsTotal === 'number') {
    return Math.max(0, Math.round(invoice.paymentsTotal));
  }

  if (Array.isArray(invoice.payments)) {
    return invoice.payments.reduce((sum, item) => sum + Math.max(0, Math.round(item?.amount ?? 0)), 0);
  }

  return 0;
}

export function substituteVariables(template: string, vars: ReminderVariables): string {
  return template.replace(/\{\{\s*([a-zA-Z][\w]*)\s*\}\}|\{\s*([a-zA-Z][\w]*)\s*\}/g, (_full, keyA: string, keyB: string) => {
    const key = keyA || keyB;
    const value = vars[key as keyof ReminderVariables];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function templateIncludesPaymentLinkVariable(template: string): boolean {
  return PAYMENT_LINK_VARIABLE_REGEX.test(template);
}

export function ensureReminderBodyHasPaymentLink({
  renderedBody,
  paymentLink,
  locale,
}: {
  renderedBody: string;
  paymentLink: string;
  locale: Locale;
}): string {
  if (!paymentLink) {
    return renderedBody;
  }

  if (renderedBody.includes(paymentLink)) {
    return renderedBody;
  }

  const suffix = locale === 'fr' ? `Lien de paiement: ${paymentLink}` : `Payment link: ${paymentLink}`;
  const trimmed = renderedBody.trim();

  return trimmed ? `${trimmed}\n\n${suffix}` : suffix;
}

export function buildReminderVars(
  invoice: InvoiceLike,
  _settings: unknown,
  companyProfile: CompanyProfileLike | null,
  locale: Locale
): ReminderVariables {
  const dueDate = asDate(invoice.dueDate);
  const invoiceDate = asDate(invoice.date);
  const invoiceTotal = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0));
  const paidAmount = resolvePaidAmount(invoice);
  const amountDueCents = Math.max(0, invoiceTotal - paidAmount);

  const daysOverdue = dueDate ? Math.max(0, dayjs().diff(dueDate, 'day')) : 0;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL;
  const hasValidToken =
    typeof invoice.paymentToken === 'string' &&
    invoice.paymentToken.trim().length > 0 &&
    !isTokenExpired(asDate(invoice.paymentTokenExpiry));

  const paymentLink = hasValidToken && appUrl ? buildInvoicePayUrl(invoice.paymentToken!.trim(), appUrl) : '';

  return {
    clientName: invoice.clientSnapshot?.fullName?.trim() || 'Client',
    companyName: companyProfile?.companyName?.trim() || companyProfile?.ownerName?.trim() || 'CRM',
    invoiceNumber: invoice.invoiceNumber?.trim() || '',
    invoiceDate: formatDateByLocale(invoiceDate, locale),
    dueDate: formatDateByLocale(dueDate, locale),
    daysOverdue,
    amountDue: formatCurrencyEur(amountDueCents, locale),
    amountOriginal: formatCurrencyEur(invoiceTotal, locale),
    lateFees: '',
    paymentLink,
    legalDeadline: '',
  };
}
