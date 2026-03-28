import { z } from 'zod';

const emptyToUndefined = (val: unknown) =>
  typeof val === 'string' && val.trim() === '' ? undefined : val;

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());

const optionalEmail = z.preprocess(emptyToUndefined, z.string().trim().toLowerCase().email('Invalid email address').optional());

export const createSupplierSchema = z.object({
  fullName: z.string().trim().min(1, 'Supplier name is required'),
  email: optionalEmail,
  phone: optionalText,
  address: optionalText,
  companyName: optionalText,
  vatNumber: optionalText,
});

export const updateSupplierSchema = createSupplierSchema.partial();

export type CreateSupplierDTO = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierDTO = z.infer<typeof updateSupplierSchema>;
