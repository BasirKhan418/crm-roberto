export type PaymentLocale = 'en' | 'fr';
export type StoredPaymentType = 'deposit' | 'full' | 'remaining_balance';

export const MANUAL_PAYMENT_METHOD_OPTIONS = ['cash', 'bank_transfer', 'card', 'check', 'custom'] as const;

export type ManualPaymentMethodOption = (typeof MANUAL_PAYMENT_METHOD_OPTIONS)[number];

const PAYMENT_METHOD_LABELS = {
  en: {
    cash: 'Cash',
    bank_transfer: 'Bank transfer',
    card: 'Card',
    check: 'Check',
    manual_offline: 'Offline payment',
    other: 'Other',
    sepa_debit: 'SEPA direct debit',
    paypal: 'PayPal',
    apple_pay: 'Apple Pay',
    google_pay: 'Google Pay',
    link: 'Link',
    ideal: 'iDEAL',
    bancontact: 'Bancontact',
    eps: 'EPS',
    sofort: 'Sofort',
    giropay: 'Giropay',
  },
  fr: {
    cash: 'Especes',
    bank_transfer: 'Virement bancaire',
    card: 'Carte',
    check: 'Cheque',
    manual_offline: 'Paiement hors ligne',
    other: 'Autre',
    sepa_debit: 'Prelevement SEPA',
    paypal: 'PayPal',
    apple_pay: 'Apple Pay',
    google_pay: 'Google Pay',
    link: 'Link',
    ideal: 'iDEAL',
    bancontact: 'Bancontact',
    eps: 'EPS',
    sofort: 'Sofort',
    giropay: 'Giropay',
  },
} as const;

const PAYMENT_TYPE_LABELS = {
  en: {
    deposit: 'Deposit',
    full: 'Full payment',
    remaining_balance: 'Partial payment',
  },
  fr: {
    deposit: 'Acompte',
    full: 'Paiement complet',
    remaining_balance: 'Paiement partiel',
  },
} as const;

const PAYMENT_METHOD_ALIASES: Record<string, keyof typeof PAYMENT_METHOD_LABELS.en> = {
  cash: 'cash',
  especes: 'cash',
  card: 'card',
  carte: 'card',
  check: 'check',
  cheque: 'check',
  bank_transfer: 'bank_transfer',
  'bank transfer': 'bank_transfer',
  'bank-transfer': 'bank_transfer',
  transfer: 'bank_transfer',
  wire: 'bank_transfer',
  virement: 'bank_transfer',
  'virement bancaire': 'bank_transfer',
  other: 'other',
  custom: 'other',
  manual_offline: 'manual_offline',
  'manual offline': 'manual_offline',
  offline: 'manual_offline',
  'offline payment': 'manual_offline',
  sepa_debit: 'sepa_debit',
  'sepa debit': 'sepa_debit',
  paypal: 'paypal',
  apple_pay: 'apple_pay',
  'apple pay': 'apple_pay',
  google_pay: 'google_pay',
  'google pay': 'google_pay',
  link: 'link',
  ideal: 'ideal',
  bancontact: 'bancontact',
  eps: 'eps',
  sofort: 'sofort',
  giropay: 'giropay',
};

function sanitizePaymentMethodText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\s+/g, ' ').slice(0, 80);
}

function canonicalizePaymentMethodKey(value: string): keyof typeof PAYMENT_METHOD_LABELS.en | null {
  const normalized = sanitizePaymentMethodText(value).toLowerCase();
  if (!normalized) {
    return null;
  }

  return PAYMENT_METHOD_ALIASES[normalized] ?? null;
}

function titleCaseWords(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatUnknownPaymentMethod(value: string): string {
  const compact = sanitizePaymentMethodText(value);
  if (!compact) {
    return '-';
  }

  if (/^[a-z0-9_-]+$/.test(compact)) {
    return titleCaseWords(compact.replace(/[_-]+/g, ' '));
  }

  return compact;
}

export function resolveStoredPaymentMethod(method: unknown, customMethod?: unknown):
  | { ok: true; value: string }
  | { ok: false; message: string } {
  const sanitizedMethod = sanitizePaymentMethodText(method);
  const sanitizedCustomMethod = sanitizePaymentMethodText(customMethod);
  const canonicalMethod = canonicalizePaymentMethodKey(sanitizedMethod);

  if (canonicalMethod === 'other') {
    if (!sanitizedCustomMethod) {
      return { ok: false, message: 'Custom payment method is required' };
    }

    return { ok: true, value: sanitizedCustomMethod };
  }

  if (canonicalMethod) {
    return { ok: true, value: canonicalMethod };
  }

  if (sanitizedMethod) {
    return { ok: true, value: sanitizedMethod };
  }

  if (sanitizedCustomMethod) {
    return { ok: true, value: sanitizedCustomMethod };
  }

  return { ok: true, value: 'manual_offline' };
}

export function getPaymentMethodLabel(method: string | null | undefined, locale: PaymentLocale): string {
  if (!method) {
    return '-';
  }

  const canonicalMethod = canonicalizePaymentMethodKey(method);
  if (canonicalMethod) {
    return PAYMENT_METHOD_LABELS[locale][canonicalMethod];
  }

  return formatUnknownPaymentMethod(method);
}

export function getPaymentTypeLabel(type: StoredPaymentType | null | undefined, locale: PaymentLocale): string {
  if (!type) {
    return '-';
  }

  return PAYMENT_TYPE_LABELS[locale][type] ?? titleCaseWords(type.replace(/[_-]+/g, ' '));
}