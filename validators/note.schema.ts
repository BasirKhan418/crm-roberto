import { z } from 'zod';

import { createI18nKey as i18nKey } from '@/lib/i18n/messages';

const emptyToUndefined = (val: unknown) =>
  typeof val === 'string' && val.trim() === '' ? undefined : val;

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, i18nKey('validation.invalidLinkedId'));

const followUpDateValueSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, i18nKey('validation.followUpDateFormat')));

const requiredFollowUpDateSchema = z
  .preprocess(emptyToUndefined, followUpDateValueSchema.optional())
  .refine((value) => typeof value === 'string', { message: i18nKey('validation.followUpDateRequired') });

export const createNoteSchema = z.object({
  title: z.string().trim().min(1, i18nKey('validation.titleRequired')),
  description: z.string().trim().min(1, i18nKey('validation.descriptionRequired')),
  linkedType: z.enum(['client', 'supplier']),
  linkedId: objectIdSchema,
  followUpDate: requiredFollowUpDateSchema,
});

export const updateNoteSchema = z
  .object({
    title: z.preprocess(emptyToUndefined, z.string().trim().min(1, i18nKey('validation.titleRequired')).optional()),
    description: z.preprocess(emptyToUndefined, z.string().trim().min(1, i18nKey('validation.descriptionRequired')).optional()),
    linkedType: z.enum(['client', 'supplier']).optional(),
    linkedId: objectIdSchema.optional(),
    followUpDate: z.union([z.null(), followUpDateValueSchema]).optional(),
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
    { message: i18nKey('validation.linkedRelationPairRequired') }
  );

export type CreateNoteDTO = z.infer<typeof createNoteSchema>;
export type UpdateNoteDTO = z.infer<typeof updateNoteSchema>;
