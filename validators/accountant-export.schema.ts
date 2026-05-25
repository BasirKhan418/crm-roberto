import { z } from "zod";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const accountantExportFormatSchema = z.enum(["csv", "xlsx"]);
export const accountantExportTypeSchema = z.enum(["all", "purchase", "sale"]);

export const accountantExportQuerySchema = z.object({
  format: accountantExportFormatSchema.optional(),
  type: accountantExportTypeSchema.optional(),
  status: z.string().trim().max(40).optional(),
  categoryId: z.string().trim().regex(objectIdPattern, "Invalid category id").optional(),
});

export const accountantAttachmentZipSchema = z.object({
  expenseIds: z.array(z.string().trim().regex(objectIdPattern, "Invalid expense id")).min(1).max(50),
});

export type AccountantExportQueryDTO = z.infer<typeof accountantExportQuerySchema>;
export type AccountantAttachmentZipDTO = z.infer<typeof accountantAttachmentZipSchema>;