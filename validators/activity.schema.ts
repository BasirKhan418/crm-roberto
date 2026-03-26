import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid entityId').optional();

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
  ]),
  entityType: z.enum(['client', 'supplier', 'note']),
  entityName: z.string().trim().min(1, 'entityName is required'),
  entityId: objectIdSchema,
});

export const updateActivitySchema = z.object({
  action: createActivitySchema.shape.action.optional(),
  entityType: createActivitySchema.shape.entityType.optional(),
  entityName: createActivitySchema.shape.entityName.optional(),
  entityId: objectIdSchema,
});

export type CreateActivityDTO = z.infer<typeof createActivitySchema>;
export type UpdateActivityDTO = z.infer<typeof updateActivitySchema>;
