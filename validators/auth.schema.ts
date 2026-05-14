import { z } from "zod";

import { createI18nKey as i18nKey } from '@/lib/i18n/messages';

// Common Schemas
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email(i18nKey('validation.invalidEmailAddress'));

const passwordSchema = z
  .string()
  .min(8, i18nKey('validation.passwordMin8'));

// Signup Schema
export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, i18nKey('validation.nameRequired')),

  email: emailSchema,

  password: passwordSchema,
});

export const createWorkspaceSchema = z
  .object({
    companyName: z.string().trim().min(1, i18nKey('validation.companyNameRequired')),
    name: z.string().trim().min(1, i18nKey('validation.nameRequired')),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, i18nKey('validation.confirmPasswordRequired')),
    bootstrapCode: z.string().trim().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: i18nKey('validation.passwordsDoNotMatch'),
  });

// Login Schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, i18nKey('validation.passwordRequired')),
});

// Authenticated Change Password Schema
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, i18nKey('validation.currentPasswordRequired')),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, i18nKey('validation.confirmPasswordRequired')),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: i18nKey('validation.passwordsDoNotMatch'),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ["newPassword"],
    message: i18nKey('validation.newPasswordMustDiffer'),
  });