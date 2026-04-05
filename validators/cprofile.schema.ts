import { z } from "zod";

import { createI18nKey as i18nKey } from '@/lib/i18n/messages';

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, i18nKey('validation.invalidUserId'));

const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^(\+352[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{0,3}|\+33[\s.-]?\d[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}|0\d[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}|\d{6,12})$/,
    i18nKey('validation.invalidPhone')
  );

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email(i18nKey('validation.invalidBusinessEmail'));

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

  address: z
    .string()
    .trim()
    .min(1, i18nKey('validation.addressRequired')),

  vatNumber: z
    .string()
    .trim()
    .min(1, i18nKey('validation.vatNumberRequired')),
});

export const createCompanyProfileSchema = z.object({
  user: objectIdSchema,
}).merge(companyProfileFieldsSchema);

export const createCompanyProfileInputSchema = companyProfileFieldsSchema;

export const updateCompanyProfileSchema = companyProfileFieldsSchema
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