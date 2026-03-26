import ConnectEmailClient from "../connectEmailClient";
import { getEmailTemplate } from "../template";

interface SendWelcomeEmailParams {
  email: string;
  name: string;
}

export const sendWelcomeEmail = async ({ email, name }: SendWelcomeEmailParams) => {
  try {
    const emailTransporter = await ConnectEmailClient();

    if (!emailTransporter) {
      return { message: "Failed to connect to email client", success: false };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roberto.devsomeware.com";
    const subject = "Welcome to CRM APP - Your workspace is ready";

    const emailContent = `
      <div style="
        background: linear-gradient(135deg, #0A3D62 0%, #2B9EB3 100%);
        border-radius: 14px;
        padding: 26px 22px;
        color: #ffffff;
        margin-bottom: 24px;
      ">
        <p style="margin:0 0 10px 0;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;opacity:.9;">
          Welcome aboard
        </p>
        <h2 style="margin:0;font-size:28px;line-height:1.25;color:#ffffff;">
          Hi ${name}, your CRM workspace is now live.
        </h2>
        <p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:#e7f7fb;">
          Great to have you here. We built this space so you can run client relationships smoothly and close opportunities faster.
        </p>
      </div>

      <p style="font-size:16px;line-height:1.7;color:#263238;margin:0 0 16px 0;">
        Here is what you can do right away:
      </p>

      <table role="presentation" width="100%" style="border-collapse:separate;border-spacing:0 10px;margin:0 0 18px 0;">
        <tr>
          <td style="background:#f6fbfd;border:1px solid #dceff5;border-radius:10px;padding:12px 14px;font-size:15px;line-height:1.6;color:#1f2937;">
            <strong>Manage clients</strong> and keep complete profiles, contact history, and notes in one place.
          </td>
        </tr>
        <tr>
          <td style="background:#f6fbfd;border:1px solid #dceff5;border-radius:10px;padding:12px 14px;font-size:15px;line-height:1.6;color:#1f2937;">
            <strong>Track suppliers</strong> and maintain vendor details for more predictable operations.
          </td>
        </tr>
        <tr>
          <td style="background:#f6fbfd;border:1px solid #dceff5;border-radius:10px;padding:12px 14px;font-size:15px;line-height:1.6;color:#1f2937;">
            <strong>Use activity timelines</strong> to stay on top of follow-ups and never miss a next step.
          </td>
        </tr>
        <tr>
          <td style="background:#f6fbfd;border:1px solid #dceff5;border-radius:10px;padding:12px 14px;font-size:15px;line-height:1.6;color:#1f2937;">
            <strong>Monitor your dashboard</strong> for a quick snapshot of business progress and priorities.
          </td>
        </tr>
      </table>

      <div style="text-align:center;margin:24px 0 12px 0;">
        <a href="${appUrl}/dashboard" target="_blank" style="display:inline-block;background:#0A3D62;color:#ffffff !important;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:10px;">
          Open My CRM Dashboard
        </a>
      </div>

      <p style="font-size:14px;line-height:1.7;color:#4b5563;margin:10px 0 0 0;">
        Need help getting started? Reply to this email and our team will be happy to guide you.
      </p>
    `;

    await emailTransporter.sendMail({
      from: `"CRM APP" <${process.env.EMAIL_USER_V2}>`,
      to: email,
      subject,
      html: getEmailTemplate(emailContent),
      text: `
Hi ${name},

Welcome to CRM APP. Your workspace is now ready.

Here is what you can do next:
- Manage clients and notes in one place
- Track suppliers and business relationships
- Stay on top of follow-ups with activity history
- View your dashboard for progress insights

Open your dashboard: ${appUrl}/dashboard

If you need help getting started, reply to this email.
      `,
    });

    console.log(`Welcome email sent successfully to ${email}`);
    return { message: "Welcome email sent successfully", success: true };

  } catch (error) {
    console.error("Error sending welcome email:", error);
    return { message: "Error sending welcome email", error, success: false };
  }
};