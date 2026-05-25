import { z } from "zod";

import {
  TICKET_ALLOWED_MIME_TYPES,
  TICKET_LINKED_TYPES,
  TICKET_MAX_FILE_SIZE_BYTES,
  TICKET_STATUSES,
  TICKET_TYPES,
} from "@/lib/tickets/constants";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const toNullableString = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return value;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
};

const toBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }

  return value;
};

const objectIdSchema = z.string().trim().regex(objectIdPattern, "Invalid ID");

export const ticketAttachmentMetadataSchema = z.object({
  originalName: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  mimeType: z.enum(TICKET_ALLOWED_MIME_TYPES),
  extension: z.string().trim().min(1),
  sizeBytes: z.preprocess(
    toNumber,
    z.number().int().nonnegative().max(TICKET_MAX_FILE_SIZE_BYTES)
  ),
  storageKey: z.string().trim().min(1),
  url: z.string().trim().url(),
  checksum: z.preprocess(toNullableString, z.string().trim().nullable().optional()),
});

export const createTicketSchema = z
  .object({
    title: z.string().trim().min(3).max(180),
    type: z.enum(TICKET_TYPES).default("document"),
    assignedTo: z.array(objectIdSchema).max(30).optional().default([]),
    linkedType: z.enum(TICKET_LINKED_TYPES).nullable().optional(),
    linkedId: z
      .preprocess(toNullableString, z.string().trim().regex(objectIdPattern).nullable().optional()),
    body: z.preprocess(toNullableString, z.string().trim().max(10000).nullable().optional()),
    attachments: z.array(ticketAttachmentMetadataSchema).max(10).optional().default([]),
  })
  .superRefine((input, context) => {
    if (!input.body && input.attachments.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Either message body or at least one attachment is required",
        path: ["body"],
      });
    }

    if (input.linkedType && !input.linkedId) {
      context.addIssue({
        code: "custom",
        message: "linkedId is required when linkedType is set",
        path: ["linkedId"],
      });
    }

    if (!input.linkedType && input.linkedId) {
      context.addIssue({
        code: "custom",
        message: "linkedType is required when linkedId is set",
        path: ["linkedType"],
      });
    }
  });

export const ticketReplySchema = z
  .object({
    body: z.preprocess(toNullableString, z.string().trim().max(10000).nullable().optional()),
    attachments: z.array(ticketAttachmentMetadataSchema).max(10).optional().default([]),
  })
  .superRefine((input, context) => {
    if (!input.body && input.attachments.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Either message body or at least one attachment is required",
        path: ["body"],
      });
    }
  });

export const ticketStatusChangeSchema = z.object({
  status: z.enum(TICKET_STATUSES),
});

export const ticketListQuerySchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  type: z.enum(TICKET_TYPES).optional(),
  linkedType: z.enum(TICKET_LINKED_TYPES).optional(),
  linkedId: z.string().trim().regex(objectIdPattern).optional(),
  assignedToMe: z.preprocess(toBoolean, z.boolean().optional()),
  createdByMe: z.preprocess(toBoolean, z.boolean().optional()),
  unreadOnly: z.preprocess(toBoolean, z.boolean().optional()),
  search: z.string().trim().max(120).optional(),
  sortBy: z.enum(["updatedAt", "createdAt", "title", "status", "type"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.preprocess(toNumber, z.number().int().positive().optional()),
  limit: z.preprocess(toNumber, z.number().int().positive().max(100).optional()),
});

export const ticketLookupQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  limit: z.preprocess(toNumber, z.number().int().positive().max(100).optional()),
});

export type TicketAttachmentMetadataDTO = z.infer<typeof ticketAttachmentMetadataSchema>;
export type CreateTicketDTO = z.infer<typeof createTicketSchema>;
export type TicketReplyDTO = z.infer<typeof ticketReplySchema>;
export type TicketStatusChangeDTO = z.infer<typeof ticketStatusChangeSchema>;
export type TicketListQueryDTO = z.infer<typeof ticketListQuerySchema>;
export type TicketLookupQueryDTO = z.infer<typeof ticketLookupQuerySchema>;
