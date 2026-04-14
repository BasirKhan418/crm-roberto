import ConnectEmailClient from "../connectEmailClient";
import { authEmailLayout } from "./authEmailLayout";

type Locale = 'en' | 'fr';

interface SendOtpEmailParams {
  email: string;
  otp: string;
  locale?: Locale;
}

const t = {
  en: {
    subject: 'Your verification code',
    heading: 'Email Verification',
    greeting: 'Hello,',
    intro: 'Use the code below to verify your email address.',
    codeLabel: 'Verification code',
    expiry: 'This code will expire in 5 minutes.',
    ignore: 'If you did not request this verification, you can safely ignore this email.',
    plainText: (otp: string) =>
      `Your verification code is: ${otp}\n\nThis code will expire in 5 minutes.\n\nIf you did not request this, please ignore this email.`,
  },
  fr: {
    subject: 'Votre code de v\u00e9rification',
    heading: 'V\u00e9rification de l\'e-mail',
    greeting: 'Bonjour,',
    intro: 'Utilisez le code ci-dessous pour v\u00e9rifier votre adresse e-mail.',
    codeLabel: 'Code de v\u00e9rification',
    expiry: 'Ce code expirera dans 5 minutes.',
    ignore: 'Si vous n\'avez pas demand\u00e9 cette v\u00e9rification, vous pouvez ignorer cet e-mail.',
    plainText: (otp: string) =>
      `Votre code de v\u00e9rification est\u00a0: ${otp}\n\nCe code expirera dans 5 minutes.\n\nSi vous n'avez pas fait cette demande, veuillez ignorer cet e-mail.`,
  },
};

export const sendOtpEmail = async ({ email, otp, locale = 'fr' }: SendOtpEmailParams) => {
  try {
    const emailTransporter = await ConnectEmailClient();

    if (!emailTransporter) {
      return { message: "Failed to connect to email client", success: false };
    }

    const labels = t[locale];

    const content = `
          <h2 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#1a2e44;">${labels.heading}</h2>
          <div style="height:1px;background:#e2e5e9;margin:16px 0;"></div>

          <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.6;">${labels.greeting}</p>
          <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">${labels.intro}</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;border:1px solid #e2e5e9;margin:0 0 24px;">
            <tr>
              <td style="padding:20px;text-align:center;">
                <p style="margin:0 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#6b7280;">
                  ${labels.codeLabel}
                </p>
                <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:6px;color:#1a2e44;">
                  ${otp}
                </p>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151;">${labels.expiry}</p>
          <p style="margin:0;font-size:13px;color:#6b7280;">${labels.ignore}</p>
    `;

    await emailTransporter.sendMail({
      from: `"CRM" <${process.env.EMAIL_USER_V2}>`,
      to: email,
      subject: labels.subject,
      html: authEmailLayout({ title: labels.subject, locale, content }),
      text: labels.plainText(otp),
    });

    console.log(`OTP email sent successfully to ${email}`);
    return { message: "OTP sent successfully", success: true };

  } catch (error) {
    console.error("Error sending OTP email:", error);
    return { message: "Error sending OTP email", error, success: false };
  }
};