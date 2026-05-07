import JSZip from 'jszip';
import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import CompanyProfile from '@/db/models/CompanyProfile';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import ReminderLog from '@/db/models/ReminderLog';
import ReminderSettings from '@/db/models/ReminderSettings';
import { createActivityLog } from '@/db/repository/activity';
import { formatInvoiceDisplayNumber } from '@/lib/i18n/messages';
import { renderReminderHistoryPdf } from '@/lib/pdf/ReminderHistoryPdfTemplate';
import {
  appendLegalRecoveryTrackingEntries,
  evaluateLegalRecoveryEligibility,
  isLegalRecoveryCourtConfigured,
  markLegalRecoveryInitiatedIfNeeded,
  renderPaymentOrderPdfForRecovery,
  resolveClaimThresholdCents,
  resolveLegalRecoveryCourtConfig,
  resolveLegalRecoverySettingsForCourt,
  type LegalRecoveryCourtLocation,
  type LegalRecoverySettings,
  type ReminderLogEntry,
} from '@/lib/reminders/legal-recovery';
import {
  renderInvoicePdfForReminder,
  renderLegalNoticePdfForReminder,
  resolveReminderLocalePreference,
  type CompanyProfileForReminder,
  type InvoiceForPdf,
  type PaymentHistoryItem,
} from '@/lib/reminders/formal-notice';
import getMe from '@/utils/middlewares/useMe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type InvoiceForLegalRecovery = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  legalRecoveryCourtLocation?: LegalRecoveryCourtLocation | null;
  invoiceNumber: string;
  quoteNumber?: string | null;
  date?: Date | null;
  dueDate?: Date | null;
  status?: 'unpaid' | 'partial_paid' | 'paid' | 'overdue';
  lineItems?: Array<{
    name: string;
    quantity: number;
    baseUnitPriceExcludingTax: number;
    discountPercentage: number;
    discountAmountExcludingTax: number;
    vatRate: number;
    totalExcludingTax: number;
  }>;
  totalExcludingTax?: number | null;
  totalVat?: number | null;
  totalIncludingTax?: number | null;
  depositPercentage?: number | null;
  notes?: string | null;
  paymentToken?: string | null;
  clientSnapshot?: {
    fullName?: string | null;
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
  } | null;
  reminderState?: {
    level?: number | null;
    lateFeeAmount?: number | null;
    formalNoticeSentAt?: Date | null;
    formalNoticeDeadline?: Date | null;
    legalRecoveryInitiatedAt?: Date | null;
    legalRecoverySentToCourtAt?: Date | null;
  } | null;
};

type ReminderSettingsDoc = {
  legalNotice?: {
    delayDays?: 8 | 15;
    includeInterestClause?: boolean;
    customFooter?: string | null;
  } | null;
  legalRecovery?: LegalRecoverySettings | null;
} | null;

type ReminderLogDoc = ReminderLogEntry & {
  _id: mongoose.Types.ObjectId;
  subject?: string;
  recipientEmail?: string;
  lateFeeAmount?: number;
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

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const allowBeforeDeadline = request.nextUrl.searchParams.get('allowBeforeDeadline') === '1';
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    await ConnectDb();

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id })
      .select('_id userId legalRecoveryCourtLocation invoiceNumber quoteNumber date dueDate status lineItems totalExcludingTax totalVat totalIncludingTax depositPercentage notes clientSnapshot reminderState paymentToken')
      .lean<InvoiceForLegalRecovery | null>();

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const [settingsDoc, companyProfile, totals, logs, paymentHistory] = await Promise.all([
      ReminderSettings.findOne({ userId: me.user.id }).lean<ReminderSettingsDoc>(),
      CompanyProfile.findOne({ user: me.user.id })
        .select('companyName ownerName locale address streetNumber streetName postalCode city country phone businessEmail vatNumber rcsNumber businessAuthorizationNumber matriculeNumber iban bankName legalIdentifier logoUrl')
        .lean<CompanyProfileForReminder | null>(),
      Payment.aggregate<{ _id: null; totalPaid: number }>([
        { $match: { invoiceId: invoice._id, userId: new mongoose.Types.ObjectId(me.user.id), status: 'succeeded' } },
        { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
      ]),
      ReminderLog.find({ invoiceId: invoice._id, userId: me.user.id })
        .sort({ sentAt: 1, createdAt: 1 })
        .select('level channel status sentAt subject recipientEmail lateFeeAmount')
        .lean<ReminderLogDoc[]>(),
      loadPaymentHistory(invoice._id, me.user.id),
    ]);

    const totalPaid = Math.max(0, Math.round(totals[0]?.totalPaid ?? 0));
    const totalIncludingTax = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0));
    const remainingAmount = Math.max(0, totalIncludingTax - totalPaid);
    const lateFeeAmount = Math.max(0, Math.round(invoice.reminderState?.lateFeeAmount ?? 0));
    const claimThresholdCents = resolveClaimThresholdCents(settingsDoc?.legalRecovery);

    const eligibility = evaluateLegalRecoveryEligibility({
      invoiceStatus: invoice.status ?? null,
      reminderLevel: invoice.reminderState?.level ?? 0,
      formalNoticeSentAt: invoice.reminderState?.formalNoticeSentAt ?? null,
      formalNoticeDeadline: invoice.reminderState?.formalNoticeDeadline ?? null,
      remainingAmountCents: remainingAmount + lateFeeAmount,
      claimThresholdCents,
    });

    if (!eligibility.eligible) {
      return NextResponse.json(
        {
          success: false,
          message: 'Legal recovery is not available for this invoice',
          reason: eligibility.reason,
          claimAmountCents: eligibility.claimAmountCents,
          claimThresholdCents: eligibility.claimThresholdCents,
        },
        { status: 403 }
      );
    }

    if (eligibility.warningReason === 'formal_notice_deadline_not_reached' && !allowBeforeDeadline) {
      return NextResponse.json(
        {
          success: false,
          message: 'Formal notice deadline confirmation required before generating legal recovery documents',
          reason: eligibility.warningReason,
          claimAmountCents: eligibility.claimAmountCents,
          claimThresholdCents: eligibility.claimThresholdCents,
        },
        { status: 409 }
      );
    }

    const selectedCourtLocation = invoice.legalRecoveryCourtLocation ?? null;
    if (!selectedCourtLocation) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please select a competent court on the invoice before generating legal recovery documents.',
          reason: 'court_not_selected',
        },
        { status: 400 }
      );
    }

    const selectedCourt = resolveLegalRecoveryCourtConfig(settingsDoc?.legalRecovery, selectedCourtLocation);
    if (!isLegalRecoveryCourtConfigured(selectedCourt)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Court details are not configured for the selected court. Update Settings → Reminders → Legal Recovery.',
          reason: 'court_not_configured',
          courtLocation: selectedCourtLocation,
        },
        { status: 400 }
      );
    }

    const legalRecoverySettings = resolveLegalRecoverySettingsForCourt(
      settingsDoc?.legalRecovery,
      selectedCourtLocation
    );

    const rawLocale = request.nextUrl.searchParams.get('locale');
    const locale = resolveReminderLocalePreference(rawLocale, me.user.locale, companyProfile?.locale);

    const legalNoticeSettings = settingsDoc?.legalNotice;
    const delayDays = legalNoticeSettings?.delayDays === 15 ? 15 : 8;
    const includeInterestClause = legalNoticeSettings?.includeInterestClause !== false;
    const customFooter = legalNoticeSettings?.customFooter ?? null;

    const invoicePdfInput: InvoiceForPdf = {
      _id: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      quoteNumber: invoice.quoteNumber ?? null,
      date: invoice.date ?? null,
      dueDate: invoice.dueDate ?? null,
      status: invoice.status,
      lineItems: invoice.lineItems ?? [],
      totalExcludingTax: Math.max(0, Math.round(invoice.totalExcludingTax ?? 0)),
      totalVat: Math.max(0, Math.round(invoice.totalVat ?? 0)),
      totalIncludingTax,
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

    const displayInvoiceNumber = formatInvoiceDisplayNumber(locale, invoice.invoiceNumber);
    const historyEntries = appendLegalRecoveryTrackingEntries(logs ?? [], invoice.reminderState);

    const [invoicePdfBuffer, legalNoticeResult, paymentOrderResult, historyPdfBuffer] = await Promise.all([
      renderInvoicePdfForReminder({
        invoice: invoicePdfInput,
        companyProfile,
        locale,
        paymentUrl: null,
        lateFeeAmountCents: lateFeeAmount,
        payments: paymentHistory,
      }),
      renderLegalNoticePdfForReminder({
        invoice: invoicePdfInput,
        companyProfile,
        locale,
        remainingAmountCents: remainingAmount,
        lateFeeAmountCents: lateFeeAmount,
        legalNoticeDate: invoice.reminderState?.formalNoticeSentAt ?? new Date(),
        delayDays,
        includeInterestClause,
        customFooter,
      }),
      renderPaymentOrderPdfForRecovery({
        invoice: invoicePdfInput,
        companyProfile,
        settings: legalRecoverySettings,
        locale,
        remainingAmountCents: remainingAmount,
        paidAmountCents: totalPaid,
        lateFeeAmountCents: lateFeeAmount,
        formalNoticeSentAt: invoice.reminderState?.formalNoticeSentAt ?? null,
        formalNoticeDeadline: invoice.reminderState?.formalNoticeDeadline ?? null,
        includeInterestClause,
        reminderLogs: historyEntries,
      }),
      renderReminderHistoryPdf({
        invoiceNumber: displayInvoiceNumber,
        locale,
        entries: historyEntries,
      }),
    ]);

    const fileNames = locale === 'fr'
      ? {
          invoice: `01-facture-${displayInvoiceNumber}.pdf`,
          formalNotice: `02-mise-en-demeure-${displayInvoiceNumber}.pdf`,
          paymentOrder: `03-requete-en-paiement-${displayInvoiceNumber}.pdf`,
          history: `04-historique-relances-${displayInvoiceNumber}.pdf`,
          bundle: `dossier-recouvrement-${displayInvoiceNumber}.zip`,
        }
      : {
          invoice: `01-invoice-${displayInvoiceNumber}.pdf`,
          formalNotice: `02-formal-notice-${displayInvoiceNumber}.pdf`,
          paymentOrder: `03-payment-order-request-${displayInvoiceNumber}.pdf`,
          history: `04-reminder-history-${displayInvoiceNumber}.pdf`,
          bundle: `recovery-file-${displayInvoiceNumber}.zip`,
        };

    const zip = new JSZip();
    zip.file(fileNames.invoice, invoicePdfBuffer);
    zip.file(fileNames.formalNotice, legalNoticeResult.pdfBuffer);
    zip.file(fileNames.paymentOrder, paymentOrderResult.pdfBuffer);
    zip.file(fileNames.history, historyPdfBuffer);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    const wasAlreadyInitiated = Boolean(invoice.reminderState?.legalRecoveryInitiatedAt);
    const { firstTime } = await markLegalRecoveryInitiatedIfNeeded({
      InvoiceModel: Invoice as unknown as mongoose.Model<unknown>,
      invoiceId: invoice._id,
      userId: me.user.id,
      claimAmountCents: eligibility.claimAmountCents,
    });

    if (firstTime && !wasAlreadyInitiated) {
      await createActivityLog(me.user.id, {
        action: 'invoice_legal_recovery_initiated',
        entityType: 'invoice',
        entityName: invoice.invoiceNumber,
        entityId: String(invoice._id),
        metadata: {
          claimAmountCents: eligibility.claimAmountCents,
          jurisdiction: settingsDoc?.legalRecovery?.jurisdiction ?? 'justice_of_peace',
          courtLocation: selectedCourtLocation,
          bundle: true,
        },
      });
    }

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileNames.bundle}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error generating recovery file: ${String(error)}` },
      { status: 500 }
    );
  }
}
