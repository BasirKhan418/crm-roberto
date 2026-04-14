type Locale = 'en' | 'fr';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface AuthEmailLayoutOptions {
  title: string;
  locale: Locale;
  content: string;
}

const footerText: Record<Locale, string> = {
  en: 'This is an automated message. Please do not reply directly to this email.',
  fr: 'Ceci est un message automatique. Merci de ne pas r\u00e9pondre directement \u00e0 cet e-mail.',
};

export function authEmailLayout({ title, locale, content }: AuthEmailLayoutOptions): string {
  const appName = 'CRM';
  const year = new Date().getFullYear();

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(title)}</title>
  <style type="text/css">
    body { margin:0; padding:0; background:#ebedf0; font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing:antialiased; }
    table { border-spacing:0; border-collapse:collapse; }
    td { padding:0; }
    img { border:0; display:block; }
    @media screen and (max-width: 600px) {
      .main { width:100% !important; }
      .content-cell { padding:24px 18px !important; }
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

      <!-- Content -->
      <tr>
        <td class="content-cell" style="padding:36px 32px 32px;">
          ${content}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#1a2e44;padding:20px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:#94a3b8;">
                &copy; ${year} ${escapeHtml(appName)}
              </td>
            </tr>
            <tr>
              <td style="font-size:11px;color:#64748b;padding-top:4px;">
                ${escapeHtml(footerText[locale])}
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
