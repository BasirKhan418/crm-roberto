import { z } from 'zod';

import { createI18nKey as i18nKey } from '@/lib/i18n/messages';

const emptyToUndefined = (val: unknown) =>
  typeof val === 'string' && val.trim() === '' ? undefined : val;

const emptyToNull = (val: unknown) =>
  typeof val === 'string' && val.trim() === '' ? null : val;

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().trim().toLowerCase().email(i18nKey('validation.invalidEmailAddress')).optional()
);

const updatableOptionalText = z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional());

const updatableOptionalEmail = z.preprocess(
  emptyToNull,
  z.string().trim().toLowerCase().email(i18nKey('validation.invalidEmailAddress')).nullable().optional()
);

const supplierCategorySchema = z.enum(['materials', 'logistics', 'services', 'technology', 'other']);

export const createSupplierSchema = z.object({
  fullName: z.string().trim().min(1, i18nKey('validation.supplierNameRequired')),
  category: supplierCategorySchema.optional().default('other'),
  email: optionalEmail,
  phone: optionalText,
  address: optionalText,
  companyName: optionalText,
  vatNumber: optionalText,
});

export const updateSupplierSchema = z.object({
  fullName: z.string().trim().min(1, i18nKey('validation.supplierNameRequired')).optional(),
  category: supplierCategorySchema.optional(),
  email: updatableOptionalEmail,
  phone: updatableOptionalText,
  address: updatableOptionalText,
  companyName: updatableOptionalText,
  vatNumber: updatableOptionalText,
}).refine((data) => Object.keys(data).length > 0, {
  message: i18nKey('validation.updateAtLeastOneField'),
});

export type CreateSupplierDTO = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierDTO = z.infer<typeof updateSupplierSchema>;
