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

export const clientTypeSchema = z.enum(['company', 'individual']);

const addressCreateSchema = z
  .object({
    street: optionalText,
    postalCode: optionalText,
    city: optionalText,
    country: optionalText,
  })
  .optional();

const addressUpdateSchema = z
  .object({
    street: updatableOptionalText,
    postalCode: updatableOptionalText,
    city: updatableOptionalText,
    country: updatableOptionalText,
  })
  .optional();

export const createClientSchema = z.object({
  clientType: clientTypeSchema,
  fullName: z.string().trim().min(1, i18nKey('validation.clientNameRequired')).optional(),
  email: optionalEmail,
  phone: optionalText,
  address: optionalText,
  companyName: optionalText,
  vatNumber: optionalText,
  rcsNumber: optionalText,
  businessAuthorizationNumber: optionalText,
  matriculeNumber: optionalText,
  title: optionalText,
  firstName: optionalText,
  lastName: optionalText,
  addressDetails: addressCreateSchema,
  bankName: optionalText,
  iban: optionalText,
  responsibleEmail: optionalEmail,
  billingEmail: optionalEmail,
  companyPhone: optionalText,
  privatePhone: optionalText,
  mobilePhone: optionalText,
  additionalDescription: optionalText,
  billingAddress: optionalText,
}).superRefine((value, ctx) => {
  if (value.clientType === 'company' && !value.companyName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['companyName'],
      message: i18nKey('validation.companyNameRequired'),
    });
  }

  if (value.clientType === 'individual') {
    if (!value.firstName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['firstName'],
        message: i18nKey('validation.firstNameRequired'),
      });
    }
    if (!value.lastName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lastName'],
        message: i18nKey('validation.lastNameRequired'),
      });
    }
  }
});

export const updateClientSchema = z.object({
  clientType: clientTypeSchema.optional(),
  fullName: z.string().trim().min(1, i18nKey('validation.clientNameRequired')).optional(),
  email: updatableOptionalEmail,
  phone: updatableOptionalText,
  address: updatableOptionalText,
  companyName: updatableOptionalText,
  vatNumber: updatableOptionalText,
  rcsNumber: updatableOptionalText,
  businessAuthorizationNumber: updatableOptionalText,
  matriculeNumber: updatableOptionalText,
  title: updatableOptionalText,
  firstName: updatableOptionalText,
  lastName: updatableOptionalText,
  addressDetails: addressUpdateSchema,
  bankName: updatableOptionalText,
  iban: updatableOptionalText,
  responsibleEmail: updatableOptionalEmail,
  billingEmail: updatableOptionalEmail,
  companyPhone: updatableOptionalText,
  privatePhone: updatableOptionalText,
  mobilePhone: updatableOptionalText,
  additionalDescription: updatableOptionalText,
  billingAddress: updatableOptionalText,
});

export type CreateClientDTO = z.infer<typeof createClientSchema>;
export type UpdateClientDTO = z.infer<typeof updateClientSchema>;
