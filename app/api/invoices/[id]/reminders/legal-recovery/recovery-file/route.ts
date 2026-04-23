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
import {
  evaluateLegalRecoveryEligibility,
  markLegalRecoveryInitiatedIfNeeded,
  renderPaymentOrderPdfForRecovery,
  resolveClaimThresholdCents,
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildReminderHistoryHtml({
  locale,
  invoiceNumber,
  logs,
}: {
  locale: 'en' | 'fr';
  invoiceNumber: string;
  logs: ReminderLogDoc[];
}): string {
  const title = locale === 'fr' ? 'Historique des relances' : 'Reminder history';
  const reference = locale === 'fr' ? 'Facture' : 'Invoice';
  const levelLabels: Record<string, string> = locale === 'fr'
    ? { 1: 'Rappel amical', 2: 'Rappel ferme', 3: 'Dernier rappel', 4: 'Mise en demeure' }
    : { 1: 'Soft reminder', 2: 'Medium reminder', 3: 'Firm reminder', 4: 'Formal notice' };
  const statusLabels: Record<string, string> = locale === 'fr'
    ? { sent: 'Envoyé', failed: 'Échec', skipped: 'Ignoré', paused: 'En pause', resumed: 'Repris' }
    : { sent: 'Sent', failed: 'Failed', skipped: 'Skipped', paused: 'Paused', resumed: 'Resumed' };
  const emptyLabel = locale === 'fr' ? 'Aucune relance enregistrée.' : 'No reminders recorded.';
  const thDate = locale === 'fr' ? 'Date' : 'Date';
  const thLevel = locale === 'fr' ? 'Niveau' : 'Level';
  const thChannel = locale === 'fr' ? 'Canal' : 'Channel';
  const thStatus = locale === 'fr' ? 'Statut' : 'Status';
  const thSubject = locale === 'fr' ? 'Sujet' : 'Subject';

  const rows = logs.length === 0
    ? `<tr><td colspan="5" style="padding:12px;text-align:center;color:#64748b;">${escapeHtml(emptyLabel)}</td></tr>`
    : logs
        .map((log) => {
          const date = log.sentAt ? new Date(log.sentAt).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB') : '-';
          const levelLabel = levelLabels[String(log.level)] ?? String(log.level);
          const channelLabel = log.channel === 'whatsapp' ? 'WhatsApp' : 'Email';
          const statusLabel = statusLabels[String(log.status)] ?? String(log.status ?? '-');
          return `<tr>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(date)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(levelLabel)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(channelLabel)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(statusLabel)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(log.subject ?? '')}</td>
          </tr>`;
        })
        .join('\n');

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)} — ${escapeHtml(invoiceNumber)}</title>
</head>
<body style="font-family:Helvetica,Arial,sans-serif;color:#0f172a;padding:24px;">
  <h1 style="font-size:18px;margin:0 0 8px;">${escapeHtml(title)}</h1>
  <p style="font-size:13px;color:#475569;margin:0 0 16px;">${escapeHtml(reference)}: <strong>${escapeHtml(invoiceNumber)}</strong></p>
  <table style="border-collapse:collapse;width:100%;font-size:12px;">
    <thead>
      <tr style="background:#f1f5f9;text-align:left;">
        <th style="padding:6px 8px;border-bottom:1px solid #cbd5e1;">${escapeHtml(thDate)}</th>
        <th style="padding:6px 8px;border-bottom:1px solid #cbd5e1;">${escapeHtml(thLevel)}</th>
        <th style="padding:6px 8px;border-bottom:1px solid #cbd5e1;">${escapeHtml(thChannel)}</th>
        <th style="padding:6px 8px;border-bottom:1px solid #cbd5e1;">${escapeHtml(thStatus)}</th>
        <th style="padding:6px 8px;border-bottom:1px solid #cbd5e1;">${escapeHtml(thSubject)}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function buildReadmeText(locale: 'en' | 'fr', invoiceNumber: string): string {
  if (locale === 'fr') {
    return [
      'Dossier de recouvrement — procédure de paiement (Justice de Paix)',
      `Facture concernée : ${invoiceNumber}`,
      `Date de génération : ${new Date().toLocaleString('fr-FR')}`,
      '',
      'Contenu :',
      '  1. facture.pdf            — copie de la facture impayée',
      '  2. mise-en-demeure.pdf    — copie de la mise en demeure',
      '  3. requete-en-paiement.pdf — requête à déposer auprès de la Justice de Paix',
      '  4. historique-relances.html — historique des relances envoyées',
      '',
      'Champ d\'application : créances inférieures à 15 000 €, Justice de Paix uniquement.',
      'Les procédures de district (ordonnance de provision, référé) ne sont pas couvertes dans cette version.',
    ].join('\n');
  }
  return [
    'Recovery file — payment-order procedure (Justice of the Peace)',
    `Invoice: ${invoiceNumber}`,
    `Generated on: ${new Date().toLocaleString('en-GB')}`,
    '',
    'Contents:',
    '  1. invoice.pdf                — copy of the unpaid invoice',
    '  2. formal-notice.pdf          — copy of the formal notice',
    '  3. payment-order-request.pdf  — request to file with the Justice of the Peace',
    '  4. reminder-history.html      — history of reminders sent',
    '',
    'Scope: claims below €15,000, Justice of the Peace only.',
    'District-court procedures (ordonnance de provision, référé) are not covered in this version.',
  ].join('\n');
}

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
      .select('_id userId invoiceNumber quoteNumber date dueDate status lineItems totalExcludingTax totalVat totalIncludingTax depositPercentage notes clientSnapshot reminderState paymentToken')
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

    const [invoicePdfBuffer, legalNoticeResult, paymentOrderResult] = await Promise.all([
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
        settings: settingsDoc?.legalRecovery ?? null,
        locale,
        remainingAmountCents: remainingAmount,
        paidAmountCents: totalPaid,
        lateFeeAmountCents: lateFeeAmount,
        formalNoticeSentAt: invoice.reminderState?.formalNoticeSentAt ?? null,
        formalNoticeDeadline: invoice.reminderState?.formalNoticeDeadline ?? null,
        includeInterestClause,
        reminderLogs: logs ?? [],
      }),
    ]);

    const displayInvoiceNumber = formatInvoiceDisplayNumber(locale, invoice.invoiceNumber);

    const fileNames = locale === 'fr'
      ? {
          invoice: `facture-${displayInvoiceNumber}.pdf`,
          formalNotice: `mise-en-demeure-${displayInvoiceNumber}.pdf`,
          paymentOrder: `requete-en-paiement-${displayInvoiceNumber}.pdf`,
          history: 'historique-relances.html',
          readme: 'LISEZMOI.txt',
          bundle: `dossier-recouvrement-${displayInvoiceNumber}.zip`,
        }
      : {
          invoice: `invoice-${displayInvoiceNumber}.pdf`,
          formalNotice: `formal-notice-${displayInvoiceNumber}.pdf`,
          paymentOrder: `payment-order-request-${displayInvoiceNumber}.pdf`,
          history: 'reminder-history.html',
          readme: 'README.txt',
          bundle: `recovery-file-${displayInvoiceNumber}.zip`,
        };

    const zip = new JSZip();
    zip.file(fileNames.readme, buildReadmeText(locale, displayInvoiceNumber));
    zip.file(fileNames.invoice, invoicePdfBuffer);
    zip.file(fileNames.formalNotice, legalNoticeResult.pdfBuffer);
    zip.file(fileNames.paymentOrder, paymentOrderResult.pdfBuffer);
    zip.file(
      fileNames.history,
      buildReminderHistoryHtml({ locale, invoiceNumber: displayInvoiceNumber, logs: logs ?? [] })
    );

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
