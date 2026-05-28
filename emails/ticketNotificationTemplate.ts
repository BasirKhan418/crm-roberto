import { getTicketStatusLabel, getTicketTypeLabel } from '@/lib/tickets/i18n';
import type { TicketStatus, TicketType } from '@/lib/tickets/constants';

type Locale = 'en' | 'fr';
type TicketEmailAction = 'ticket_created' | 'ticket_replied' | 'ticket_resolved';

export type RenderTicketNotificationEmailInput = {
  action: TicketEmailAction;
  locale: Locale;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  senderName: string;
  recipientName?: string | null;
  ticketTitle: string;
  ticketType: TicketType;
  status: TicketStatus;
  messageBody?: string | null;
  attachmentCount?: number;
  ticketUrl: string;
  brandLogoUrl: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeMultilineHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, '<br>');
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function buildCompanyMonogram(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    return 'R';
  }

  const parts = normalized.split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part.charAt(0).toUpperCase()).join('');
  return letters || normalized.charAt(0).toUpperCase() || 'R';
}

const copy = {
  en: {
    subject: {
      ticket_created: 'ROBY - New Ticket',
      ticket_replied: 'ROBY - Ticket Updated',
      ticket_resolved: 'ROBY - Ticket Resolved',
    },
    eyebrow: {
      ticket_created: 'New ticket activity',
      ticket_replied: 'Ticket updated',
      ticket_resolved: 'Resolution update',
    },
    heading: {
      ticket_created: 'A ticket needs your attention',
      ticket_replied: 'A new reply was posted',
      ticket_resolved: 'A ticket was resolved',
    },
    summary: {
      ticket_created: 'A new ROBY ticket has been created and shared with you.',
      ticket_replied: 'The ticket conversation was updated with a new message.',
      ticket_resolved: 'The ticket status was updated to resolved.',
    },
    greeting: (name: string | null) => (name ? `Hello ${name},` : 'Hello,'),
    senderPrefix: 'Sender',
    companyLabel: 'Company',
    ticketLabel: 'Ticket',
    typeLabel: 'Type',
    statusLabel: 'Status',
    messageLabel: 'Message',
    attachmentsLabel: 'Attachments',
    attachmentNone: 'No attachments included',
    attachmentCount: (count: number) => `${count} attachment${count > 1 ? 's' : ''} included`,
    openTicket: 'Open Ticket',
    fallbackMessage: {
      ticket_created: 'A new ticket was created in ROBY.',
      ticket_replied: 'A new reply was posted on this ticket.',
      ticket_resolved: 'This ticket was marked as resolved.',
    },
    footer: 'This is an automated ROBY notification. Please do not reply directly to this email.',
    plainTextLabel: {
      company: 'Company',
      sender: 'Sender',
      ticket: 'Ticket',
      type: 'Type',
      status: 'Status',
      message: 'Message',
      attachments: 'Attachments',
      link: 'Open ticket',
    },
  },
  fr: {
    subject: {
      ticket_created: 'ROBY - Nouveau ticket',
      ticket_replied: 'ROBY - Ticket mis a jour',
      ticket_resolved: 'ROBY - Ticket resolu',
    },
    eyebrow: {
      ticket_created: 'Nouvelle activite ticket',
      ticket_replied: 'Ticket mis a jour',
      ticket_resolved: 'Mise a jour de resolution',
    },
    heading: {
      ticket_created: 'Un ticket demande votre attention',
      ticket_replied: 'Une nouvelle reponse a ete publiee',
      ticket_resolved: 'Un ticket a ete resolu',
    },
    summary: {
      ticket_created: 'Un nouveau ticket ROBY a ete cree et partage avec vous.',
      ticket_replied: 'La conversation du ticket a ete mise a jour avec un nouveau message.',
      ticket_resolved: 'Le statut du ticket a ete passe a resolu.',
    },
    greeting: (name: string | null) => (name ? `Bonjour ${name},` : 'Bonjour,'),
    senderPrefix: 'Expediteur',
    companyLabel: 'Entreprise',
    ticketLabel: 'Ticket',
    typeLabel: 'Type',
    statusLabel: 'Statut',
    messageLabel: 'Message',
    attachmentsLabel: 'Pieces jointes',
    attachmentNone: 'Aucune piece jointe',
    attachmentCount: (count: number) => `${count} piece${count > 1 ? 's' : ''} jointe${count > 1 ? 's' : ''}`,
    openTicket: 'Ouvrir le ticket',
    fallbackMessage: {
      ticket_created: 'Un nouveau ticket a ete cree dans ROBY.',
      ticket_replied: 'Une nouvelle reponse a ete publiee sur ce ticket.',
      ticket_resolved: 'Ce ticket a ete marque comme resolu.',
    },
    footer: 'Ceci est une notification automatique ROBY. Merci de ne pas repondre directement a cet e-mail.',
    plainTextLabel: {
      company: 'Entreprise',
      sender: 'Expediteur',
      ticket: 'Ticket',
      type: 'Type',
      status: 'Statut',
      message: 'Message',
      attachments: 'Pieces jointes',
      link: 'Ouvrir le ticket',
    },
  },
} as const;

export function renderTicketNotificationEmail(input: RenderTicketNotificationEmailInput) {
  const labels = copy[input.locale];
  const safeCompanyName = (input.companyName || 'ROBY').trim() || 'ROBY';
  const safeSenderName = input.senderName.trim() || 'ROBY';
  const safeRecipientName = input.recipientName?.trim() || null;
  const safeTicketTitle = input.ticketTitle.trim() || 'Untitled ticket';
  const safeMessageBody = input.messageBody ? normalizeText(input.messageBody) : '';
  const attachmentCount = Math.max(0, input.attachmentCount || 0);
  const statusLabel = getTicketStatusLabel(input.status, input.locale);
  const typeLabel = getTicketTypeLabel(input.ticketType, input.locale);
  const subject = labels.subject[input.action];
  const brandLogoUrl = trimTrailingSlash(input.brandLogoUrl);
  const ticketUrl = input.ticketUrl.trim();
  const companyMonogram = buildCompanyMonogram(safeCompanyName);
  const attachmentsText = attachmentCount > 0 ? labels.attachmentCount(attachmentCount) : labels.attachmentNone;
  const messageHtml = safeMessageBody
    ? normalizeMultilineHtml(safeMessageBody)
    : escapeHtml(labels.fallbackMessage[input.action]);
  const fontFamily = "Aptos, Calibri, 'Segoe UI', Arial, 'Helvetica Neue', Helvetica, sans-serif";

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${input.locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(subject)}</title>
  <style type="text/css">
    body { margin:0; padding:0; background:#f3f5f9; font-family:${fontFamily}; -webkit-font-smoothing:antialiased; }
    table { border-spacing:0; border-collapse:collapse; }
    td { padding:0; }
    img { border:0; display:block; }
    .main-shell { background:#ffffff !important; }
    .brand-card,
    .company-card,
    .hero-card,
    .meta-card,
    .message-card {
      background:#ffffff !important;
    }
    @media screen and (max-width: 600px) {
      .main { width:100% !important; }
      .shell { padding:18px 12px !important; }
      .content { padding:28px 20px !important; }
      .header-cell,
      .company-cell,
      .meta-half,
      .pill-half,
      .cta-row,
      .cta-row td {
        display:block !important;
        width:100% !important;
      }
      .company-cell {
        padding-top:14px !important;
      }
      .company-cell table,
      .brand-card,
      .company-card,
      .hero-card,
      .meta-card,
      .message-card,
      .cta-table {
        width:100% !important;
      }
      .meta-half {
        padding-right:0 !important;
        padding-bottom:12px !important;
      }
      .meta-spacer,
      .pill-spacer {
        display:none !important;
        width:0 !important;
      }
      .hero-card-cell,
      .meta-card-cell,
      .message-card-cell {
        padding:20px 18px !important;
      }
      .brand-copy {
        display:block !important;
        padding-left:10px !important;
        padding-top:0 !important;
      }
      .hero-title { font-size:24px !important; line-height:31px !important; }
      .hero-summary { font-size:15px !important; line-height:24px !important; }
      .ticket-title { font-size:20px !important; line-height:28px !important; }
      .cta-link { display:block !important; width:100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f5f9;font-family:${fontFamily};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(labels.summary[input.action])}
  </div>
  <center class="shell" style="width:100%;background:#f3f5f9;padding:28px 16px;">
    <table class="main main-shell" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 24px 56px rgba(15,23,42,0.12);border:1px solid #dce4ee;">
      <tr>
        <td style="height:4px;background:linear-gradient(90deg,#dbeafe 0%,#1d4ed8 46%,#0f172a 100%);font-size:0;line-height:0;">&nbsp;</td>
      </tr>
      <tr>
        <td bgcolor="#f8fbff" style="background:linear-gradient(180deg,#ffffff 0%,#f8fbff 72%,#eff5ff 100%);padding:28px 28px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td class="header-cell" style="vertical-align:top;">
                <table class="brand-card" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#ffffff;border:1px solid #dce4ee;border-radius:18px;box-shadow:0 10px 22px rgba(148,163,184,0.12);">
                  <tr>
                    <td style="padding:12px 14px;vertical-align:middle;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="vertical-align:middle;">
                            <img src="${escapeHtml(brandLogoUrl)}" alt="ROBY" width="112" style="width:112px;max-width:112px;height:auto;">
                          </td>
                          <td class="brand-copy" style="padding-left:12px;font-family:${fontFamily};color:#475569;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;vertical-align:middle;white-space:nowrap;">
                            CRM platform
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
              <td class="company-cell" style="width:1%;white-space:nowrap;vertical-align:top;">
                <table class="company-card" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#ffffff;border:1px solid #dce4ee;border-radius:18px;box-shadow:0 10px 22px rgba(148,163,184,0.12);">
                  <tr>
                    <td style="padding:10px 12px;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="vertical-align:middle;">
                            ${input.companyLogoUrl ? `<img src="${escapeHtml(input.companyLogoUrl)}" alt="${escapeHtml(safeCompanyName)}" width="40" height="40" style="width:40px;height:40px;border-radius:12px;object-fit:cover;background:#ffffff;border:1px solid #e2e8f0;">` : `<div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#1d4ed8,#0f172a);font-family:${fontFamily};color:#fff;font-size:14px;font-weight:700;line-height:40px;text-align:center;">${escapeHtml(companyMonogram)}</div>`}
                          </td>
                          <td style="padding-left:10px;font-family:${fontFamily};">
                            <div style="font-size:11px;line-height:14px;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;">${escapeHtml(labels.companyLabel)}</div>
                            <div style="font-size:14px;line-height:20px;color:#0f172a;font-weight:700;max-width:180px;">${escapeHtml(safeCompanyName)}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;">
            <tr>
              <td style="padding-bottom:18px;">
                <table class="hero-card" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:linear-gradient(180deg,#ffffff 0%,#f9fbff 100%);border:1px solid #dce4ee;border-radius:24px;box-shadow:0 14px 30px rgba(148,163,184,0.10);">
                  <tr>
                    <td class="hero-card-cell" style="padding:24px 24px 26px;">
                      <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#eef2ff;border:1px solid #d7def5;font-family:${fontFamily};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#3b82f6;">
                        ${escapeHtml(labels.eyebrow[input.action])}
                      </div>
                      <div class="hero-title" style="margin-top:16px;font-family:${fontFamily};font-size:32px;line-height:40px;font-weight:700;color:#0f172a;letter-spacing:-0.03em;">
                        ${escapeHtml(labels.heading[input.action])}
                      </div>
                      <div class="hero-summary" style="margin-top:12px;max-width:520px;font-family:${fontFamily};font-size:16px;line-height:26px;color:#475569;">
                        ${escapeHtml(labels.summary[input.action])}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="background:#ffffff;padding:0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td class="content" style="padding:32px 28px 14px;">
                <p style="margin:0 0 18px;font-family:${fontFamily};font-size:15px;line-height:24px;color:#334155;">
                  ${escapeHtml(labels.greeting(safeRecipientName))}
                </p>

                <table class="meta-card" width="100%" cellpadding="0" cellspacing="0" bgcolor="#fafcff" style="margin-bottom:20px;border:1px solid #dce4ee;border-radius:22px;overflow:hidden;background:#fafcff;">
                  <tr>
                    <td class="meta-card-cell" style="padding:22px 22px 8px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td class="meta-half" style="padding:0 0 14px;font-family:${fontFamily};font-size:12px;line-height:16px;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;">${escapeHtml(labels.companyLabel)}</td>
                          <td class="meta-half" style="padding:0 0 14px;font-family:${fontFamily};font-size:12px;line-height:16px;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;">${escapeHtml(labels.senderPrefix)}</td>
                        </tr>
                        <tr>
                          <td class="meta-half" style="padding:0 12px 18px 0;font-family:${fontFamily};font-size:16px;line-height:24px;color:#0f172a;font-weight:700;">${escapeHtml(safeCompanyName)}</td>
                          <td class="meta-half" style="padding:0 0 18px;font-family:${fontFamily};font-size:16px;line-height:24px;color:#0f172a;font-weight:700;">${escapeHtml(safeSenderName)}</td>
                        </tr>
                        <tr>
                          <td class="meta-half" style="padding:0 12px 14px 0;font-family:${fontFamily};font-size:12px;line-height:16px;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;">${escapeHtml(labels.ticketLabel)}</td>
                          <td class="meta-half" style="padding:0 0 14px;font-family:${fontFamily};font-size:12px;line-height:16px;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;">${escapeHtml(labels.attachmentsLabel)}</td>
                        </tr>
                        <tr>
                          <td class="meta-half ticket-title" style="padding:0 12px 0 0;font-family:${fontFamily};font-size:22px;line-height:30px;color:#0f172a;font-weight:700;letter-spacing:-0.02em;">${escapeHtml(safeTicketTitle)}</td>
                          <td class="meta-half" style="padding:0;font-family:${fontFamily};font-size:15px;line-height:24px;color:#334155;font-weight:600;">${escapeHtml(attachmentsText)}</td>
                        </tr>
                      </table>

                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
                        <tr>
                          <td class="pill-half" style="padding:12px 14px;border-radius:16px;background:#ffffff;border:1px solid #dce4ee;">
                            <div style="font-family:${fontFamily};font-size:11px;line-height:16px;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;">${escapeHtml(labels.typeLabel)}</div>
                            <div style="margin-top:6px;font-family:${fontFamily};font-size:15px;line-height:22px;color:#0f172a;font-weight:700;">${escapeHtml(typeLabel)}</div>
                          </td>
                          <td class="pill-spacer" style="width:12px;">&nbsp;</td>
                          <td class="pill-half" style="padding:12px 14px;border-radius:16px;background:#ffffff;border:1px solid #dce4ee;">
                            <div style="font-family:${fontFamily};font-size:11px;line-height:16px;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;">${escapeHtml(labels.statusLabel)}</div>
                            <div style="margin-top:6px;font-family:${fontFamily};font-size:15px;line-height:22px;color:#0f172a;font-weight:700;">${escapeHtml(statusLabel)}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <table class="message-card" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="margin-bottom:24px;border-radius:22px;overflow:hidden;background:linear-gradient(180deg,#ffffff 0%,#f9fbff 100%);border:1px solid #dce4ee;">
                  <tr>
                    <td class="message-card-cell" style="padding:22px;">
                      <div style="font-family:${fontFamily};font-size:12px;line-height:16px;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:12px;">${escapeHtml(labels.messageLabel)}</div>
                      <div style="font-family:${fontFamily};font-size:15px;line-height:26px;color:#0f172a;white-space:normal;">
                        ${messageHtml}
                      </div>
                    </td>
                  </tr>
                </table>

                <table class="cta-table" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                  <tr class="cta-row">
                    <td style="border-radius:16px;background:linear-gradient(135deg,#1d4ed8,#1e3a8a);box-shadow:0 12px 24px rgba(30,64,175,0.20);">
                      <a class="cta-link" href="${escapeHtml(ticketUrl)}" target="_blank" style="display:inline-block;padding:16px 24px;font-family:${fontFamily};font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">
                        ${escapeHtml(labels.openTicket)}
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 18px;font-family:${fontFamily};font-size:13px;line-height:22px;color:#64748b;">
                  ${escapeHtml(ticketUrl)}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;background:#ffffff;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding-top:18px;font-family:${fontFamily};font-size:12px;line-height:20px;color:#64748b;">
                      ${escapeHtml(labels.footer)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;

  const text = [
    subject,
    '',
    labels.summary[input.action],
    '',
    `${labels.plainTextLabel.company}: ${safeCompanyName}`,
    `${labels.plainTextLabel.sender}: ${safeSenderName}`,
    `${labels.plainTextLabel.ticket}: ${safeTicketTitle}`,
    `${labels.plainTextLabel.type}: ${typeLabel}`,
    `${labels.plainTextLabel.status}: ${statusLabel}`,
    `${labels.plainTextLabel.attachments}: ${attachmentsText}`,
    '',
    `${labels.plainTextLabel.message}:`,
    safeMessageBody || labels.fallbackMessage[input.action],
    '',
    `${labels.plainTextLabel.link}: ${ticketUrl}`,
  ].join('\n');

  return { subject, html, text };
}