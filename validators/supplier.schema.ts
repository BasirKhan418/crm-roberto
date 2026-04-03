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

export const createSupplierSchema = z.object({
  fullName: z.string().trim().min(1, i18nKey('validation.supplierNameRequired')),
  email: optionalEmail,
  phone: optionalText,
  address: optionalText,
  companyName: optionalText,
  vatNumber: optionalText,
});

export const updateSupplierSchema = z.object({
  fullName: z.string().trim().min(1, i18nKey('validation.supplierNameRequired')).optional(),
  email: updatableOptionalEmail,
  phone: updatableOptionalText,
  address: updatableOptionalText,
  companyName: updatableOptionalText,
  vatNumber: updatableOptionalText,
});

export type CreateSupplierDTO = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierDTO = z.infer<typeof updateSupplierSchema>;
