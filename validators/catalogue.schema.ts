import { z } from 'zod';

import { createI18nKey as i18nKey } from '@/lib/i18n/messages';

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

const createOptionalDescription = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).max(1000, i18nKey('validation.descriptionMax1000')).optional()
);

const updateOptionalDescription = z.preprocess(
  emptyToNull,
  z.string().trim().min(1).max(1000, i18nKey('validation.descriptionMax1000')).nullable().optional()
);

const createOptionalString = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());
const updateOptionalNullableString = z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional());

const createOptionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().trim().url(i18nKey('validation.attachmentUrlInvalid')).optional()
);
const updateOptionalNullableUrl = z.preprocess(
  emptyToNull,
  z.string().trim().url(i18nKey('validation.attachmentUrlInvalid')).nullable().optional()
);

const currencySchema = z.enum(['EUR']);

export const createCatalogueItemSchema = z.object({
  name: z.string().trim().min(1, i18nKey('validation.itemNameRequired')).max(200, i18nKey('validation.nameMax200')),
  description: createOptionalDescription,
  priceExcludingTax: z.preprocess(
    toNumber,
    z.number().min(0, i18nKey('validation.priceExcludingTaxNonNegative'))
  ),
  vatRate: z
    .preprocess(
      toNumber,
      z.number().min(0, i18nKey('validation.vatRateNonNegative')).max(100, i18nKey('validation.vatRateMax'))
    )
    .default(17),
  currency: currencySchema.default('EUR'),
  attachmentUrl: createOptionalUrl,
  attachmentKey: createOptionalString,
  attachmentMimeType: createOptionalString,
  attachmentName: createOptionalString,
  type: z.enum(['product', 'service']),
});

export const updateCatalogueItemSchema = z.object({
  name: z.string().trim().min(1, i18nKey('validation.itemNameRequired')).max(200, i18nKey('validation.nameMax200')).optional(),
  description: updateOptionalDescription,
  priceExcludingTax: z
    .preprocess(
      toNumber,
      z.number().min(0, i18nKey('validation.priceExcludingTaxNonNegative'))
    )
    .optional(),
  vatRate: z
    .preprocess(
      toNumber,
      z.number().min(0, i18nKey('validation.vatRateNonNegative')).max(100, i18nKey('validation.vatRateMax'))
    )
    .optional(),
  currency: currencySchema.optional(),
  attachmentUrl: updateOptionalNullableUrl,
  attachmentKey: updateOptionalNullableString,
  attachmentMimeType: updateOptionalNullableString,
  attachmentName: updateOptionalNullableString,
  type: z.enum(['product', 'service']).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: i18nKey('validation.updateAtLeastOneField'),
});

export type CreateCatalogueItemDTO = z.infer<typeof createCatalogueItemSchema>;
export type UpdateCatalogueItemDTO = z.infer<typeof updateCatalogueItemSchema>;
