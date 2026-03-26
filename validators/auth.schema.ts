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