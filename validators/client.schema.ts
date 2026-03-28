import { z } from 'zod';

const emptyToUndefined = (val: unknown) =>
  typeof val === 'string' && val.trim() === '' ? undefined : val;

const emptyToNull = (val: unknown) =>
  typeof val === 'string' && val.trim() === '' ? null : val;

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());

const optionalEmail = z.preprocess(emptyToUndefined, z.string().trim().toLowerCase().email('Invalid email address').optional());

const updatableOptionalText = z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional());

const updatableOptionalEmail = z.preprocess(
  emptyToNull,
  z.string().trim().toLowerCase().email('Invalid email address').nullable().optional()
);

export const createClientSchema = z.object({
  fullName: z.string().trim().min(1, 'Client name is required'),
  email: optionalEmail,
  phone: optionalText,
  address: optionalText,
  companyName: optionalText,
  vatNumber: optionalText,
});

export const updateClientSchema = z.object({
  fullName: z.string().trim().min(1, 'Client name is required').optional(),
  email: updatableOptionalEmail,
  phone: updatableOptionalText,
  address: updatableOptionalText,
  companyName: updatableOptionalText,
  vatNumber: updatableOptionalText,
});

export type CreateClientDTO = z.infer<typeof createClientSchema>;
export type UpdateClientDTO = z.infer<typeof updateClientSchema>;
