import { z } from 'zod';

import { createI18nKey as i18nKey } from '@/lib/i18n/messages';
import { getRecurrenceScheduleValidationKey } from '@/lib/recurrence/validation';

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const recurrenceFrequencySchema = z.enum(['monthly', 'quarterly', 'yearly', 'custom']);

const recurrenceDateFieldSchema = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());

const recurrenceTemplateLineItemSchema = z.object({
  productId: z.string().trim().optional().nullable(),
  productImageUrl: z.string().trim().optional().nullable(),
  name: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1),
  baseUnitPriceExcludingTax: z.coerce.number().min(0),
  unitPriceExcludingTax: z.coerce.number().min(0),
  discountPercentage: z.coerce.number().min(0).max(100),
  vatRate: z.coerce.number().min(0).max(100),
  totalExcludingTaxBeforeDiscount: z.coerce.number().min(0).optional(),
  discountAmountExcludingTax: z.coerce.number().min(0).optional(),
  totalExcludingTax: z.coerce.number().min(0),
  vatAmount: z.coerce.number().min(0).optional(),
  totalIncludingTax: z.coerce.number().min(0).optional(),
});

export const recurrenceTemplateSchema = z.object({
  lineItems: z.array(recurrenceTemplateLineItemSchema).min(1),
  totalExcludingTax: z.coerce.number().min(0),
  totalVat: z.coerce.number().min(0),
  totalIncludingTax: z.coerce.number().min(0),
  depositPercentage: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const upsertRecurrenceSchema = z
  .object({
    frequency: recurrenceFrequencySchema,
    customIntervalDays: z.coerce.number().int().min(1).optional(),
    endDate: recurrenceDateFieldSchema,
    nextOccurrenceAt: recurrenceDateFieldSchema,
    autoGenerate: z.boolean().optional().default(false),
    autoSend: z.boolean().optional().default(false),
    template: recurrenceTemplateSchema.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const scheduleValidationKey = getRecurrenceScheduleValidationKey({
      nextOccurrenceAt: data.nextOccurrenceAt,
      endDate: data.endDate,
    });

    if (scheduleValidationKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [scheduleValidationKey.includes('EndDate') ? 'endDate' : 'nextOccurrenceAt'],
        message: i18nKey(scheduleValidationKey),
      });
    }

    if (data.frequency === 'custom' && (data.customIntervalDays === undefined || data.customIntervalDays < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customIntervalDays'],
        message: i18nKey('validation.recurrenceCustomIntervalRequired'),
      });
    }

    if (data.frequency !== 'custom' && data.customIntervalDays !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customIntervalDays'],
        message: i18nKey('validation.recurrenceCustomIntervalOnlyForCustom'),
      });
    }
  });

export const stopRecurrenceSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type UpsertRecurrenceDTO = z.infer<typeof upsertRecurrenceSchema>;
export type StopRecurrenceDTO = z.infer<typeof stopRecurrenceSchema>;
