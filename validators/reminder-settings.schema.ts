import { z } from 'zod';

const nonNegativeNumber = z.number().min(0);

const templateContentSchema = z.object({
  subject: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(4000).optional(),
});

const localeTemplatesPatchSchema = z
  .object({
    soft: templateContentSchema.optional(),
    medium: templateContentSchema.optional(),
    firm: templateContentSchema.optional(),
    formalNotice: templateContentSchema.optional(),
  })
  .partial();

const templatesPatchSchema = z
  .object({
    en: localeTemplatesPatchSchema.optional(),
    fr: localeTemplatesPatchSchema.optional(),
  })
  .partial();

const reminderOffsetsBaseSchema = z.object({
  soft: z.number().positive(),
  medium: z.number().positive(),
  firm: z.number().positive(),
  formalNotice: z.number().positive(),
});

export const reminderOffsetsSchema = reminderOffsetsBaseSchema
  .refine((data) => data.soft < data.medium, {
    message: 'Soft offset must be less than medium offset',
    path: ['soft'],
  })
  .refine((data) => data.medium < data.firm, {
    message: 'Medium offset must be less than firm offset',
    path: ['medium'],
  })
  .refine((data) => data.formalNotice >= data.firm, {
    message: 'Formal notice offset must be greater than or equal to firm offset',
    path: ['formalNotice'],
  });

export const reminderLateFeeSchema = z.object({
  enabled: z.boolean().optional(),
  type: z.enum(['fixed', 'percentage']).optional(),
  value: nonNegativeNumber.optional(),
  applyFrom: z.enum(['medium', 'firm', 'formalNotice']).optional(),
});

const emptyStringToNull = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export const reminderLegalNoticeSchema = z.object({
  delayDays: z.union([z.literal(8), z.literal(15)]).optional(),
  includeInterestClause: z.boolean().optional(),
  customFooter: z.preprocess(emptyStringToNull, z.string().max(4000).nullable().optional()),
});

export const reminderChannelsSchema = z.object({
  email: z
    .object({
      enabled: z.boolean().optional(),
    })
    .optional(),
  whatsapp: z
    .object({
      enabled: z.boolean().optional(),
      provider: z.preprocess(emptyStringToNull, z.string().max(100).nullable().optional()),
    })
    .optional(),
});

export const updateReminderSettingsSchema = z
  .object({
    offsets: reminderOffsetsBaseSchema.partial().optional(),
    templates: templatesPatchSchema.optional(),
    lateFee: reminderLateFeeSchema.optional(),
    legalNotice: reminderLegalNoticeSchema.optional(),
    channels: reminderChannelsSchema.optional(),
  })
  .refine(
    (data) =>
      data.offsets !== undefined ||
      data.templates !== undefined ||
      data.lateFee !== undefined ||
      data.legalNotice !== undefined ||
      data.channels !== undefined,
    {
      message: 'At least one settings section must be provided',
      path: ['general'],
    }
  );

export const resetReminderSettingsSchema = z.object({
  section: z.enum(['offsets', 'templates', 'lateFee', 'legalNotice']),
});

export type UpdateReminderSettingsDTO = z.infer<typeof updateReminderSettingsSchema>;
export type ResetReminderSettingsDTO = z.infer<typeof resetReminderSettingsSchema>;
