import { z } from "zod";

import { createI18nKey as i18nKey } from "@/lib/i18n/messages";
import { APP_ROLES } from "@/lib/permissions";

const allowedInvitableRoles = APP_ROLES.filter((role) => role !== "super_admin");

export const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(i18nKey("validation.invalidEmailAddress")),
  name: z.string().trim().min(1, i18nKey("validation.nameRequired")).optional(),
  role: z.enum(allowedInvitableRoles as [string, ...string[]], {
    message: i18nKey("validation.invalidRole"),
  }),
});

export const acceptInvitationSchema = z
  .object({
    token: z.string().trim().min(20, i18nKey("validation.invalidInvitationToken")),
    name: z.string().trim().min(1, i18nKey("validation.nameRequired")).optional(),
    password: z.string().min(8, i18nKey("validation.passwordMin8")),
    confirmPassword: z.string().min(1, i18nKey("validation.confirmPasswordRequired")),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: i18nKey("validation.passwordsDoNotMatch"),
    path: ["confirmPassword"],
  });

export const invitationLookupSchema = z.object({
  token: z.string().trim().min(20, i18nKey("validation.invalidInvitationToken")),
});

export const updateCompanyUserSchema = z.object({
  userId: z.string().trim().min(1, i18nKey("validation.invalidUserId")),
  role: z
    .enum(allowedInvitableRoles as [string, ...string[]], {
      message: i18nKey("validation.invalidRole"),
    })
    .optional(),
  account_status: z.enum(["active", "suspended"]).optional(),
  revokeAccess: z.boolean().optional(),
}).refine(
  (value) =>
    value.role !== undefined ||
    value.account_status !== undefined ||
    value.revokeAccess !== undefined,
  {
    message: "At least one user update action is required",
    path: ["userId"],
  }
);
