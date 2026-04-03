import { z } from 'zod';

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

const toNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
};

export const updateInvoiceSchema = z.object({
  notes: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
  dueDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  depositPercentage: z.preprocess(toNumber, z.number().min(0).max(100).optional()),
});

export type UpdateInvoiceDTO = z.infer<typeof updateInvoiceSchema>;
