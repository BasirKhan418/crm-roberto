import ConnectEmailClient from "../connectEmailClient";
import { authEmailLayout } from "./authEmailLayout";

type Locale = "en" | "fr";

type SendInvitationEmailParams = {
  email: string;
  invitationUrl: string;
  invitedByName?: string;
  inviteeName?: string;
  role: string;
  expiresAt?: Date | string | null;
  companyName?: string;
  companyLogoUrl?: string;
  locale?: Locale;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const roleLabels: Record<Locale, Record<string, string>> = {
  en: {
    administrator: "Admin",
    external_accountant: "Accountant",
  },
  fr: {
    administrator: "Admin",
    external_accountant: "Comptable",
  },
};

const t = {
  en: {
    subject: (workspaceName: string) => `You are invited to join ${workspaceName}`,
    heading: (workspaceName: string) => `Invitation to ${workspaceName}`,
    greeting: (name?: string) => (name ? `Hello ${name},` : "Hello,"),
    intro: (workspaceName: string) => `You have been invited to join the ${workspaceName} workspace in Roby.`,
    workspace: (workspaceName: string) => `Workspace: ${workspaceName}`,
    invitedBy: (name: string) => `Invited by: ${name}`,
    role: (role: string) => `Assigned role: ${role}`,
    expiresAt: (value: string) => `Invitation expires: ${value}`,
    cta: "Accept invitation",
    fallback:
      "If the button does not work, copy and paste this URL in your browser:",
    ignore: "If you were not expecting this invitation, you can ignore this email.",
    plainText: (params: {
      inviteeName?: string;
      invitationUrl: string;
      roleLabel: string;
      workspaceName: string;
      invitedByName?: string;
      expiresAt?: string;
    }) => {
      const intro = params.inviteeName ? `Hello ${params.inviteeName},` : "Hello,";
      const invitedByLine = params.invitedByName ? `Invited by: ${params.invitedByName}\n` : "";
      const expiresLine = params.expiresAt ? `Invitation expires: ${params.expiresAt}\n` : "";
      return `${intro}\n\nYou have been invited to join the ${params.workspaceName} workspace in Roby.\n\nWorkspace: ${params.workspaceName}\nAssigned role: ${params.roleLabel}\n${invitedByLine}${expiresLine}\nAccept invitation: ${params.invitationUrl}\n\nIf you were not expecting this invitation, you can ignore this email.`;
    },
  },
  fr: {
    subject: (workspaceName: string) => `Vous êtes invité à rejoindre ${workspaceName}`,
    heading: (workspaceName: string) => `Invitation à ${workspaceName}`,
    greeting: (name?: string) => (name ? `Bonjour ${name},` : "Bonjour,"),
    intro: (workspaceName: string) => `Vous avez été invité à rejoindre l'espace ${workspaceName} sur Roby.`,
    workspace: (workspaceName: string) => `Espace : ${workspaceName}`,
    invitedBy: (name: string) => `Invité par : ${name}`,
    role: (role: string) => `Rôle attribué : ${role}`,
    expiresAt: (value: string) => `Invitation valide jusqu'au : ${value}`,
    cta: "Accepter l'invitation",
    fallback:
      "Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :",
    ignore: "Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet e-mail.",
    plainText: (params: {
      inviteeName?: string;
      invitationUrl: string;
      roleLabel: string;
      workspaceName: string;
      invitedByName?: string;
      expiresAt?: string;
    }) => {
      const intro = params.inviteeName ? `Bonjour ${params.inviteeName},` : "Bonjour,";
      const invitedByLine = params.invitedByName ? `Invité par : ${params.invitedByName}\n` : "";
      const expiresLine = params.expiresAt ? `Invitation valide jusqu'au : ${params.expiresAt}\n` : "";
      return `${intro}\n\nVous avez été invité à rejoindre l'espace ${params.workspaceName} sur Roby.\n\nEspace : ${params.workspaceName}\nRôle attribué : ${params.roleLabel}\n${invitedByLine}${expiresLine}\nAccepter l'invitation : ${params.invitationUrl}\n\nSi vous n'attendiez pas cette invitation, vous pouvez ignorer cet e-mail.`;
    },
  },
} as const;

function formatExpiry(value: Date | string | null | undefined, locale: Locale) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const formatLocale = locale === "fr" ? "fr-FR" : "en-GB";
  return new Intl.DateTimeFormat(formatLocale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export async function sendInvitationEmail({
  email,
  invitationUrl,
  invitedByName,
  inviteeName,
  role,
  expiresAt,
  companyName,
  companyLogoUrl,
  locale = "fr",
}: SendInvitationEmailParams) {
  try {
    const emailTransporter = await ConnectEmailClient();

    if (!emailTransporter) {
      return { success: false, message: "Failed to connect to email client" };
    }

    const labels = t[locale];
    const workspaceName = companyName?.trim() || "CRM Roberto";
    const subject = labels.subject(workspaceName);
    const heading = labels.heading(workspaceName);
    const roleLabel = roleLabels[locale][role] || role;
    const formattedExpiry = formatExpiry(expiresAt, locale);

    const detailRows: string[] = [
      `<p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(labels.workspace(workspaceName))}</p>`,
      `<p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(labels.role(roleLabel))}</p>`,
    ];

    if (invitedByName) {
      detailRows.push(
        `<p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(labels.invitedBy(invitedByName))}</p>`
      );
    }

    if (formattedExpiry) {
      detailRows.push(
        `<p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(labels.expiresAt(formattedExpiry))}</p>`
      );
    }

    const logoMarkup = companyLogoUrl
      ? `
      <div style="margin:0 0 16px;">
        <img src="${escapeHtml(companyLogoUrl)}" alt="${escapeHtml(workspaceName)}" style="max-height:56px;width:auto;display:block;border:0;" />
      </div>
      `
      : "";

    const content = `
      ${logoMarkup}
      <h2 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#1a2e44;">${escapeHtml(heading)}</h2>
      <div style="height:1px;background:#e2e5e9;margin:16px 0;"></div>

      <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(labels.greeting(inviteeName))}</p>
      <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(labels.intro(workspaceName))}</p>

      ${detailRows.join("")}

      <table cellpadding="0" cellspacing="0" style="margin:18px 0 20px;">
        <tr>
          <td style="background:#1a2e44;padding:12px 28px;">
            <a href="${escapeHtml(invitationUrl)}" target="_blank" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;display:block;">
              ${escapeHtml(labels.cta)}
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">${escapeHtml(labels.fallback)}</p>
      <p style="margin:0 0 18px;font-size:12px;word-break:break-all;color:#1f2937;">${escapeHtml(invitationUrl)}</p>

      <p style="margin:0;font-size:13px;color:#6b7280;">${escapeHtml(labels.ignore)}</p>
    `;

    await emailTransporter.sendMail({
      from: `"CRM" <${process.env.EMAIL_USER_V2 || process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html: authEmailLayout({ title: subject, locale, content }),
      text: labels.plainText({
        inviteeName,
        invitationUrl,
        workspaceName,
        roleLabel,
        invitedByName,
        expiresAt: formattedExpiry || undefined,
      }),
    });

    return { success: true, message: "Invitation email sent successfully" };
  } catch (error) {
    console.error("Error sending invitation email:", error);
    return { success: false, message: "Error sending invitation email" };
  }
}
