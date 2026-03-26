import { z } from "zod";

// Common Schemas
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email address");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

// Signup Schema
export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required"),

  email: emailSchema,

  password: passwordSchema,
});

// Login Schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

// Authenticated Change Password Schema
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ["newPassword"],
    message: "New password must be different from current password",
  });