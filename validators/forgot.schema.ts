import {z} from "zod";

import { createI18nKey as i18nKey } from '@/lib/i18n/messages';

export const forgotPasswordSchema = z.object({
  email: z.string().email(i18nKey('validation.enterValidBusinessEmail')),
  status: z.enum(["forgot","verify","reset"], {
    message: i18nKey('validation.invalidStatusValue')
  }).optional(),
  otp: z.string().min(6, i18nKey('validation.otpMin6')).optional(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(i18nKey('validation.enterValidBusinessEmail')),
  password: z.string().min(8, i18nKey('validation.passwordMin8')),
  token: z.string().min(1, i18nKey('validation.tokenRequired')),
});