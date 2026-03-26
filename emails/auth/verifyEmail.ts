import ConnectEmailClient from "../connectEmailClient";
import { getEmailTemplate } from "../template";

interface SendOtpEmailParams {
  email: string;
  otp: string;
}

export const sendOtpEmail = async ({ email, otp }: SendOtpEmailParams) => {
  try {
    const emailTransporter = await ConnectEmailClient();

    if (!emailTransporter) {
      return { message: "Failed to connect to email client", success: false };
    }

    const subject = "Your Crm Email Verification OTP";

    const emailContent = `
      <h2 style="color: #333333; margin-top: 0;">Verify Your Email</h2>

      <p>Hello,</p>

      <p>
        Use the OTP below to verify your email address for <strong>CRM APP</strong>.
      </p>
      
      <div style="
        background: white;
        border: 2px solid #2B9EB3;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        margin: 20px 0;
      ">
        <p style="margin: 0; font-size: 14px; color: #666;">
          Your Verification OTP
        </p>
        <p style="
          font-size: 32px;
          font-weight: bold;
          color: #0A3D62;
          letter-spacing: 5px;
          margin: 10px 0;
        ">
          ${otp}
        </p>
      </div>
      
      <p><strong>This OTP will expire in 5 minutes.</strong></p>

      <p style="font-size: 14px; color: #777;">
        If you did not request this verification, please ignore this email.
      </p>
    `;

    await emailTransporter.sendMail({
      from: `"CRM APP" <${process.env.EMAIL_USER_V2}>`,
      to: email,
      subject,
      html: getEmailTemplate(emailContent),
      text: `
Your CRM APP verification OTP is: ${otp}

This OTP will expire in 5 minutes.

If you did not request this verification, please ignore this email.
      `,
    });

    console.log(`OTP email sent successfully to ${email}`);
    return { message: "OTP sent successfully", success: true };

  } catch (error) {
    console.error("Error sending OTP email:", error);
    return { message: "Error sending OTP email", error, success: false };
  }
};