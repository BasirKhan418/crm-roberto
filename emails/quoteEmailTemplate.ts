interface QuoteEmailData {
  messageBody: string;
  subject: string;
  company: {
    companyName: string;
    ownerName: string;
    address: string;
    phone: string;
    email: string;
    vatNumber: string;
    logoUrl: string | null;
  } | null;
  client: {
    fullName: string;
    companyName: string | null;
    email: string | null;
  };
  quote: {
    quoteNumber: string;
    date: string;
    totalIncludingTax: string;
    validityDays: number;
  };
  locale: 'en' | 'fr';
  signLinkUrl?: string | null;
}

const t = {
  en: {
    quoteLabel: 'Quote',
    dateLabel: 'Date',
    amountLabel: 'Total incl. tax',
    validityLabel: 'Valid for',
    days: 'days',
    pdfNote: 'The quote is attached to this email as a PDF.',
    contactLine: 'If you have any questions, feel free to contact us.',
    sentBy: 'Sent by',
    phoneLabel: 'Phone',
    emailLabel: 'Email',
    addressLabel: 'Address',
    vatLabel: 'VAT',
    footerNote: 'This email was sent automatically. Please do not reply directly to this address.',
  },
  fr: {
    quoteLabel: 'Devis',
    dateLabel: 'Date',
    amountLabel: 'Total TTC',
    validityLabel: 'Valable',
    days: 'jours',
    pdfNote: 'Le devis est joint à cet e-mail au format PDF.',
    contactLine: 'Pour toute question, n\'hésitez pas à nous contacter.',
    sentBy: 'Envoyé par',
    phoneLabel: 'Téléphone',
    emailLabel: 'E-mail',
    addressLabel: 'Adresse',
    vatLabel: 'TVA',
    footerNote: 'Cet e-mail a été envoyé automatiquement. Merci de ne pas répondre directement à cette adresse.',
  },
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getQuoteEmailTemplate(data: QuoteEmailData): string {
  const labels = t[data.locale];
  const company = data.company;
  const client = data.client;
  const quote = data.quote;

  const companyName = escapeHtml(company?.companyName || company?.ownerName || 'Our Company');
  const companyEmail = escapeHtml(company?.email || '');
  const companyPhone = escapeHtml(company?.phone || '');
  const companyAddress = escapeHtml(company?.address || '');
  const companyVat = company?.vatNumber ? escapeHtml(company.vatNumber) : '';
  const logoUrl = company?.logoUrl || '';

  const clientName = escapeHtml(client.fullName || '');
  const clientCompany = client.companyName ? escapeHtml(client.companyName) : '';

  const htmlBody = escapeHtml(data.messageBody).replace(/\n/g, '<br>');
  const signLinkUrl = data.signLinkUrl ? escapeHtml(data.signLinkUrl) : null;

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${companyName}" style="max-width:160px;max-height:56px;height:auto;">`
    : `<div style="font-size:20px;font-weight:700;color:#1a2e44;letter-spacing:-0.3px;">${companyName}</div>`;

  const companyDetailsRows = [
    companyPhone ? `<tr><td style="padding:2px 0;color:#6b7280;font-size:12px;">${labels.phoneLabel}: ${companyPhone}</td></tr>` : '',
    companyEmail ? `<tr><td style="padding:2px 0;color:#6b7280;font-size:12px;">${labels.emailLabel}: ${companyEmail}</td></tr>` : '',
    companyAddress ? `<tr><td style="padding:2px 0;color:#6b7280;font-size:12px;">${labels.addressLabel}: ${companyAddress}</td></tr>` : '',
    companyVat ? `<tr><td style="padding:2px 0;color:#6b7280;font-size:12px;">${labels.vatLabel}: ${companyVat}</td></tr>` : '',
  ].filter(Boolean).join('\n');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${data.locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(data.subject)}</title>
  <style type="text/css">
    body { margin:0; padding:0; background:#ebedf0; font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing:antialiased; }
    table { border-spacing:0; border-collapse:collapse; }
    td { padding:0; }
    img { border:0; display:block; }
    @media screen and (max-width: 600px) {
      .main { width:100% !important; }
      .content-cell { padding:24px 18px !important; }
      .quote-table td { display:block !important; width:100% !important; padding:4px 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#ebedf0;">
  <center style="width:100%;table-layout:fixed;background:#ebedf0;padding:40px 0;">

    <table class="main" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #d0d4d9;">

      <!-- Top accent line -->
      <tr>
        <td style="height:4px;background:#1a2e44;font-size:0;line-height:0;">&nbsp;</td>
      </tr>

      <!-- Header: logo / company name -->
      <tr>
        <td style="padding:28px 32px 24px;border-bottom:1px solid #e2e5e9;">
          ${logoBlock}
        </td>
      </tr>

      <!-- Quote reference banner -->
      <tr>
        <td style="background:#f6f7f9;padding:20px 32px;border-bottom:1px solid #e2e5e9;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:17px;font-weight:700;color:#1a2e44;padding-bottom:14px;letter-spacing:-0.2px;">
                ${labels.quoteLabel} ${escapeHtml(quote.quoteNumber)}
              </td>
            </tr>
            <tr>
              <td>
                <table class="quote-table" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="33%" style="font-size:12px;color:#6b7280;padding:2px 0;">
                      ${labels.dateLabel}
                    </td>
                    <td width="34%" style="font-size:12px;color:#6b7280;padding:2px 0;">
                      ${labels.amountLabel}
                    </td>
                    <td width="33%" style="font-size:12px;color:#6b7280;padding:2px 0;">
                      ${labels.validityLabel}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;font-weight:600;color:#1a2e44;padding:2px 0;">
                      ${escapeHtml(quote.date)}
                    </td>
                    <td style="font-size:14px;font-weight:600;color:#1a2e44;padding:2px 0;">
                      ${escapeHtml(quote.totalIncludingTax)}
                    </td>
                    <td style="font-size:14px;font-weight:600;color:#1a2e44;padding:2px 0;">
                      ${quote.validityDays} ${labels.days}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Message body -->
      <tr>
        <td class="content-cell" style="padding:32px 32px 28px;">
          ${clientCompany ? `<p style="margin:0 0 2px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.3px;">${clientCompany}</p>` : ''}
          ${clientName ? `<p style="margin:0 0 24px;font-size:15px;font-weight:600;color:#1a2e44;">${clientName}</p>` : ''}

          <div style="font-size:14px;line-height:1.75;color:#374151;">
            ${htmlBody}
          </div>
          ${signLinkUrl
            ? `<p style="margin:16px 0 10px;">
                 <a href="${signLinkUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">Review and Sign Quote</a>
               </p>
               <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">If this button does not work, use this link to continue:</p>
               <p style="margin:0 0 10px;font-size:13px;word-break:break-all;"><a href="${signLinkUrl}" style="color:#1a2e44;text-decoration:underline;">${signLinkUrl}</a></p>`
            : ''}
        </td>
      </tr>

      <!-- PDF attachment note -->
      <tr>
        <td style="padding:0 32px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;border:1px solid #e2e5e9;">
            <tr>
              <td style="padding:14px 18px;font-size:13px;color:#374151;">
                ${labels.pdfNote}
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Contact note -->
      <tr>
        <td style="padding:0 32px 32px;">
          <p style="margin:0;font-size:13px;color:#6b7280;">
            ${labels.contactLine}
          </p>
        </td>
      </tr>

      <!-- Separator -->
      <tr>
        <td style="padding:0 32px;">
          <div style="height:1px;background:#e2e5e9;font-size:0;line-height:0;">&nbsp;</div>
        </td>
      </tr>

      <tr>
        <td style="padding:24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <p style="margin:0 0 6px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#9ca3af;">
                  ${labels.sentBy}
                </p>
                <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#1a2e44;">
                  ${companyName}
                </p>
                <table cellpadding="0" cellspacing="0">
                  ${companyDetailsRows}
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#1a2e44;padding:20px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:#94a3b8;">
                &copy; ${new Date().getFullYear()} ${companyName}
              </td>
            </tr>
            <tr>
              <td style="font-size:11px;color:#64748b;padding-top:4px;">
                ${labels.footerNote}
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>

  </center>
</body>
</html>`;
}
