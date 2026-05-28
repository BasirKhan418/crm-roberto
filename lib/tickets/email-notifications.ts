import ConnectEmailClient from "@/emails/connectEmailClient";
import { renderTicketNotificationEmail } from '@/emails/ticketNotificationTemplate';
import type { TicketStatus, TicketType } from '@/lib/tickets/constants';

type TicketEmailNotificationInput = {
  to: string;
  action: 'ticket_created' | 'ticket_replied' | 'ticket_resolved';
  locale?: 'en' | 'fr';
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

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://roberto.devsomeware.com').trim().replace(/\/+$/, '');
  const { subject, html, text } = renderTicketNotificationEmail({
    action: input.action,
    locale: input.locale || 'en',
    companyName: input.companyName,
    companyLogoUrl: input.companyLogoUrl,
    senderName: input.senderName,
    recipientName: input.recipientName,
    ticketTitle: input.ticketTitle,
    ticketType: input.ticketType,
    status: input.status,
    messageBody: input.messageBody,
    attachmentCount: input.attachmentCount,
    ticketUrl: input.ticketUrl,
    brandLogoUrl: `${appUrl}/logo.png`,
  });

  await transporter.sendMail({
    from: `"ROBY CRM" <${process.env.EMAIL_USER_V2 || process.env.EMAIL_USER}>`,
    to: input.to,
    subject,
    text,
    html,
  });

  return { success: true };
}
