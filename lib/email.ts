import ConnectEmailClient from "@/emails/connectEmailClient";
import { getQuoteEmailTemplate } from "@/emails/quoteEmailTemplate";

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
  paymentUrl: string;
  amount: string;
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
  ctaLabel,
  ctaUrl,
  ctaNote,
}: {
  subject: string;
  companyName: string;
  clientName: string;
  documentLabel: string;
  documentNumber: string;
  details: Array<{ label: string; value: string }>;
  messageBody: string;
  ctaLabel?: string;
  ctaUrl?: string;
  ctaNote?: string;
}): string {
  const safeSubject = escapeHtml(subject);
  const safeCompanyName = escapeHtml(companyName || "CRM");
  const safeClientName = escapeHtml(clientName || "Client");
  const safeDocumentLabel = escapeHtml(documentLabel);
  const safeDocumentNumber = escapeHtml(documentNumber);
  const safeMessageBody = escapeHtml(messageBody).replace(/\n/g, "<br>");

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
<html lang="en">
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
          <p style="margin:0 0 18px;font-size:15px;font-weight:600;color:#1a2e44;">Hello ${safeClientName},</p>
          <div style="font-size:14px;line-height:1.75;color:#374151;">${safeMessageBody}</div>
          ${ctaBlock}
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 24px;">
          <table width="100%" style="background:#f6f7f9;border:1px solid #e2e5e9;">
            <tr>
              <td style="padding:12px 14px;font-size:13px;color:#374151;">PDF attached for your records.</td>
            </tr>
          </table>
        </td>
      </tr>
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
  clientCompanyName = null,
  pdfBuffer,
}: SendSignLinkParams) {
  const subject =
    locale === "fr"
      ? `Devis ${quoteNumber} - Merci de verifier et signer`
      : `Quote ${quoteNumber} - Please review and sign`;

  const formattedDate = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(quoteDate));

  const formattedTotal = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
  }).format(totalIncludingTax / 100);

  const messageBody =
    locale === "fr"
      ? `Bonjour,\n\nVeuillez verifier et signer le devis ci-joint en utilisant ce lien securise :\n${signUrl}\n\nCe lien expire dans 30 jours.\n\nSi le bouton ne fonctionne pas, utilisez ce lien pour continuer :\n${signUrl}`
      : `Hello,\n\nPlease review and sign the attached quote using this secure link:\n${signUrl}\n\nThis link expires in 30 days.\n\nIf this button does not work, use this link to continue:\n${signUrl}`;

  const html = buildDocumentEmailTemplate({
    subject,
    companyName: company?.companyName || companyName || "CRM",
    clientName,
    documentLabel: locale === "fr" ? "Devis" : "Quote",
    documentNumber: quoteNumber,
    details: [
      { label: locale === "fr" ? "Date" : "Date", value: formattedDate },
      { label: locale === "fr" ? "Montant" : "Amount", value: formattedTotal },
      {
        label: locale === "fr" ? "Validite" : "Validity",
        value: locale === "fr" ? `${validityDays} jours` : `${validityDays} days`,
      },
    ],
    messageBody:
      locale === "fr"
        ? `Veuillez verifier et signer le devis ci-joint en utilisant ce lien securise :\n${signUrl}\n\nSi le bouton ne fonctionne pas, utilisez ce lien pour continuer :\n${signUrl}`
        : `Please review and sign the attached quote using this secure link:\n${signUrl}\n\nIf this button does not work, use this link to continue:\n${signUrl}`,
    ctaLabel: locale === "fr" ? "Verifier et signer le devis" : "Review and Sign Quote",
    ctaUrl: signUrl,
    ctaNote: locale === "fr" ? "Ce lien expire dans 30 jours." : "This link expires in 30 days.",
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
    : (
    locale === "fr"
      ? `Devis ${quoteNumber} - Merci de verifier et signer`
      : `Quote ${quoteNumber} - Please review and sign`
    );

  const resolvedMessageBody = messageBody?.trim()
    ? messageBody.trim()
    : (
    locale === "fr"
      ? `Bonjour,\n\nVeuillez trouver ci-joint votre devis ${quoteNumber}.\n\nLorsque vous etes pret, utilisez le bouton securise de cet e-mail pour consulter le devis et signer en ligne.\n\nN'hesitez pas a revenir vers nous pour toute question avant signature.\n\nBien cordialement,`
      : `Hello,\n\nPlease find attached your quote ${quoteNumber}.\n\nWhen you are ready, use the secure button in this email to review the quote and sign online.\n\nFeel free to contact us if you have any questions before signing.\n\nBest regards,`
    );

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
    locale === 'fr' ? `Reference du devis : ${quoteNumber}` : `Quote reference: ${quoteNumber}`,
    locale === 'fr' ? `Date : ${formattedDate}` : `Date: ${formattedDate}`,
    locale === 'fr' ? `Montant TTC : ${formattedTotal}` : `Total incl. tax: ${formattedTotal}`,
    locale === 'fr' ? `Validite : ${validityDays} jours` : `Validity: ${validityDays} days`,
    signUrl ? '' : '',
    signUrl ? (locale === 'fr' ? `Lien securise pour signer : ${signUrl}` : `Secure signing link: ${signUrl}`) : '',
    signUrl ? (locale === 'fr' ? 'Ce lien expire dans 30 jours.' : 'This link expires in 30 days.') : '',
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
}: SendInvoiceParams) {
  const subject = `Invoice ${invoiceNumber} - ${amount}`;
  const messageBody =
    "Please find your invoice attached. You can complete payment using the button below.";

  const html = buildDocumentEmailTemplate({
    subject,
    companyName,
    clientName,
    documentLabel: "Invoice",
    documentNumber: invoiceNumber,
    details: [
      { label: "Amount due", value: amount },
      { label: "Payment", value: "Online checkout" },
    ],
    messageBody,
    ctaLabel: "Pay now",
    ctaUrl: paymentUrl,
  });

  const text = `Hello ${clientName},\n\nYour invoice ${invoiceNumber} (${amount}) is attached.\nPay online: ${paymentUrl}`;

  return sendDocumentEmail({
    to,
    subject,
    html,
    text,
    companyName,
    attachmentFilename: `${invoiceNumber}.pdf`,
    pdfBuffer,
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
}: {
  to: string;
  adminName: string;
  companyName: string;
  quoteNumber: string;
  clientName: string;
  rejectionComment: string | null;
  quoteDetailUrl: string;
}) {
  const subject = `Quote ${quoteNumber} has been rejected by ${clientName}`;

  const commentLine = rejectionComment
    ? `The client left the following comment:\n\n"${rejectionComment}"`
    : "The client did not leave a comment.";

  const messageBody = `${clientName} has rejected quote ${quoteNumber}.\n\n${commentLine}\n\nYou can review the quote and resend an updated version using the button below.`;

  const html = buildDocumentEmailTemplate({
    subject,
    companyName,
    clientName: adminName,
    documentLabel: "Quote",
    documentNumber: quoteNumber,
    details: [
      { label: "Client", value: clientName },
      { label: "Action", value: "Rejected" },
      ...(rejectionComment ? [{ label: "Comment", value: rejectionComment }] : []),
    ],
    messageBody,
    ctaLabel: "View quote",
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

export async function sendPaymentReceipt({
  to,
  clientName,
  invoiceNumber,
  amount,
  paymentMethod,
  paidAt,
  companyName,
  pdfBuffer,
}: SendPaymentReceiptParams) {
  const subject = `Payment receipt - ${invoiceNumber}`;
  const messageBody = "We confirm that your payment has been received successfully.";

  const html = buildDocumentEmailTemplate({
    subject,
    companyName,
    clientName,
    documentLabel: "Payment receipt",
    documentNumber: invoiceNumber,
    details: [
      { label: "Amount paid", value: amount },
      { label: "Method", value: paymentMethod },
      { label: "Paid at", value: formatDate(paidAt) },
    ],
    messageBody,
  });

  const text = `Hello ${clientName},\n\nPayment received for invoice ${invoiceNumber}.\nAmount: ${amount}\nMethod: ${paymentMethod}\nPaid at: ${formatDate(paidAt)}`;

  return sendDocumentEmail({
    to,
    subject,
    html,
    text,
    companyName,
    attachmentFilename: `${invoiceNumber}-receipt.pdf`,
    pdfBuffer,
  });
}
