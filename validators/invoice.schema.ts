import { z } from 'zod';

const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

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

function getTodayStart(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

const legalRecoveryCourtLocationSchema = z.enum(['luxembourg', 'esch_sur_alzette', 'diekirch']).nullable();

const invoiceLineItemSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product id').nullable().optional(),
  productImageUrl: z.preprocess(emptyToNull, z.string().trim().url().nullable().optional()),
  name: z.string().trim().min(1),
  quantity: z.preprocess(toNumber, z.number().min(1)),
  unitPriceExcludingTax: z.preprocess(toNumber, z.number().min(0)),
  baseUnitPriceExcludingTax: z.preprocess(toNumber, z.number().min(0).optional()),
  discountPercentage: z.preprocess(toNumber, z.number().min(0).max(100).optional()),
  vatRate: z.preprocess(toNumber, z.number().min(0).max(100)),
});

export const updateInvoiceSchema = z.object({
  subject: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
  lineItems: z.array(invoiceLineItemSchema).min(1).optional(),
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
    value.lineItems !== undefined ||
    value.dueDate !== undefined ||
    value.legalRecoveryCourtLocation !== undefined,
  {
    message: 'At least one field must be provided for update',
    path: ['general'],
  }
);


export type UpdateInvoiceDTO = z.infer<typeof updateInvoiceSchema>;
