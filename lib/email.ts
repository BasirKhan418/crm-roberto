import ConnectEmailClient from "@/emails/connectEmailClient";
import { getQuoteEmailTemplate } from "@/emails/quoteEmailTemplate";
import { formatInvoiceDisplayNumber, getDocumentEmailLanguage, translate, type TranslationLocale } from '@/lib/i18n/messages';
import { getPaymentMethodLabel } from '@/lib/payments';

interface BaseSendParams {
  to: string;
  clientName: string;
  companyName: string;
  pdfBuffer?: Buffer;
}

interface SendSignLinkParams extends BaseSendParams {
  quoteNumber: string;
  signUrl: string;
  quoteDate: Date | string;
  totalIncludingTax: number;
  validityDays: number;
  locale?: "en" | "fr";
  company?: {
    companyName?: string;
    ownerName?: string;
    address?: string;
    phone?: string;
    email?: string;
    vatNumber?: string;
    logoUrl?: string | null;
  } | null;
  clientCompanyName?: string | null;
}

interface SendInvoiceParams extends BaseSendParams {
  invoiceNumber: string;
  paymentUrl?: string | null;
  amount: string;
  includeOnlinePayment?: boolean;
  locale?: TranslationLocale;
  subject?: string;
  messageBody?: string;
}

interface SendQuoteEmailParams extends BaseSendParams {
  quoteNumber: string;
  quoteDate: Date | string;
  totalIncludingTax: number;
  validityDays: number;
  signUrl?: string | null;
  subject?: string;
  messageBody?: string;
  locale?: "en" | "fr";
  company?: {
    companyName?: string;
    ownerName?: string;
    address?: string;
    phone?: string;
    email?: string;
    vatNumber?: string;
    logoUrl?: string | null;
  } | null;
  clientCompanyName?: string | null;
}

interface SendPaymentReceiptParams extends BaseSendParams {
  invoiceNumber: string;
  amount: string;
  paymentMethod: string;
  paidAt: Date | string;
  locale?: TranslationLocale;
}

export interface SendReminderParams extends BaseSendParams {
  invoiceNumber: string;
  subject: string;
  htmlBody: string;
  locale?: TranslationLocale;
}

export interface SendFormalNoticeParams extends Omit<SendReminderParams, 'pdfBuffer'> {
  pdfBuffer: Buffer;
  legalNoticePdfBuffer: Buffer;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildDocumentEmailTemplate({
  subject,
  companyName,
  clientName,
  documentLabel,
  documentNumber,
  details,
  messageBody,
  locale,
  ctaLabel,
  ctaUrl,
  ctaNote,
  showPdfAttached = true,
  includeGreeting = true,
}: {
  subject: string;
  companyName: string;
  clientName: string;
  documentLabel: string;
  documentNumber: string;
  details: Array<{ label: string; value: string }>;
  messageBody: string;
  locale: TranslationLocale;
  ctaLabel?: string;
  ctaUrl?: string;
  ctaNote?: string;
  showPdfAttached?: boolean;
  includeGreeting?: boolean;
}): string {
  const safeSubject = escapeHtml(subject);
  const safeCompanyName = escapeHtml(companyName || "CRM");
  const safeGreeting = escapeHtml(translate(locale, 'email.greeting', { name: clientName || 'Client' }));
  const safeDocumentLabel = escapeHtml(documentLabel);
  const safeDocumentNumber = escapeHtml(documentNumber);
  const safeMessageBody = escapeHtml(messageBody).replace(/\n/g, "<br>");
  const safePdfAttachedLabel = showPdfAttached ? escapeHtml(translate(locale, 'email.pdfAttached')) : '';

  const rows = details
    .map(
      (item) =>
        `<tr><td style="padding:2px 0;color:#6b7280;font-size:12px;">${escapeHtml(item.label)}:</td><td style="padding:2px 0;color:#1a2e44;font-size:12px;font-weight:600;text-align:right;">${escapeHtml(item.value)}</td></tr>`
    )
    .join("\n");

  const ctaBlock =
    ctaLabel && ctaUrl
      ? `<p style="margin:24px 0 12px;">
           <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#000;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
             ${escapeHtml(ctaLabel)}
           </a>
         </p>
         ${ctaNote ? `<p style="margin:0;font-size:12px;color:#6b7280;">${escapeHtml(ctaNote)}</p>` : ""}`
      : "";

  return `<!DOCTYPE html>
<html lang="${escapeHtml(getDocumentEmailLanguage(locale))}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${safeSubject}</title>
  <style>
    body { margin:0; padding:0; background:#ebedf0; font-family:Segoe UI, Roboto, Arial, sans-serif; }
    table { border-spacing:0; border-collapse:collapse; }
    img { border:0; }
    @media screen and (max-width: 600px) {
      .main { width:100% !important; }
      .cell { padding:20px 16px !important; }
    }
  </style>
</head>
<body>
  <center style="width:100%;table-layout:fixed;background:#ebedf0;padding:24px 0;">
    <table class="main" width="600" style="max-width:600px;background:#fff;border:1px solid #d0d4d9;">
      <tr>
        <td style="height:4px;background:#1a2e44;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
      <tr>
        <td class="cell" style="padding:24px 28px;border-bottom:1px solid #e2e5e9;">
          <div style="font-size:20px;font-weight:700;color:#1a2e44;">${safeCompanyName}</div>
        </td>
      </tr>
      <tr>
        <td class="cell" style="padding:20px 28px;background:#f6f7f9;border-bottom:1px solid #e2e5e9;">
          <div style="font-size:17px;font-weight:700;color:#1a2e44;">${safeDocumentLabel} ${safeDocumentNumber}</div>
          <table width="100%" style="margin-top:10px;">
            ${rows}
          </table>
        </td>
      </tr>
      <tr>
        <td class="cell" style="padding:28px;">
          ${includeGreeting ? `<p style="margin:0 0 18px;font-size:15px;font-weight:600;color:#1a2e44;">${safeGreeting}</p>` : ''}
          <div style="font-size:14px;line-height:1.75;color:#374151;">${safeMessageBody}</div>
          ${ctaBlock}
        </td>
      </tr>
      ${showPdfAttached ? `<tr>
        <td style="padding:0 28px 24px;">
          <table width="100%" style="background:#f6f7f9;border:1px solid #e2e5e9;">
            <tr>
              <td style="padding:12px 14px;font-size:13px;color:#374151;">${safePdfAttachedLabel}</td>
            </tr>
          </table>
        </td>
      </tr>` : ''}
      <tr>
        <td style="background:#1a2e44;padding:16px 28px;color:#94a3b8;font-size:12px;">
          &copy; ${new Date().getFullYear()} ${safeCompanyName}
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function sendDocumentEmail({
  to,
  subject,
  html,
  text,
  companyName,
  attachmentFilename,
  pdfBuffer,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  companyName: string;
  attachmentFilename: string;
  pdfBuffer?: Buffer;
}) {
  const emailTransporter = await ConnectEmailClient();
  if (!emailTransporter) {
    throw new Error("Failed to connect to email service");
  }

  await emailTransporter.sendMail({
    from: `"${companyName || "CRM"}" <${process.env.EMAIL_USER_V2 || process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    text,
    attachments: pdfBuffer
      ? [
          {
            filename: attachmentFilename,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ]
      : [],
  });
}

function plainTextFromHtmlBody(htmlBody: string): string {
  return htmlBody
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim();
}

function buildReminderEmailHtml({
  params,
  locale,
  showPdfAttached,
}: {
  params: SendReminderParams;
  locale: TranslationLocale;
  showPdfAttached?: boolean;
}): string {
  return buildDocumentEmailTemplate({
    subject: params.subject,
    companyName: params.companyName,
    clientName: params.clientName,
    documentLabel: translate(locale, 'email.sendInvoice.documentLabel'),
    documentNumber: formatInvoiceDisplayNumber(locale, params.invoiceNumber),
    details: [],
    messageBody: params.htmlBody,
    locale,
    showPdfAttached,
    includeGreeting: false,
  });
}

export async function sendSignLink({
  to,
  clientName,
  quoteNumber,
  signUrl,
  companyName,
  quoteDate,
  totalIncludingTax,
  validityDays,
  locale = "en",
  company = null,
  pdfBuffer,
}: SendSignLinkParams) {
  const subject =
    translate(locale, 'email.sendSignLink.subject', { quoteNumber });

  const formattedDate = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(quoteDate));

  const formattedTotal = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
  }).format(totalIncludingTax / 100);

  const messageBody = translate(locale, 'email.sendSignLink.messageBody', { signUrl });

  const html = buildDocumentEmailTemplate({
    subject,
    companyName: company?.companyName || companyName || "CRM",
    clientName,
    documentLabel: translate(locale, 'email.sendSignLink.documentLabel'),
    documentNumber: quoteNumber,
    details: [
      { label: 'Date', value: formattedDate },
      { label: translate(locale, 'email.sendSignLink.amountLabel'), value: formattedTotal },
      {
        label: translate(locale, 'email.sendSignLink.validityLabel'),
        value: translate(locale, 'email.sendSignLink.validityValue', { count: validityDays }),
      },
    ],
    messageBody,
    locale,
    ctaLabel: translate(locale, 'email.sendSignLink.ctaLabel'),
    ctaUrl: signUrl,
    ctaNote: translate(locale, 'email.sendSignLink.ctaNote'),
  });

  const text = messageBody;

  return sendDocumentEmail({
    to,
    subject,
    html,
    text,
    companyName,
    attachmentFilename: `${quoteNumber}.pdf`,
    pdfBuffer,
  });
}

export async function sendQuoteEmail({
  to,
  clientName,
  quoteNumber,
  quoteDate,
  totalIncludingTax,
  validityDays,
  signUrl = null,
  subject,
  messageBody,
  locale = "en",
  companyName,
  company = null,
  clientCompanyName = null,
  pdfBuffer,
}: SendQuoteEmailParams) {
  const resolvedSubject = subject?.trim()
    ? subject.trim()
    : translate(locale, 'email.sendQuote.subject', { quoteNumber });

  const resolvedMessageBody = messageBody?.trim()
    ? messageBody.trim()
    : translate(locale, 'email.sendQuote.defaultBody', { quoteNumber });

  const formattedDate = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(quoteDate));

  const formattedTotal = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
  }).format(totalIncludingTax / 100);

  const html = getQuoteEmailTemplate({
    messageBody: resolvedMessageBody,
    subject: resolvedSubject,
    company: {
      companyName: company?.companyName || companyName || "CRM",
      ownerName: company?.ownerName || "",
      address: company?.address || "",
      phone: company?.phone || "",
      email: company?.email || "",
      vatNumber: company?.vatNumber || "",
      logoUrl: company?.logoUrl ?? null,
    },
    client: {
      fullName: clientName,
      companyName: clientCompanyName,
      email: to,
    },
    quote: {
      quoteNumber,
      date: formattedDate,
      totalIncludingTax: formattedTotal,
      validityDays,
    },
    locale,
    signLinkUrl: signUrl,
  });

  const text = [
    resolvedMessageBody,
    '',
    translate(locale, 'email.sendQuote.reference', { quoteNumber }),
    `Date: ${formattedDate}`,
    translate(locale, 'email.sendQuote.totalInclTax', { amount: formattedTotal }),
    translate(locale, 'email.sendQuote.validity', { count: validityDays }),
    signUrl ? '' : '',
    signUrl ? translate(locale, 'email.sendQuote.signingLink', { signUrl }) : '',
    signUrl ? translate(locale, 'email.sendQuote.signingExpiry') : '',
  ].filter(Boolean).join('\n');

  return sendDocumentEmail({
    to,
    subject: resolvedSubject,
    html,
    text,
    companyName,
    attachmentFilename: `${quoteNumber}.pdf`,
    pdfBuffer,
  });
}

export async function sendInvoice({
  to,
  clientName,
  invoiceNumber,
  paymentUrl,
  amount,
  companyName,
  pdfBuffer,
  includeOnlinePayment = false,
  locale = 'en',
  subject,
  messageBody,
}: SendInvoiceParams) {
  const displayInvoiceNumber = formatInvoiceDisplayNumber(locale, invoiceNumber);
  const resolvedSubject = subject?.trim()
    ? subject.trim()
    : translate(locale, 'email.sendInvoice.subject', { invoiceNumber: displayInvoiceNumber, amount });
  const resolvedMessageBody = messageBody?.trim()
    ? messageBody.trim()
    : translate(
        locale,
        includeOnlinePayment ? 'email.sendInvoice.messageBody' : 'email.sendInvoice.messageBodyNoPayment'
      );

  const invoiceDetails = [
    { label: translate(locale, 'email.sendInvoice.amountDue'), value: amount },
    ...(includeOnlinePayment
      ? [{ label: translate(locale, 'email.sendInvoice.payment'), value: translate(locale, 'email.sendInvoice.onlineCheckout') }]
      : []),
  ];

  const textLines = [
    resolvedMessageBody,
    '',
    translate(locale, 'email.sendInvoice.documentLabel') + ` ${displayInvoiceNumber}`,
    `${translate(locale, 'email.sendInvoice.amountDue')}: ${amount}`,
  ];

  if (includeOnlinePayment && paymentUrl) {
    textLines.push(`${translate(locale, 'email.sendInvoice.ctaLabel')}: ${paymentUrl}`);
  }

  const html = buildDocumentEmailTemplate({
    subject: resolvedSubject,
    companyName,
    clientName,
    documentLabel: translate(locale, 'email.sendInvoice.documentLabel'),
    documentNumber: displayInvoiceNumber,
    details: invoiceDetails,
    messageBody: resolvedMessageBody,
    locale,
    ctaLabel: includeOnlinePayment && paymentUrl ? translate(locale, 'email.sendInvoice.ctaLabel') : undefined,
    ctaUrl: includeOnlinePayment ? paymentUrl ?? undefined : undefined,
  });

  const text = textLines.join('\n');

  return sendDocumentEmail({
    to,
    subject: resolvedSubject,
    html,
    text,
    companyName,
    attachmentFilename: `${displayInvoiceNumber}.pdf`,
    pdfBuffer,
  });
}

export async function sendInvoiceReminder(params: SendReminderParams): Promise<void> {
  const locale = params.locale ?? 'en';
  const html = buildReminderEmailHtml({ params, locale, showPdfAttached: Boolean(params.pdfBuffer) });
  const text = plainTextFromHtmlBody(params.htmlBody);

  const emailTransporter = await ConnectEmailClient();
  if (!emailTransporter) {
    throw new Error('Failed to connect to email service');
  }

  await emailTransporter.sendMail({
    from: `"${params.companyName || 'CRM'}" <${process.env.EMAIL_USER_V2 || process.env.EMAIL_USER}>`,
    to: params.to,
    subject: params.subject,
    html,
    text,
    attachments: params.pdfBuffer
      ? [
          {
            filename: `${formatInvoiceDisplayNumber(locale, params.invoiceNumber)}.pdf`,
            content: params.pdfBuffer,
            contentType: 'application/pdf',
          },
        ]
      : [],
  });
}

export async function sendFormalNotice(params: SendFormalNoticeParams): Promise<void> {
  const locale = params.locale ?? 'en';
  const html = buildReminderEmailHtml({ params, locale, showPdfAttached: true });
  const text = plainTextFromHtmlBody(params.htmlBody);

  const emailTransporter = await ConnectEmailClient();
  if (!emailTransporter) {
    throw new Error('Failed to connect to email service');
  }

  await emailTransporter.sendMail({
    from: `"${params.companyName || 'CRM'}" <${process.env.EMAIL_USER_V2 || process.env.EMAIL_USER}>`,
    to: params.to,
    subject: params.subject,
    html,
    text,
    attachments: [
      {
        filename: `${formatInvoiceDisplayNumber(locale, params.invoiceNumber)}.pdf`,
        content: params.pdfBuffer,
        contentType: 'application/pdf',
      },
      {
        filename: `mise-en-demeure-${formatInvoiceDisplayNumber(locale, params.invoiceNumber)}.pdf`,
        content: params.legalNoticePdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

export async function sendQuoteRejectionNotification({
  to,
  adminName,
  companyName,
  quoteNumber,
  clientName,
  rejectionComment,
  quoteDetailUrl,
  locale = 'en',
}: {
  to: string;
  adminName: string;
  companyName: string;
  quoteNumber: string;
  clientName: string;
  rejectionComment: string | null;
  quoteDetailUrl: string;
  locale?: TranslationLocale;
}) {
  const subject = translate(locale, 'email.rejection.subject', { quoteNumber, clientName });

  const commentLine = rejectionComment
    ? translate(locale, 'email.rejection.commentLine', { comment: rejectionComment })
    : translate(locale, 'email.rejection.noComment');

  const messageBody = translate(locale, 'email.rejection.messageBody', {
    clientName,
    quoteNumber,
    commentLine,
  });

  const html = buildDocumentEmailTemplate({
    subject,
    companyName,
    clientName: adminName,
    documentLabel: translate(locale, 'email.rejection.documentLabel'),
    documentNumber: quoteNumber,
    details: [
      { label: translate(locale, 'email.rejection.clientLabel'), value: clientName },
      { label: translate(locale, 'email.rejection.actionLabel'), value: translate(locale, 'email.rejection.actionRejected') },
      ...(rejectionComment ? [{ label: translate(locale, 'email.rejection.commentLabel'), value: rejectionComment }] : []),
    ],
    messageBody,
    locale,
    ctaLabel: translate(locale, 'email.rejection.ctaLabel'),
    ctaUrl: quoteDetailUrl,
  });

  const text = messageBody;

  return sendDocumentEmail({
    to,
    subject,
    html,
    text,
    companyName,
    attachmentFilename: `${quoteNumber}.pdf`,
  });
}

export async function sendRejectionReplyToClient({
  to,
  clientName,
  companyName,
  quoteNumber,
  messageBody,
  quoteAdminUrl,
  locale = 'en',
}: {
  to: string;
  clientName: string;
  companyName: string;
  quoteNumber: string;
  messageBody: string;
  quoteAdminUrl?: string;
  locale?: TranslationLocale;
}) {
  const subject = translate(locale, 'email.rejectionReply.subject', { quoteNumber });

  const html = buildDocumentEmailTemplate({
    subject,
    companyName,
    clientName,
    documentLabel: translate(locale, 'email.rejectionReply.documentLabel'),
    documentNumber: quoteNumber,
    details: [],
    messageBody,
    ...(quoteAdminUrl ? {
      ctaLabel: translate(locale, 'email.rejectionReply.ctaLabel'),
      ctaUrl: quoteAdminUrl,
      ctaNote: translate(locale, 'email.rejectionReply.ctaNote'),
    } : {}),
    locale,
  });

  const text = messageBody;

  return sendDocumentEmail({
    to,
    subject,
    html,
    text,
    companyName,
    attachmentFilename: `${quoteNumber}.pdf`,
  });
}

export async function sendClientReplyNotificationToAdmin({
  to,
  adminName,
  companyName,
  clientName,
  quoteNumber,
  messageBody,
  quoteDetailUrl,
  locale = 'en',
}: {
  to: string;
  adminName: string;
  companyName: string;
  clientName: string;
  quoteNumber: string;
  messageBody: string;
  quoteDetailUrl?: string;
  locale?: TranslationLocale;
}) {
  const subject = translate(locale, 'email.clientReply.subject', { quoteNumber });

  const html = buildDocumentEmailTemplate({
    subject,
    companyName,
    clientName: adminName,
    documentLabel: translate(locale, 'email.clientReply.documentLabel'),
    documentNumber: quoteNumber,
    details: [{ label: translate(locale, 'email.clientReply.clientLabel'), value: clientName }],
    messageBody,
    ...(quoteDetailUrl ? {
      ctaLabel: translate(locale, 'email.clientReply.ctaLabel'),
      ctaUrl: quoteDetailUrl,
    } : {}),
    locale,
  });

  const text = messageBody;

  return sendDocumentEmail({
    to,
    subject,
    html,
    text,
    companyName,
    attachmentFilename: `${quoteNumber}.pdf`,
  });
}

export async function sendPaymentReceipt({
  to,
  clientName,
  invoiceNumber,
  amount,
  paymentMethod,
  paidAt,
  companyName,
  pdfBuffer,
  locale = 'en',
}: SendPaymentReceiptParams) {
  const displayInvoiceNumber = formatInvoiceDisplayNumber(locale, invoiceNumber);
  const localizedPaymentMethod = getPaymentMethodLabel(paymentMethod, locale);
  const subject = translate(locale, 'email.paymentReceipt.subject', { invoiceNumber: displayInvoiceNumber });
  const messageBody = translate(locale, 'email.paymentReceipt.messageBody');

  const html = buildDocumentEmailTemplate({
    subject,
    companyName,
    clientName,
    documentLabel: translate(locale, 'email.paymentReceipt.documentLabel'),
    documentNumber: displayInvoiceNumber,
    details: [
      { label: translate(locale, 'email.paymentReceipt.amountPaid'), value: amount },
      { label: translate(locale, 'email.paymentReceipt.method'), value: localizedPaymentMethod },
      { label: translate(locale, 'email.paymentReceipt.paidAt'), value: formatDate(paidAt) },
    ],
    messageBody,
    locale,
  });

  const text = translate(locale, 'email.paymentReceipt.textBody', {
    name: clientName,
    invoiceNumber: displayInvoiceNumber,
    amount,
    paymentMethod: localizedPaymentMethod,
    paidAt: formatDate(paidAt),
  });

  return sendDocumentEmail({
    to,
    subject,
    html,
    text,
    companyName,
    attachmentFilename: `${displayInvoiceNumber}-receipt.pdf`,
    pdfBuffer,
  });
}
