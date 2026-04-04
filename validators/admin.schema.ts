import { z } from "zod";
import { createI18nKey as i18nKey } from "@/lib/i18n/messages";

export const updateAccountStatusSchema = z.object({
  userId: z.string().min(1, i18nKey("validation.invalidUserId")),
  account_status: z.enum(["active", "suspended"], {
    message: i18nKey("validation.invalidStatusValue"),
  }),
});
