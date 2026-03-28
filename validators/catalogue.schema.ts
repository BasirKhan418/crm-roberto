import { z } from 'zod';

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
  z.string().trim().min(1).max(1000, 'Description cannot exceed 1000 characters').optional()
);

const updateOptionalDescription = z.preprocess(
  emptyToNull,
  z.string().trim().min(1).max(1000, 'Description cannot exceed 1000 characters').nullable().optional()
);

export const createCatalogueItemSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(200, 'Name cannot exceed 200 characters'),
  description: createOptionalDescription,
  priceExcludingTax: z.preprocess(
    toNumber,
    z.number().min(0, 'Price excluding tax cannot be negative')
  ),
  vatRate: z
    .preprocess(
      toNumber,
      z.number().min(0, 'VAT rate cannot be negative').max(100, 'VAT rate cannot exceed 100')
    )
    .default(17),
  type: z.enum(['product', 'service']),
});

export const updateCatalogueItemSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(200, 'Name cannot exceed 200 characters').optional(),
  description: updateOptionalDescription,
  priceExcludingTax: z
    .preprocess(
      toNumber,
      z.number().min(0, 'Price excluding tax cannot be negative')
    )
    .optional(),
  vatRate: z
    .preprocess(
      toNumber,
      z.number().min(0, 'VAT rate cannot be negative').max(100, 'VAT rate cannot exceed 100')
    )
    .optional(),
  type: z.enum(['product', 'service']).optional(),
});

export type CreateCatalogueItemDTO = z.infer<typeof createCatalogueItemSchema>;
export type UpdateCatalogueItemDTO = z.infer<typeof updateCatalogueItemSchema>;
