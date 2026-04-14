import ConnectEmailClient from "../connectEmailClient";
import { authEmailLayout } from "./authEmailLayout";

type Locale = 'en' | 'fr';

interface SendWelcomeEmailParams {
  email: string;
  name: string;
  locale?: Locale;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const t = {
  en: {
    subject: 'Welcome — your workspace is ready',
    heading: 'Welcome',
    greeting: (name: string) => `Hello ${name},`,
    intro: 'Your CRM workspace is now ready. Here is what you can do right away:',
    features: [
      ['Manage clients', 'Keep complete profiles, contact history, and notes in one place.'],
      ['Track suppliers', 'Maintain vendor details for more predictable operations.'],
      ['Activity timelines', 'Stay on top of follow-ups and never miss a next step.'],
      ['Dashboard', 'Get a quick snapshot of business progress and priorities.'],
    ] as [string, string][],
    cta: 'Open dashboard',
    help: 'Need help getting started? Reply to this email and we will be happy to guide you.',
    plainText: (name: string, url: string) =>
      `Hello ${name},\n\nYour CRM workspace is now ready.\n\nOpen your dashboard: ${url}/dashboard\n\nIf you need help, reply to this email.`,
  },
  fr: {
    subject: 'Bienvenue\u00a0\u2014 votre espace est pr\u00eat',
    heading: 'Bienvenue',
    greeting: (name: string) => `Bonjour ${name},`,
    intro: 'Votre espace CRM est d\u00e9sormais pr\u00eat. Voici ce que vous pouvez faire d\u00e8s maintenant\u00a0:',
    features: [
      ['G\u00e9rer vos clients', 'Centralisez profils, historique et notes en un seul endroit.'],
      ['Suivre vos fournisseurs', 'Gardez les d\u00e9tails de vos fournisseurs pour des op\u00e9rations fiables.'],
      ['Fil d\'activit\u00e9', 'Restez au courant de vos relances et ne manquez aucune \u00e9tape.'],
      ['Tableau de bord', 'Visualisez la progression et les priorit\u00e9s de votre activit\u00e9.'],
    ] as [string, string][],
    cta: 'Ouvrir le tableau de bord',
    help: 'Besoin d\'aide pour d\u00e9marrer\u00a0? R\u00e9pondez \u00e0 cet e-mail, nous serons ravis de vous accompagner.',
    plainText: (name: string, url: string) =>
      `Bonjour ${name},\n\nVotre espace CRM est pr\u00eat.\n\nOuvrir votre tableau de bord\u00a0: ${url}/dashboard\n\nSi vous avez besoin d'aide, r\u00e9pondez \u00e0 cet e-mail.`,
  },
};

export const sendWelcomeEmail = async ({ email, name, locale = 'fr' }: SendWelcomeEmailParams) => {
  try {
    const emailTransporter = await ConnectEmailClient();

    if (!emailTransporter) {
      return { message: "Failed to connect to email client", success: false };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roberto.devsomeware.com";
    const labels = t[locale];
    const safeName = escapeHtml(name);

    const featureRows = labels.features.map(([title, desc]) => `
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e5e9;font-size:14px;color:#374151;line-height:1.6;">
                <strong style="color:#1a2e44;">${title}</strong><br>
                <span style="color:#6b7280;">${desc}</span>
              </td>
            </tr>
    `).join('');

    const content = `
          <h2 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#1a2e44;">${labels.heading}</h2>
          <div style="height:1px;background:#e2e5e9;margin:16px 0;"></div>

          <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.6;">${labels.greeting(safeName)}</p>
          <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">${labels.intro}</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;border:1px solid #e2e5e9;margin:0 0 24px;">
            ${featureRows}
          </table>

          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr>
              <td style="background:#1a2e44;padding:12px 28px;">
                <a href="${escapeHtml(appUrl)}/dashboard" target="_blank" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;display:block;">
                  ${labels.cta}
                </a>
              </td>
            </tr>
          </table>

          <p style="margin:0;font-size:13px;color:#6b7280;">${labels.help}</p>
    `;

    await emailTransporter.sendMail({
      from: `"CRM" <${process.env.EMAIL_USER_V2}>`,
      to: email,
      subject: labels.subject,
      html: authEmailLayout({ title: labels.subject, locale, content }),
      text: labels.plainText(name, appUrl),
    });

    console.log(`Welcome email sent successfully to ${email}`);
    return { message: "Welcome email sent successfully", success: true };

  } catch (error) {
    console.error("Error sending welcome email:", error);
    return { message: "Error sending welcome email", error, success: false };
  }
};