import { z } from 'zod';

const emptyToUndefined = (val: unknown) =>
  typeof val === 'string' && val.trim() === '' ? undefined : val;

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid linkedId');

const followUpDateSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'followUpDate must be ISO date or yyyy-mm-dd'))
  .optional();

export const createNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().min(1, 'Description is required'),
  linkedType: z.enum(['client', 'supplier']),
  linkedId: objectIdSchema,
  followUpDate: followUpDateSchema,
});

export const updateNoteSchema = z
  .object({
    title: z.preprocess(emptyToUndefined, z.string().trim().min(1, 'Title is required').optional()),
    description: z.preprocess(emptyToUndefined, z.string().trim().min(1, 'Description is required').optional()),
    linkedType: z.enum(['client', 'supplier']).optional(),
    linkedId: objectIdSchema.optional(),
    followUpDate: z.preprocess(
      (val) => (val === '' ? undefined : val),
      followUpDateSchema.or(z.null()).optional()
    ),
  })
  .refine(
    (data) => {
      if (data.linkedType && !data.linkedId) {
        return false;
      }
      if (data.linkedId && !data.linkedType) {
        return false;
      }
      return true;
    },
    { message: 'linkedType and linkedId must be provided together when changing relation' }
  );

export type CreateNoteDTO = z.infer<typeof createNoteSchema>;
export type UpdateNoteDTO = z.infer<typeof updateNoteSchema>;
