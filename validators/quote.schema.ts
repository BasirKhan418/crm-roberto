import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const emptyToUndefined = (val: unknown) =>
  typeof val === 'string' && val.trim() === '' ? undefined : val;

const emptyToNull = (val: unknown) =>
  typeof val === 'string' && val.trim() === '' ? null : val;

const toNumber = (val: unknown) => {
  if (typeof val === 'number') {
    return val;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : val;
  }

  return val;
};

const lineItemSchema = z.object({
  productId: objectIdSchema.optional().nullable(),
  name: z.string().trim().min(1, 'Line item name is required'),
  quantity: z.preprocess(toNumber, z.number().min(1, 'Quantity must be at least 1')),
  unitPriceExcludingTax: z.preprocess(
    toNumber,
    z.number().min(0, 'Unit price excluding tax cannot be negative')
  ),
  vatRate: z.preprocess(
    toNumber,
    z.number().min(0, 'VAT rate cannot be negative').max(100, 'VAT rate cannot exceed 100')
  ),
});

const dateFieldSchema = z.preprocess(emptyToUndefined, z.coerce.date().optional());

export const createQuoteSchema = z.object({
  clientId: objectIdSchema,
  date: dateFieldSchema,
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
  notes: z.preprocess(emptyToNull, z.string().trim().max(2000, 'Notes cannot exceed 2000 characters').nullable().optional()),
});

export const updateQuoteSchema = z
  .object({
    clientId: objectIdSchema.optional(),
    date: dateFieldSchema,
    lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required').optional(),
    notes: z.preprocess(emptyToNull, z.string().trim().max(2000, 'Notes cannot exceed 2000 characters').nullable().optional()),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
  );

const quoteStatusSchema = z.enum(['draft', 'sent', 'accepted', 'refused']);

export const updateQuoteStatusSchema = z
  .object({
    to: quoteStatusSchema.optional(),
    status: quoteStatusSchema.optional(),
  })
  .refine((data) => Boolean(data.to || data.status), {
    message: 'Status is required',
    path: ['to'],
  })
  .transform((data) => ({
    to: data.to ?? data.status!,
  }));

export type CreateQuoteDTO = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteDTO = z.infer<typeof updateQuoteSchema>;
export type UpdateQuoteStatusDTO = z.infer<typeof updateQuoteStatusSchema>;
