import { z } from 'zod';

export const sendReminderBodySchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().max(4000).optional(),
  locale: z.enum(['en', 'fr']).optional(),
});

export const logsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SendReminderBodyDTO = z.infer<typeof sendReminderBodySchema>;
