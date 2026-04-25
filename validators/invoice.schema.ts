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

const legalRecoveryCourtLocationSchema = z.enum(['luxembourg', 'esch_sur_alzette', 'diekirch']).nullable();

export const updateInvoiceSchema = z.object({
  subject: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
  dueDate: z
    .preprocess(emptyToUndefined, z.coerce.date().optional())
    .refine((value) => value === undefined || value >= getTodayStart(), {
      message: 'Due date cannot be earlier than today',
    }),
  legalRecoveryCourtLocation: z.preprocess(emptyToNull, legalRecoveryCourtLocationSchema.optional()),
}).refine(
  (value) =>
    value.subject !== undefined ||
    value.notes !== undefined ||
    value.dueDate !== undefined ||
    value.legalRecoveryCourtLocation !== undefined,
  {
    message: 'At least one field must be provided for update',
    path: ['general'],
  }
);


export type UpdateInvoiceDTO = z.infer<typeof updateInvoiceSchema>;
