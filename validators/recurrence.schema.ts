import { z } from 'zod';

const isoDateStringSchema = z.string().datetime();

export const recurrenceFrequencySchema = z.enum(['monthly', 'quarterly', 'yearly', 'custom']);

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
    endDate: isoDateStringSchema.optional(),
    nextOccurrenceAt: isoDateStringSchema.optional(),
    autoGenerate: z.boolean().optional().default(false),
    autoSend: z.boolean().optional().default(false),
    template: recurrenceTemplateSchema.optional().nullable(),
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
