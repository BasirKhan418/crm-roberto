import { z } from "zod";

import { createI18nKey as i18nKey } from '@/lib/i18n/messages';

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, i18nKey('validation.invalidUserId'));

const phoneSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) {
      return false;
    }

    const allowedPattern = /^(?:\+|00)?[0-9][0-9\s().-]*$/;
    if (!allowedPattern.test(value)) {
      return false;
    }

    const digitsOnly = value.replace(/\D/g, '');
    return digitsOnly.length >= 6 && digitsOnly.length <= 15;
  }, i18nKey('validation.invalidPhone'));

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email(i18nKey('validation.invalidBusinessEmail'));

const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional()
);

const updatableOptionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().min(1).nullable().optional()
);

const companyProfileFieldsSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, i18nKey('validation.companyNameRequired')),

  ownerName: z
    .string()
    .trim()
    .min(1, i18nKey('validation.ownerNameRequired')),

  phone: phoneSchema,

  businessEmail: emailSchema,

  streetNumber: optionalText,
  streetName: optionalText,
  postalCode: optionalText,
  city: optionalText,
  country: optionalText,

  vatNumber: z
    .string()
    .trim()
    .min(1, i18nKey('validation.vatNumberRequired')),

  rcsNumber: optionalText,
  businessAuthorizationNumber: optionalText,
  matriculeNumber: optionalText,
  iban: optionalText,
  bankName: optionalText,
  legalIdentifier: optionalText,
});

export const createCompanyProfileSchema = z.object({
  user: objectIdSchema,
}).merge(companyProfileFieldsSchema);

export const createCompanyProfileInputSchema = companyProfileFieldsSchema;

export const updateCompanyProfileSchema = companyProfileFieldsSchema
  .extend({
    rcsNumber: updatableOptionalText,
    businessAuthorizationNumber: updatableOptionalText,
    matriculeNumber: updatableOptionalText,
    iban: updatableOptionalText,
    bankName: updatableOptionalText,
    legalIdentifier: updatableOptionalText,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: i18nKey('validation.updateAtLeastOneField'),
  });


export type CreateCompanyProfileDTO = z.infer<
  typeof createCompanyProfileSchema
>;

export type CreateCompanyProfileInputDTO = z.infer<
  typeof createCompanyProfileInputSchema
>;

export type UpdateCompanyProfileDTO = z.infer<
  typeof updateCompanyProfileSchema
>;