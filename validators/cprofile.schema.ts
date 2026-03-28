import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid user ID");

const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^(\+352[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{0,3}|\+33[\s.-]?\d[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}|0\d[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}|\d{6,12})$/,
    "Invalid phone number. Accepted formats: +352 XXX XXX (Luxembourg), +33 X XX XX XX XX (France), or local number"
  );

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