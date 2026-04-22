import { z } from 'zod';

import { createI18nKey as i18nKey } from '@/lib/i18n/messages';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, i18nKey('validation.invalidEntityId')).optional();

export const createActivitySchema = z.object({
  action: z.enum([
    'client_created',
    'client_updated',
    'client_deleted',
    'supplier_created',
    'supplier_updated',
    'supplier_deleted',
    'note_created',
    'note_updated',
    'note_deleted',
    'product_created',
    'product_updated',
    'product_deleted',
    'quote_created',
    'quote_duplicated',
    'quote_updated',
    'quote_deleted',
    'quote_sent',
    'quote_client_replied',
    'quote_status_changed',
    'invoice_created',
    'invoice_payment_received',
    'invoice_payment_updated',
    'invoice_payment_deleted',
    'invoice_reminder_sent',
    'invoice_reminder_failed',
    'invoice_reminder_skipped',
    'invoice_reminder_paused',
    'invoice_reminder_resumed',
    'invoice_formal_notice_sent',
    'invoice_recurrence_created',
    'invoice_recurrence_stopped',
    'invoice_recurrence_generated',
    'invoice_recurrence_due',
  ]),
  entityType: z.enum(['client', 'supplier', 'note', 'product', 'quote', 'invoice', 'reminder', 'recurrence']),
  entityName: z.string().trim().min(1, i18nKey('validation.entityNameRequired')),
  entityId: objectIdSchema,
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  isRead: z.boolean().optional(),
  readAt: z.string().datetime().nullable().optional(),
});

export const updateActivitySchema = z.object({
  action: createActivitySchema.shape.action.optional(),
  entityType: createActivitySchema.shape.entityType.optional(),
  entityName: createActivitySchema.shape.entityName.optional(),
  entityId: objectIdSchema,
  metadata: createActivitySchema.shape.metadata,
  isRead: z.boolean().optional(),
  readAt: z.string().datetime().nullable().optional(),
});

export type CreateActivityDTO = z.infer<typeof createActivitySchema>;
export type UpdateActivityDTO = z.infer<typeof updateActivitySchema>;
