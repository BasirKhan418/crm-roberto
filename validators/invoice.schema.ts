import { z } from 'zod';

const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

export const updateInvoiceSchema = z.object({
  notes: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
  dueDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
});

export type UpdateInvoiceDTO = z.infer<typeof updateInvoiceSchema>;
