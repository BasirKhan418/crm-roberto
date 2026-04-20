import { z } from 'zod';

const isoDateStringSchema = z.string().datetime();

export const recurrenceFrequencySchema = z.enum(['monthly', 'quarterly', 'yearly', 'custom']);

export const upsertRecurrenceSchema = z
  .object({
    frequency: recurrenceFrequencySchema,
    customIntervalDays: z.coerce.number().int().min(1).optional(),
    endDate: isoDateStringSchema.optional(),
    nextOccurrenceAt: isoDateStringSchema.optional(),
    autoGenerate: z.boolean().optional().default(false),
    autoSend: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.frequency === 'custom' && (data.customIntervalDays === undefined || data.customIntervalDays < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customIntervalDays'],
        message: 'customIntervalDays is required and must be at least 1 when frequency is custom',
      });
    }

    if (data.frequency !== 'custom' && data.customIntervalDays !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customIntervalDays'],
        message: 'customIntervalDays is only allowed when frequency is custom',
      });
    }
  });

export const stopRecurrenceSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type UpsertRecurrenceDTO = z.infer<typeof upsertRecurrenceSchema>;
export type StopRecurrenceDTO = z.infer<typeof stopRecurrenceSchema>;
