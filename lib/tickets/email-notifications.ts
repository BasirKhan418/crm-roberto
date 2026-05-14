import ConnectEmailClient from "@/emails/connectEmailClient";

type TicketEmailNotificationInput = {
  to: string;
  subject: string;
  body: string;
  title?: string;
};

export async function sendTicketEmailNotification(input: TicketEmailNotificationInput): Promise<{
  success: boolean;
  message?: string;
}> {
  const transporter = await ConnectEmailClient();
  if (!transporter) {
    return {
      success: false,
      message: "Email transporter unavailable",
    };
  }

  const safeTitle = (input.title || "CRM Roberto").trim() || "CRM Roberto";
  const textBody = input.body.trim();

  await transporter.sendMail({
    from: `"${safeTitle}" <${process.env.EMAIL_USER_V2 || process.env.EMAIL_USER}>`,
    to: input.to,
    subject: input.subject,
    text: textBody,
    html: `<p>${textBody.replace(/\n/g, "<br>")}</p>`,
  });

  return { success: true };
}
