import mongoose from 'mongoose';

import { getInvoiceDaysOverdue } from '@/lib/invoices/overdue';
import {
  type CompanyProfileForReminder,
  type InvoiceForPdf,
  type ReminderLocale,
  formatDateForLocale,
  formatEurFromCents,
  resolveClientAddress,
  resolveCompanyDisplayName,
} from '@/lib/reminders/formal-notice';
import { formatInvoiceDisplayNumber } from '@/lib/i18n/messages';
import { amountCentsToWords } from '@/lib/reminders/amount-in-words';
import {
  type PaymentOrderCourtLocation,
  type PaymentOrderPdfProps,
  type PaymentOrderReminderEvent,
  renderPaymentOrderPdf,
} from '@/lib/pdf/PaymentOrderPdfTemplate';

export const DEFAULT_LEGAL_RECOVERY_CLAIM_THRESHOLD_CENTS = 1_500_000; // €15,000

export type LegalRecoveryCourtLocation = Exclude<PaymentOrderCourtLocation, null>;

export const LEGAL_RECOVERY_COURT_LOCATIONS: LegalRecoveryCourtLocation[] = [
  'luxembourg',
  'esch_sur_alzette',
  'diekirch',
];

export interface LegalRecoveryCourtConfig {
  courtName?: string | null;
  courtAddress?: string | null;
  courtCity?: string | null;
  creditorProfession?: string | null;
  elisantDomicile?: string | null;
  representativeName?: string | null;
  representativeTitle?: string | null;
  additionalNotes?: string | null;
}

export interface LegalRecoverySettings {
  claimThresholdCents?: number | null;
  jurisdiction?: 'justice_of_peace' | string | null;
  courts?: Partial<Record<LegalRecoveryCourtLocation, LegalRecoveryCourtConfig | null>> | null;
  courtLocation?: PaymentOrderCourtLocation;
  courtName?: string | null;
  courtAddress?: string | null;
  courtCity?: string | null;
  creditorProfession?: string | null;
  elisantDomicile?: string | null;
  representativeName?: string | null;
  representativeTitle?: string | null;
  additionalNotes?: string | null;
}

function toTrimmedOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeLegalRecoveryCourtConfig(
  court: LegalRecoveryCourtConfig | null | undefined
): LegalRecoveryCourtConfig {
  return {
    courtName: toTrimmedOrNull(court?.courtName),
    courtAddress: toTrimmedOrNull(court?.courtAddress),
    courtCity: toTrimmedOrNull(court?.courtCity),
    creditorProfession: toTrimmedOrNull(court?.creditorProfession),
    elisantDomicile: toTrimmedOrNull(court?.elisantDomicile),
    representativeName: toTrimmedOrNull(court?.representativeName),
    representativeTitle: toTrimmedOrNull(court?.representativeTitle),
    additionalNotes: toTrimmedOrNull(court?.additionalNotes),
  };
}

export function isLegalRecoveryCourtConfigured(court: LegalRecoveryCourtConfig | null | undefined): boolean {
  const normalized = normalizeLegalRecoveryCourtConfig(court);
  return Boolean(normalized.courtName);
}

function hasAnyCourtConfigValue(court: LegalRecoveryCourtConfig | null | undefined): boolean {
  const normalized = normalizeLegalRecoveryCourtConfig(court);
  return Boolean(
    normalized.courtName ||
    normalized.courtAddress ||
    normalized.courtCity ||
    normalized.creditorProfession ||
    normalized.elisantDomicile ||
    normalized.representativeName ||
    normalized.representativeTitle ||
    normalized.additionalNotes
  );
}

export function resolveLegalRecoveryCourtConfig(
  settings: LegalRecoverySettings | null | undefined,
  courtLocation: PaymentOrderCourtLocation
): LegalRecoveryCourtConfig {
  if (!courtLocation) {
    return normalizeLegalRecoveryCourtConfig(null);
  }

  const configuredCourt = settings?.courts?.[courtLocation] ?? null;
  if (hasAnyCourtConfigValue(configuredCourt)) {
    return normalizeLegalRecoveryCourtConfig(configuredCourt);
  }

  const legacyCourt = normalizeLegalRecoveryCourtConfig({
    courtName: settings?.courtName,
    courtAddress: settings?.courtAddress,
    courtCity: settings?.courtCity,
    creditorProfession: settings?.creditorProfession,
    elisantDomicile: settings?.elisantDomicile,
    representativeName: settings?.representativeName,
    representativeTitle: settings?.representativeTitle,
    additionalNotes: settings?.additionalNotes,
  });

  // Only use legacy flat-field data for the court location it was originally saved under.
  // Default to 'luxembourg' when courtLocation is absent (pre-multi-court migration).
  const effectiveCourtLocation = settings?.courtLocation ?? 'luxembourg';
  const canUseLegacy = effectiveCourtLocation === courtLocation;
  if (canUseLegacy && hasAnyCourtConfigValue(legacyCourt)) {
    return legacyCourt;
  }

  return normalizeLegalRecoveryCourtConfig(null);
}

export function resolveLegalRecoverySettingsForCourt(
  settings: LegalRecoverySettings | null | undefined,
  courtLocation: PaymentOrderCourtLocation
): LegalRecoverySettings {
  const court = resolveLegalRecoveryCourtConfig(settings, courtLocation);

  return {
    ...settings,
    courtLocation,
    courtName: court.courtName ?? null,
    courtAddress: court.courtAddress ?? null,
    courtCity: court.courtCity ?? null,
    creditorProfession: court.creditorProfession ?? null,
    elisantDomicile: court.elisantDomicile ?? null,
    representativeName: court.representativeName ?? null,
    representativeTitle: court.representativeTitle ?? null,
    additionalNotes: court.additionalNotes ?? null,
  };
}

export interface LegalRecoveryEligibilityInput {
  invoiceStatus?: 'unpaid' | 'partial_paid' | 'paid' | 'overdue' | null;
  reminderLevel: number;
  formalNoticeSentAt?: Date | string | null;
  formalNoticeDeadline?: Date | string | null;
  remainingAmountCents: number;
  claimThresholdCents: number;
  now?: Date;
}

export type LegalRecoveryIneligibleReason =
  | 'invoice_paid'
  | 'formal_notice_not_sent'
  | 'formal_notice_deadline_not_reached'
  | 'amount_exceeds_threshold'
  | 'amount_is_zero';

export type LegalRecoveryWarningReason = 'formal_notice_deadline_not_reached';

export interface LegalRecoveryEligibilityResult {
  eligible: boolean;
  reason?: LegalRecoveryIneligibleReason;
  warningReason?: LegalRecoveryWarningReason;
  claimAmountCents: number;
  claimThresholdCents: number;
}

export function resolveClaimThresholdCents(settings: LegalRecoverySettings | null | undefined): number {
  const raw = settings?.claimThresholdCents;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  return DEFAULT_LEGAL_RECOVERY_CLAIM_THRESHOLD_CENTS;
}

export function evaluateLegalRecoveryEligibility(
  input: LegalRecoveryEligibilityInput
): LegalRecoveryEligibilityResult {
  const claimAmountCents = Math.max(0, Math.round(input.remainingAmountCents || 0));
  const threshold = Math.max(0, Math.round(input.claimThresholdCents || 0)) ||
    DEFAULT_LEGAL_RECOVERY_CLAIM_THRESHOLD_CENTS;
  const now = input.now ?? new Date();
  let warningReason: LegalRecoveryWarningReason | undefined;

  if (input.invoiceStatus === 'paid' || claimAmountCents === 0) {
    return {
      eligible: false,
      reason: claimAmountCents === 0 ? 'amount_is_zero' : 'invoice_paid',
      claimAmountCents,
      claimThresholdCents: threshold,
    };
  }

  const reminderLevel = Math.max(0, Math.round(input.reminderLevel || 0));
  if (reminderLevel < 4 || !input.formalNoticeSentAt) {
    return {
      eligible: false,
      reason: 'formal_notice_not_sent',
      claimAmountCents,
      claimThresholdCents: threshold,
    };
  }

  if (input.formalNoticeDeadline) {
    const deadline = new Date(input.formalNoticeDeadline);
    if (Number.isFinite(deadline.getTime()) && now.getTime() < deadline.getTime()) {
      warningReason = 'formal_notice_deadline_not_reached';
    }
  }

  if (claimAmountCents > threshold) {
    return {
      eligible: false,
      reason: 'amount_exceeds_threshold',
      claimAmountCents,
      claimThresholdCents: threshold,
    };
  }

  return {
    eligible: true,
    warningReason,
    claimAmountCents,
    claimThresholdCents: threshold,
  };
}

export interface ReminderLogEntry {
  level: number;
  channel?: 'email' | 'whatsapp' | null;
  status?: 'sent' | 'failed' | 'skipped' | 'paused' | 'resumed' | null;
  sentAt?: Date | string | null;
}

export function mapReminderLogsToEvents(
  logs: ReminderLogEntry[],
  locale: ReminderLocale
): PaymentOrderReminderEvent[] {
  return logs
    .filter((log) => log.status === 'sent' && log.level >= 1 && log.level <= 4)
    .map((log) => {
      const normalizedLevel = Math.max(1, Math.min(4, Math.round(log.level))) as 1 | 2 | 3 | 4;
      return {
        level: normalizedLevel,
        channel: (log.channel === 'whatsapp' ? 'whatsapp' : 'email') as 'email' | 'whatsapp',
        status: 'sent' as const,
        date: formatDateForLocale(log.sentAt ?? null, locale),
      };
    })
    .sort((a, b) => a.level - b.level);
}

export interface BuildPaymentOrderPropsInput {
  invoice: InvoiceForPdf;
  companyProfile: CompanyProfileForReminder | null;
  settings: LegalRecoverySettings | null | undefined;
  locale: ReminderLocale;
  remainingAmountCents: number;
  paidAmountCents: number;
  lateFeeAmountCents: number;
  formalNoticeSentAt?: Date | string | null;
  formalNoticeDeadline?: Date | string | null;
  includeInterestClause: boolean;
  reminderLogs: ReminderLogEntry[];
  requestDate?: Date;
}

export function buildPaymentOrderPdfProps(input: BuildPaymentOrderPropsInput): PaymentOrderPdfProps {
  const { invoice, companyProfile, settings, locale } = input;
  const daysOverdue = getInvoiceDaysOverdue(invoice.dueDate);
  const requestDate = input.requestDate ?? new Date();
  const amountOriginal = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0));
  const remaining = Math.max(0, Math.round(input.remainingAmountCents || 0));
  const paid = Math.max(0, Math.round(input.paidAmountCents || 0));
  const lateFees = Math.max(0, Math.round(input.lateFeeAmountCents || 0));
  const amountDueWithFees = remaining + lateFees;

  const creditorIsLegalEntity = Boolean(
    companyProfile?.companyName && companyProfile.companyName.trim().length > 0
  );
  const debtorIsLegalEntity = Boolean(
    invoice.clientSnapshot.companyName && invoice.clientSnapshot.companyName.trim().length > 0
  );
  const debtorAddress = invoice.clientSnapshot.addressDetails ?? null;

  return {
    locale,
    requestDate: formatDateForLocale(requestDate, locale),
    requestPlace: (companyProfile?.city ?? '').trim() || (locale === 'fr' ? 'Luxembourg' : 'Luxembourg'),
    caseReference: formatInvoiceDisplayNumber(locale, invoice.invoiceNumber),
    court: {
      location: (settings?.courtLocation ?? null) as PaymentOrderCourtLocation,
      name: (settings?.courtName ?? '').trim() || null,
      address: settings?.courtAddress ?? null,
      city: settings?.courtCity ?? null,
    },
    creditor: {
      logo: companyProfile?.logoUrl ?? null,
      name: resolveCompanyDisplayName(companyProfile ?? null),
      ownerName: companyProfile?.ownerName ?? null,
      profession: settings?.creditorProfession ?? null,
      streetNumber: companyProfile?.streetNumber ?? null,
      streetName: companyProfile?.streetName ?? null,
      postalCode: companyProfile?.postalCode ?? null,
      city: companyProfile?.city ?? null,
      country: companyProfile?.country ?? null,
      address: companyProfile?.address ?? null,
      phone: companyProfile?.phone ?? null,
      email: companyProfile?.businessEmail ?? null,
      vatNumber: companyProfile?.vatNumber ?? null,
      rcsNumber: companyProfile?.rcsNumber ?? null,
      legalIdentifier: companyProfile?.legalIdentifier ?? null,
      iban: companyProfile?.iban ?? null,
      bankName: companyProfile?.bankName ?? null,
    },
    creditorIsLegalEntity,
    representativeName: settings?.representativeName ?? null,
    representativeTitle: settings?.representativeTitle ?? null,
    elisantDomicile: settings?.elisantDomicile ?? null,
    debtor: {
      name: invoice.clientSnapshot.fullName || 'Client',
      firstName: null,
      lastName: null,
      profession: null,
      isLegalEntity: debtorIsLegalEntity,
      companyName: invoice.clientSnapshot.companyName ?? null,
      streetNumber: debtorAddress?.streetNumber ?? null,
      streetName: debtorAddress?.streetName ?? null,
      postalCode: debtorAddress?.postalCode ?? null,
      city: debtorAddress?.city ?? null,
      country: debtorAddress?.country ?? null,
      address: resolveClientAddress(invoice.clientSnapshot) || null,
      email: invoice.clientSnapshot.email ?? null,
      phone: invoice.clientSnapshot.phone ?? null,
      vatNumber: null,
      representativeName: debtorIsLegalEntity ? invoice.clientSnapshot.fullName : null,
    },
    invoiceNumber: formatInvoiceDisplayNumber(locale, invoice.invoiceNumber),
    invoiceDate: formatDateForLocale(invoice.date, locale),
    dueDate: formatDateForLocale(invoice.dueDate, locale),
    daysOverdue,
    amountOriginal: formatEurFromCents(amountOriginal, locale),
    amountPaid: formatEurFromCents(paid, locale),
    amountDue: formatEurFromCents(amountDueWithFees, locale),
    amountDueCents: amountDueWithFees,
    amountInWords: amountCentsToWords(amountDueWithFees, locale),
    lateFees: lateFees > 0 ? formatEurFromCents(lateFees, locale) : null,
    formalNoticeDate: input.formalNoticeSentAt ? formatDateForLocale(input.formalNoticeSentAt, locale) : null,
    formalNoticeDeadline: input.formalNoticeDeadline
      ? formatDateForLocale(input.formalNoticeDeadline, locale)
      : null,
    reminderEvents: mapReminderLogsToEvents(input.reminderLogs, locale),
    includeInterestClause: input.includeInterestClause,
    additionalNotes: settings?.additionalNotes ?? null,
  };
}

export async function renderPaymentOrderPdfForRecovery(
  input: BuildPaymentOrderPropsInput
): Promise<{ pdfBuffer: Buffer; props: PaymentOrderPdfProps }> {
  const props = buildPaymentOrderPdfProps(input);
  const pdfBuffer = await renderPaymentOrderPdf(props);
  return { pdfBuffer, props };
}

/**
 * Mark the given invoice as having initiated the legal recovery procedure. The
 * timestamp is only set the first time — subsequent downloads preserve the
 * original initiation date.
 */
export async function markLegalRecoveryInitiatedIfNeeded(params: {
  InvoiceModel: mongoose.Model<unknown> | mongoose.Model<{ _id: mongoose.Types.ObjectId }>;
  invoiceId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  claimAmountCents: number;
  now?: Date;
}): Promise<{ firstTime: boolean; initiatedAt: Date }> {
  const now = params.now ?? new Date();
  const Model = params.InvoiceModel as mongoose.Model<Record<string, unknown>>;

  const updateResult = await Model.updateOne(
    {
      _id: params.invoiceId,
      userId: params.userId,
      $or: [
        { 'reminderState.legalRecoveryInitiatedAt': null },
        { 'reminderState.legalRecoveryInitiatedAt': { $exists: false } },
      ],
    },
    {
      $set: {
        'reminderState.legalRecoveryInitiatedAt': now,
        'reminderState.legalRecoveryClaimAmount': Math.max(0, Math.round(params.claimAmountCents || 0)),
      },
    }
  );

  const firstTime = (updateResult.modifiedCount ?? 0) > 0;
  return { firstTime, initiatedAt: now };
}
