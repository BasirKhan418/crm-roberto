import { z } from 'zod';

const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

function getTodayStart(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export const updateInvoiceSchema = z.object({
  notes: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
  dueDate: z.preprocess(emptyToUndefined, z.coerce.date()).refine((value) => value >= getTodayStart(), {
    message: 'Due date cannot be earlier than today',
  }),
});

export type UpdateInvoiceDTO = z.infer<typeof updateInvoiceSchema>;
