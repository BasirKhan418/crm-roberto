export type QuoteConversationRole = 'admin' | 'client';

export interface QuoteConversationMessage {
  role: QuoteConversationRole;
  text: string;
  sentAt?: Date | string | null;
}

interface QuoteConversationSource {
  rejectionComment?: string | null;
  adminReplyMessage?: string | null;
  conversationMessages?: Array<{
    role?: string | null;
    text?: string | null;
    sentAt?: Date | string | null;
  }> | null;
}

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSentAt(value: Date | string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value instanceof Date ? value : new Date(value);
  return Number.isFinite(normalized.getTime()) ? normalized.toISOString() : undefined;
}

function isConversationRole(value: unknown): value is QuoteConversationRole {
  return value === 'admin' || value === 'client';
}

export function buildQuoteConversation(
  source: QuoteConversationSource
): Array<{ role: QuoteConversationRole; text: string; sentAt?: string }> {
  const existingMessages = (source.conversationMessages ?? []).flatMap((message) => {
    const role = isConversationRole(message.role) ? message.role : null;
    const text = normalizeText(message.text);

    if (!role || !text) {
      return [];
    }

    return [
      {
        role,
        text,
        sentAt: normalizeSentAt(message.sentAt),
      },
    ];
  });

  const hasExistingClientRejection = existingMessages.some(
    (message) => message.role === 'client' && message.text === normalizeText(source.rejectionComment)
  );
  const hasExistingAdminReply = existingMessages.some(
    (message) => message.role === 'admin' && message.text === normalizeText(source.adminReplyMessage)
  );

  const mergedMessages: Array<{ role: QuoteConversationRole; text: string; sentAt?: string }> = [];

  const rejectionComment = normalizeText(source.rejectionComment);
  if (rejectionComment && !hasExistingClientRejection) {
    mergedMessages.push({ role: 'client', text: rejectionComment });
  }

  const adminReplyMessage = normalizeText(source.adminReplyMessage);
  if (adminReplyMessage && !hasExistingAdminReply) {
    mergedMessages.push({ role: 'admin', text: adminReplyMessage });
  }

  mergedMessages.push(...existingMessages);

  return mergedMessages;
}