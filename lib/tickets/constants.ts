import {
  EXPENSE_ALLOWED_MIME_TYPES,
  EXPENSE_MAX_FILE_SIZE_BYTES,
} from "@/lib/expenses/upload";

export const TICKET_TYPES = ["accounting", "validation", "document", "dispute"] as const;

export const TICKET_STATUSES = ["open", "waiting", "replied", "resolved", "archived"] as const;

export const TICKET_LINKED_TYPES = ["expense", "invoice", "supplier", "client"] as const;

export const TICKET_ALLOWED_MIME_TYPES = EXPENSE_ALLOWED_MIME_TYPES;
export const TICKET_MAX_FILE_SIZE_BYTES = EXPENSE_MAX_FILE_SIZE_BYTES;

export type TicketType = (typeof TICKET_TYPES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketLinkedType = (typeof TICKET_LINKED_TYPES)[number];

export function isTicketMimeTypeAllowed(mimeType: string): boolean {
  return TICKET_ALLOWED_MIME_TYPES.includes(
    mimeType as (typeof TICKET_ALLOWED_MIME_TYPES)[number]
  );
}
