import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid user ID");

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Invalid phone number"); // India-focused

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid business email");


export const createCompanyProfileSchema = z.object({
  user: objectIdSchema,

  companyName: z
    .string()
    .trim()
    .min(1, "Company name is required"),

  ownerName: z
    .string()
    .trim()
    .min(1, "Owner name is required"),

  phone: phoneSchema,

  businessEmail: emailSchema,

  address: z
    .string()
    .trim()
    .min(1, "Address is required"),

  vatNumber: z
    .string()
    .trim()
    .min(1, "VAT number is required"),
});


export const updateCompanyProfileSchema = createCompanyProfileSchema.partial();


export type CreateCompanyProfileDTO = z.infer<
  typeof createCompanyProfileSchema
>;

export type UpdateCompanyProfileDTO = z.infer<
  typeof updateCompanyProfileSchema
>;