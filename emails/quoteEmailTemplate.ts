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
    greeting: 'Hello',
    preheader: 'Your quote is ready. Review the attached PDF and sign securely online.',
    readyBadge: 'Quote ready for signature',
    heroTitle: 'Please review and sign your quote',
    heroBody: 'The full quote is attached as a PDF. Use the secure button below to open the signing page on mobile or desktop.',
    quoteLabel: 'Quote',
    dateLabel: 'Date',
    amountLabel: 'Total incl. tax',
    validityLabel: 'Valid for',
    days: 'days',
    secureActionLabel: 'Main action',
    secureActionTitle: 'Open the secure signing page',
    secureActionBody: 'Review the quote summary, confirm the details, and sign in a few taps.',
    ctaLabel: 'Review and Sign Quote',
    ctaNote: 'Secure link. Expires in 30 days.',
    fallbackLabel: 'If the button does not work, copy and paste this secure link into your browser:',
    messageLabel: 'Message from the company',
    stepsLabel: 'How it works',
    step1Title: 'Open the secure page',
    step1Body: 'Use the button below to continue from your phone or computer.',
    step2Title: 'Review and sign',
    step2Body: 'Check the quote summary and add your signature when you are ready.',
    step3Title: 'Get instant confirmation',
    step3Body: 'As soon as you sign, the quote is recorded as completed.',
    pdfNoteTitle: 'Attached PDF',
    pdfNote: 'A PDF copy of the quote is included for your records.',
    contactLine: 'If you have any questions before signing, contact us using the details below.',
    sentBy: 'Sent by',
    phoneLabel: 'Phone',
    emailLabel: 'Email',
    addressLabel: 'Address',
    vatLabel: 'VAT',
    footerNote: 'This email was sent automatically. Please do not reply directly to this address.',
  },
  fr: {
    greeting: 'Bonjour',
    preheader: 'Votre devis est pret. Consultez le PDF joint et signez en ligne via un lien securise.',
    readyBadge: 'Devis pret pour signature',
    heroTitle: 'Merci de verifier et signer votre devis',
    heroBody: 'Le devis complet est joint en PDF. Utilisez le bouton securise ci-dessous pour ouvrir la page de signature sur mobile ou ordinateur.',
    quoteLabel: 'Devis',
    dateLabel: 'Date',
    amountLabel: 'Total TTC',
    validityLabel: 'Valable',
    days: 'jours',
    secureActionLabel: 'Action principale',
    secureActionTitle: 'Ouvrir la page de signature securisee',
    secureActionBody: 'Consultez le resume du devis, confirmez les informations, puis signez en quelques instants.',
    ctaLabel: 'Verifier et signer le devis',
    ctaNote: 'Lien securise. Expire dans 30 jours.',
    fallbackLabel: 'Si le bouton ne fonctionne pas, copiez et collez ce lien securise dans votre navigateur :',
    messageLabel: 'Message de l\'entreprise',
    stepsLabel: 'Comment cela fonctionne',
    step1Title: 'Ouvrir la page securisee',
    step1Body: 'Utilisez le bouton ci-dessous pour continuer depuis votre telephone ou votre ordinateur.',
    step2Title: 'Verifier et signer',
    step2Body: 'Consultez le resume du devis puis ajoutez votre signature lorsque vous etes pret.',
    step3Title: 'Recevoir une confirmation immediate',
    step3Body: 'Des la signature envoyee, le devis est enregistre comme signe.',
    pdfNoteTitle: 'PDF joint',
    pdfNote: 'Une copie PDF du devis est jointe pour vos archives.',
    contactLine: 'Pour toute question avant signature, contactez-nous avec les coordonnees ci-dessous.',
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
  const greetingLine = clientName ? `${labels.greeting} ${clientName},` : `${labels.greeting},`;
  const preheader = escapeHtml(`${labels.preheader} ${labels.quoteLabel} ${quote.quoteNumber}.`);

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${companyName}" style="max-width:140px;max-height:48px;height:auto;">`
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${escapeHtml(data.subject)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    /* === RESET === */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      min-width: 100% !important;
      background: #eef2f6;
      font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    table {
      border-spacing: 0;
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    td { padding: 0; }
    img {
      border: 0;
      display: block;
      -ms-interpolation-mode: bicubic;
      max-width: 100%;
      height: auto;
    }
    /* Prevent iOS blue links */
    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }
    /* Gmail fix */
    u + #body a {
      color: inherit;
      text-decoration: none;
      font-size: inherit;
      font-family: inherit;
      font-weight: inherit;
      line-height: inherit;
    }

    .main-wrapper {
      width: 100%;
      max-width: 640px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #d8dee6;
    }

    .cta-button {
      display: inline-block;
      background: #ffffff;
      color: #0f172a !important;
      padding: 16px 28px;
      border-radius: 999px;
      text-decoration: none;
      font-size: 15px;
      font-weight: 700;
      mso-padding-alt: 0;
      text-align: center;
    }

    /* ============================
       MOBILE RESPONSIVE STYLES
       ============================ */

    /* Tablets & large phones (≤640px) */
    @media only screen and (max-width: 640px) {
      .main-wrapper {
        width: 100% !important;
        min-width: 100% !important;
        border-left: 0 !important;
        border-right: 0 !important;
      }
      .outer-padding {
        padding: 12px 0 !important;
      }
    }

    /* Standard phones (≤480px) */
    @media only screen and (max-width: 480px) {
      .section-pad {
        padding-left: 16px !important;
        padding-right: 16px !important;
      }
      .inner-pad {
        padding: 18px 16px !important;
      }
      .hero-pad {
        padding: 20px 16px !important;
      }
      .hero-title {
        font-size: 22px !important;
        line-height: 1.25 !important;
      }
      .hero-body {
        font-size: 14px !important;
      }
      /* Stack 2-col grid into single column */
      .half-col {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      .half-col-spacer {
        display: block !important;
        height: 10px !important;
        width: 100% !important;
        font-size: 0 !important;
        line-height: 0 !important;
      }
      .stat-value {
        font-size: 16px !important;
      }
      /* Stack 3-col steps into single column */
      .step-col {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      .step-spacer {
        display: block !important;
        height: 10px !important;
        width: 100% !important;
        font-size: 0 !important;
        line-height: 0 !important;
      }
      .step-inner {
        padding: 14px !important;
      }
      .step-num {
        width: 24px !important;
        height: 24px !important;
        line-height: 24px !important;
        font-size: 11px !important;
      }
      .step-title {
        font-size: 13px !important;
        margin-top: 10px !important;
      }
      .step-body {
        font-size: 12px !important;
      }
      /* CTA section */
      .cta-section-pad {
        padding: 20px 16px !important;
      }
      .cta-title {
        font-size: 20px !important;
      }
      .cta-button {
        display: block !important;
        width: 100% !important;
        padding: 16px 12px !important;
        text-align: center !important;
        box-sizing: border-box !important;
        font-size: 15px !important;
      }
      .fallback-box {
        padding: 12px !important;
      }
      .fallback-url {
        font-size: 12px !important;
      }
      /* Message section */
      .message-pad {
        padding: 18px 16px !important;
      }
      .message-body {
        font-size: 14px !important;
        line-height: 1.7 !important;
      }
      /* Footer */
      .footer-pad {
        padding: 18px 16px !important;
      }
      .footer-bar {
        padding: 16px !important;
      }
    }

    /* Small phones (≤375px — iPhone SE, older Androids) */
    @media only screen and (max-width: 375px) {
      .section-pad {
        padding-left: 12px !important;
        padding-right: 12px !important;
      }
      .inner-pad {
        padding: 14px 12px !important;
      }
      .hero-pad {
        padding: 16px 12px !important;
      }
      .hero-title {
        font-size: 20px !important;
      }
      .hero-body {
        font-size: 13px !important;
      }
      .badge {
        font-size: 10px !important;
        padding: 5px 10px !important;
      }
      .stat-label {
        font-size: 10px !important;
      }
      .stat-value {
        font-size: 15px !important;
      }
      .cta-title {
        font-size: 18px !important;
      }
      .cta-button {
        padding: 14px 10px !important;
        font-size: 14px !important;
      }
      .step-title {
        font-size: 12px !important;
      }
      .step-body {
        font-size: 11px !important;
      }
      .footer-bar {
        padding: 14px 12px !important;
      }
    }

    /* Extra-small phones (≤320px — iPhone 5/SE1, Galaxy S3) */
    @media only screen and (max-width: 320px) {
      .section-pad {
        padding-left: 10px !important;
        padding-right: 10px !important;
      }
      .hero-title {
        font-size: 18px !important;
      }
      .hero-body {
        font-size: 12px !important;
      }
      .stat-value {
        font-size: 14px !important;
      }
      .cta-title {
        font-size: 16px !important;
      }
      .cta-button {
        font-size: 13px !important;
        padding: 12px 8px !important;
      }
    }
  </style>
</head>
<body id="body" style="margin:0;padding:0;background:#eef2f6;width:100%;">
  <!--[if mso]><span style="display:none!important;">&#8199;</span><![endif]-->
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:0;line-height:0;max-height:0;">${preheader}&#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847;</span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f6;">
    <tr>
      <td align="center" class="outer-padding" style="padding:24px 8px;">

        <!--[if mso]><table role="presentation" width="640" cellpadding="0" cellspacing="0" align="center"><tr><td><![endif]-->
        <table role="presentation" class="main-wrapper" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #d8dee6;">

          <!-- === TOP ACCENT BAR === -->
          <tr>
            <td style="height:6px;background:#0f172a;font-size:0;line-height:0;" aria-hidden="true">&nbsp;</td>
          </tr>

          <!-- === LOGO === -->
          <tr>
            <td class="section-pad" style="padding:24px 32px 18px;border-bottom:1px solid #e2e8f0;">
              ${logoBlock}
            </td>
          </tr>

          <!-- === HERO SECTION === -->
          <tr>
            <td class="section-pad" style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;">
                <tr>
                  <td class="hero-pad" style="padding:24px;">
                    <div class="badge" style="display:inline-block;border-radius:999px;background:#0f172a;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;padding:7px 12px;">
                      ${labels.readyBadge}
                    </div>
                    <h1 class="hero-title" style="margin:16px 0 0;font-size:28px;line-height:1.2;font-weight:700;color:#0f172a;letter-spacing:-0.6px;">
                      ${labels.heroTitle}
                    </h1>
                    <p class="hero-body" style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#475569;">
                      ${labels.heroBody}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- === QUOTE STATS GRID (2×2) === -->
          <tr>
            <td class="section-pad" style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <!-- Row 1 -->
                <tr>
                  <td class="half-col" width="50%" style="padding-right:6px;vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;">
                      <tr>
                        <td class="inner-pad" style="padding:18px;">
                          <p class="stat-label" style="margin:0;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;">${labels.quoteLabel}</p>
                          <p class="stat-value" style="margin:8px 0 0;font-size:18px;font-weight:700;color:#0f172a;word-break:break-word;">${escapeHtml(quote.quoteNumber)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!--[if mso]></td><td><![endif]-->
                  <td class="half-col-spacer" style="display:none;font-size:0;line-height:0;" aria-hidden="true">&nbsp;</td>
                  <td class="half-col" width="50%" style="padding-left:6px;vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;">
                      <tr>
                        <td class="inner-pad" style="padding:18px;">
                          <p class="stat-label" style="margin:0;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;">${labels.dateLabel}</p>
                          <p class="stat-value" style="margin:8px 0 0;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(quote.date)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Row 1→2 spacer -->
                <tr>
                  <td colspan="3" style="height:12px;font-size:0;line-height:0;" aria-hidden="true">&nbsp;</td>
                </tr>
                <!-- Row 2 -->
                <tr>
                  <td class="half-col" width="50%" style="padding-right:6px;vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;">
                      <tr>
                        <td class="inner-pad" style="padding:18px;">
                          <p class="stat-label" style="margin:0;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;">${labels.amountLabel}</p>
                          <p class="stat-value" style="margin:8px 0 0;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(quote.totalIncludingTax)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td class="half-col-spacer" style="display:none;font-size:0;line-height:0;" aria-hidden="true">&nbsp;</td>
                  <td class="half-col" width="50%" style="padding-left:6px;vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;">
                      <tr>
                        <td class="inner-pad" style="padding:18px;">
                          <p class="stat-label" style="margin:0;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;">${labels.validityLabel}</p>
                          <p class="stat-value" style="margin:8px 0 0;font-size:18px;font-weight:700;color:#0f172a;">${quote.validityDays} ${labels.days}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- === CTA / SIGN LINK SECTION === -->
          ${signLinkUrl
            ? `<tr>
                <td class="section-pad" style="padding:0 32px 24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:0;">
                    <tr>
                      <td class="cta-section-pad" style="padding:24px;">
                        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#cbd5e1;">${labels.secureActionLabel}</p>
                        <h2 class="cta-title" style="margin:12px 0 0;font-size:24px;line-height:1.25;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${labels.secureActionTitle}</h2>
                        <p style="margin:12px 0 0;font-size:14px;line-height:1.7;color:#cbd5e1;">${labels.secureActionBody}</p>
                        <p style="margin:22px 0 0;">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${signLinkUrl}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="50%" fillcolor="#ffffff">
                            <w:anchorlock/>
                            <center style="color:#0f172a;font-family:'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;font-weight:700;">${labels.ctaLabel}</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-->
                          <a href="${signLinkUrl}" class="cta-button" style="display:inline-block;background:#ffffff;color:#0f172a !important;padding:16px 28px;border-radius:999px;text-decoration:none;font-size:15px;font-weight:700;text-align:center;min-width:200px;-webkit-text-size-adjust:none;">${labels.ctaLabel}</a>
                          <!--<![endif]-->
                        </p>
                        <p style="margin:14px 0 0;font-size:12px;color:#cbd5e1;">${labels.ctaNote}</p>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);">
                          <tr>
                            <td class="fallback-box" style="padding:14px 16px;">
                              <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#cbd5e1;">${labels.fallbackLabel}</p>
                              <p class="fallback-url" style="margin:0;font-size:13px;line-height:1.6;word-break:break-all;overflow-wrap:break-word;">
                                <a href="${signLinkUrl}" style="color:#ffffff;text-decoration:underline;">${signLinkUrl}</a>
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`
            : ''}

          <!-- === MESSAGE SECTION === -->
          <tr>
            <td class="section-pad" style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;">
                <tr>
                  <td class="message-pad" style="padding:22px 24px;">
                    ${clientCompany ? `<p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;">${clientCompany}</p>` : ''}
                    <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#0f172a;">${greetingLine}</p>
                    <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;">${labels.messageLabel}</p>
                    <div class="message-body" style="font-size:14px;line-height:1.8;color:#334155;">
                      ${htmlBody}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- === STEPS SECTION === -->
          <tr>
            <td class="section-pad" style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;">
                <tr>
                  <td style="padding:22px 24px 22px;">
                    <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;">${labels.stepsLabel}</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td class="step-col" width="33.333%" style="padding-right:6px;vertical-align:top;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;">
                            <tr>
                              <td class="step-inner" style="padding:16px;">
                                <div class="step-num" style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:#0f172a;color:#ffffff;font-size:12px;font-weight:700;">1</div>
                                <p class="step-title" style="margin:12px 0 0;font-size:14px;font-weight:700;color:#0f172a;">${labels.step1Title}</p>
                                <p class="step-body" style="margin:8px 0 0;font-size:13px;line-height:1.7;color:#475569;">${labels.step1Body}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td class="step-spacer" style="display:none;font-size:0;line-height:0;" aria-hidden="true">&nbsp;</td>
                        <td class="step-col" width="33.333%" style="padding-left:6px;padding-right:6px;vertical-align:top;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;">
                            <tr>
                              <td class="step-inner" style="padding:16px;">
                                <div class="step-num" style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:#0f172a;color:#ffffff;font-size:12px;font-weight:700;">2</div>
                                <p class="step-title" style="margin:12px 0 0;font-size:14px;font-weight:700;color:#0f172a;">${labels.step2Title}</p>
                                <p class="step-body" style="margin:8px 0 0;font-size:13px;line-height:1.7;color:#475569;">${labels.step2Body}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td class="step-spacer" style="display:none;font-size:0;line-height:0;" aria-hidden="true">&nbsp;</td>
                        <td class="step-col" width="33.333%" style="padding-left:6px;vertical-align:top;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;">
                            <tr>
                              <td class="step-inner" style="padding:16px;">
                                <div class="step-num" style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:#0f172a;color:#ffffff;font-size:12px;font-weight:700;">3</div>
                                <p class="step-title" style="margin:12px 0 0;font-size:14px;font-weight:700;color:#0f172a;">${labels.step3Title}</p>
                                <p class="step-body" style="margin:8px 0 0;font-size:13px;line-height:1.7;color:#475569;">${labels.step3Body}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- === PDF NOTE === -->
          <tr>
            <td class="section-pad" style="padding:0 32px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;">
                <tr>
                  <td class="inner-pad" style="padding:16px 18px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;">${labels.pdfNoteTitle}</p>
                    <p style="margin:0;font-size:13px;line-height:1.7;color:#475569;">${labels.pdfNote}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- === CONTACT LINE === -->
          <tr>
            <td class="section-pad" style="padding:0 32px 28px;">
              <p style="margin:0;font-size:13px;line-height:1.7;color:#475569;">
                ${labels.contactLine}
              </p>
            </td>
          </tr>

          <!-- === DIVIDER === -->
          <tr>
            <td class="section-pad" style="padding:0 32px;">
              <div style="height:1px;background:#e2e8f0;font-size:0;line-height:0;" aria-hidden="true">&nbsp;</div>
            </td>
          </tr>

          <!-- === COMPANY FOOTER === -->
          <tr>
            <td class="footer-pad" style="padding:24px 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0 0 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;">
                      ${labels.sentBy}
                    </p>
                    <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#0f172a;">
                      ${companyName}
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      ${companyDetailsRows}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- === BOTTOM BAR === -->
          <tr>
            <td class="footer-bar" style="background:#0f172a;padding:20px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:12px;color:#cbd5e1;">
                    &copy; ${new Date().getFullYear()} ${companyName}
                  </td>
                </tr>
                <tr>
                  <td style="font-size:11px;line-height:1.6;color:#94a3b8;padding-top:6px;">
                    ${labels.footerNote}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!--[if mso]></td></tr></table><![endif]-->

      </td>
    </tr>
  </table>
</body>
</html>`;
}