import { z } from 'zod';

import { createI18nKey as i18nKey } from '@/lib/i18n/messages';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, i18nKey('validation.invalidId'));

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
  productImageUrl: z.preprocess(
    emptyToNull,
    z.string().trim().url(i18nKey('validation.lineItemImageUrlInvalid')).nullable().optional()
  ),
  name: z.string().trim().min(1, i18nKey('validation.lineItemNameRequired')),
  quantity: z.preprocess(toNumber, z.number().min(1, i18nKey('validation.quantityMin'))),
  baseUnitPriceExcludingTax: z.preprocess(
    toNumber,
    z.number().min(0, i18nKey('validation.baseUnitPriceNonNegative')).optional()
  ),
  unitPriceExcludingTax: z.preprocess(
    toNumber,
    z.number().min(0, i18nKey('validation.unitPriceNonNegative'))
  ),
  discountPercentage: z.preprocess(
    toNumber,
    z.number().min(0, i18nKey('validation.discountNonNegative')).max(100, i18nKey('validation.discountMax')).optional()
  ),
  vatRate: z.preprocess(
    toNumber,
    z.number().min(0, i18nKey('validation.vatRateNonNegative')).max(100, i18nKey('validation.vatRateMax'))
  ),
}).transform((item) => ({
  ...item,
  // Ensure baseUnitPriceExcludingTax is always a positive number — fall back to unitPrice
  baseUnitPriceExcludingTax:
    typeof item.baseUnitPriceExcludingTax === 'number' && item.baseUnitPriceExcludingTax > 0
      ? item.baseUnitPriceExcludingTax
      : item.unitPriceExcludingTax,
  // Ensure discountPercentage is always a number
  discountPercentage:
    typeof item.discountPercentage === 'number' && item.discountPercentage >= 0
      ? item.discountPercentage
      : 0,
}));

const dateFieldSchema = z.preprocess(emptyToUndefined, z.coerce.date().optional());

export const createQuoteSchema = z.object({
  clientId: objectIdSchema,
  date: dateFieldSchema,
  subject: z.preprocess(emptyToNull, z.string().trim().max(200, 'Subject cannot exceed 200 characters').nullable().optional()),
  lineItems: z.array(lineItemSchema).min(1, i18nKey('validation.lineItemsRequired')),
  notes: z.preprocess(emptyToNull, z.string().trim().max(2000, i18nKey('validation.notesMax2000')).nullable().optional()),
  paymentTerms: z.preprocess(emptyToNull, z.string().trim().max(500, i18nKey('validation.paymentTermsMax500')).nullable().optional()),
  validityDays: z.preprocess(toNumber, z.number().min(1, i18nKey('validation.validityMin')).max(365).optional()),
});

export const updateQuoteSchema = z
  .object({
    clientId: objectIdSchema.optional(),
    date: dateFieldSchema,
    subject: z.preprocess(emptyToNull, z.string().trim().max(200, 'Subject cannot exceed 200 characters').nullable().optional()),
    lineItems: z.array(lineItemSchema).min(1, i18nKey('validation.lineItemsRequired')).optional(),
    notes: z.preprocess(emptyToNull, z.string().trim().max(2000, i18nKey('validation.notesMax2000')).nullable().optional()),
    paymentTerms: z.preprocess(emptyToNull, z.string().trim().max(500, i18nKey('validation.paymentTermsMax500')).nullable().optional()),
    validityDays: z.preprocess(toNumber, z.number().min(1, i18nKey('validation.validityMin')).max(365).optional()),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: i18nKey('validation.updateAtLeastOneField') }
  );

const quoteStatusSchema = z.enum(['draft', 'sent', 'accepted', 'refused', 'rejected']);

export const updateQuoteStatusSchema = z
  .object({
    to: quoteStatusSchema.optional(),
    status: quoteStatusSchema.optional(),
  })
  .refine((data) => Boolean(data.to || data.status), {
    message: i18nKey('validation.statusRequired'),
    path: ['to'],
  })
  .transform((data) => ({
    to: data.to ?? data.status!,
  }));

export type CreateQuoteDTO = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteDTO = z.infer<typeof updateQuoteSchema>;
export type UpdateQuoteStatusDTO = z.infer<typeof updateQuoteStatusSchema>;
