import { GetObjectCommand } from "@aws-sdk/client-s3";

import ConnectEmailClient from "@/emails/connectEmailClient";
import { renderTicketNotificationEmail } from '@/emails/ticketNotificationTemplate';
import type { TicketStatus, TicketType } from '@/lib/tickets/constants';
import { getS3Client } from "@/utils/s3/s3Client";

const MAX_EMAIL_ATTACHMENT_COUNT = 5;
const MAX_EMAIL_ATTACHMENT_TOTAL_BYTES = 18 * 1024 * 1024;

export type TicketEmailNotificationAttachment = {
  displayName?: string | null;
  originalName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  storageKey?: string | null;
};

function sanitizeAttachmentFilename(value: string | null | undefined) {
  const trimmed = String(value || 'attachment').trim();
  const withoutUnsafe = trimmed.replace(/[\r\n"\\]/g, '-');
  return withoutUnsafe || 'attachment';
}

function normalizeAttachmentSize(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

async function resolveTicketEmailAttachments(attachments: TicketEmailNotificationAttachment[] | undefined) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return [];
  }

  const bucket = (process.env.AWS_S3_BUCKET || '').trim();
  if (!bucket) {
    return [];
  }

  const mailAttachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
  let totalBytes = 0;

  for (const attachment of attachments.slice(0, MAX_EMAIL_ATTACHMENT_COUNT)) {
    const storageKey = String(attachment.storageKey || '').trim();
    if (!storageKey) {
      continue;
    }

    const declaredSize = normalizeAttachmentSize(attachment.sizeBytes);
    if (declaredSize && declaredSize > MAX_EMAIL_ATTACHMENT_TOTAL_BYTES) {
      continue;
    }

    if (declaredSize && totalBytes + declaredSize > MAX_EMAIL_ATTACHMENT_TOTAL_BYTES) {
      continue;
    }

    try {
      const objectResponse = await getS3Client().send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: storageKey,
        })
      );

      if (!objectResponse.Body) {
        continue;
      }

      const content = Buffer.from(await objectResponse.Body.transformToByteArray());
      if (content.length === 0 || totalBytes + content.length > MAX_EMAIL_ATTACHMENT_TOTAL_BYTES) {
        continue;
      }

      totalBytes += content.length;
      mailAttachments.push({
        filename: sanitizeAttachmentFilename(attachment.displayName || attachment.originalName),
        content,
        contentType: objectResponse.ContentType || attachment.mimeType || 'application/octet-stream',
      });
    } catch (error) {
      console.error('[tickets] failed to load email attachment', {
        storageKey,
        error,
      });
    }
  }

  return mailAttachments;
}

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
  attachments?: TicketEmailNotificationAttachment[];
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
  const mailAttachments = await resolveTicketEmailAttachments(input.attachments);
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
    attachments: mailAttachments,
  });

  return { success: true };
}
