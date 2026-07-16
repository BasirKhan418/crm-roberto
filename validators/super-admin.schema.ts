import { z } from "zod";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const companyFeatureFlagsSchema = z.object({
  expenses: z.boolean(),
  tickets: z.boolean(),
  financialDashboard: z.boolean(),
  accountantPortal: z.boolean(),
  exports: z.boolean(),
  advancedRoles: z.boolean(),
});

export const listCompaniesQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["all", "active", "suspended"]).optional(),
  page: z.coerce.number().int().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const companyIdParamsSchema = z.object({
  id: z.string().trim().regex(objectIdPattern, "Invalid company id"),
});

export const companyDetailQuerySchema = z.object({
  auditPage: z.coerce.number().int().min(1).max(200).optional(),
  auditLimit: z.coerce.number().int().min(1).max(100).optional(),
  connectionPage: z.coerce.number().int().min(1).max(200).optional(),
  connectionLimit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createCompanySchema = z.object({
  name: z.string().trim().min(2).max(140),
  slug: z.string().trim().min(2).max(140).regex(/^[a-z0-9-]+$/, "Slug must use lowercase letters, numbers, and hyphens"),
  ownerUserId: z.string().trim().regex(objectIdPattern, "Invalid owner user id"),
  featureFlags: companyFeatureFlagsSchema.partial().optional(),
});

export const updateCompanyStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
});

export const updateCompanyFeatureFlagsSchema = z.object({
  featureFlags: companyFeatureFlagsSchema,
});

export const connectionLogsQuerySchema = z.object({
  companyId: z.string().trim().regex(objectIdPattern, "Invalid company id").optional(),
  search: z.string().trim().max(120).optional(),
  period: z.enum(["all", "24h", "7d", "30d"]).optional(),
  eventType: z.enum([
    "all",
    "login_success",
    "login_failed",
    "logout",
    "portal_login_success",
    "portal_login_failed",
    "force_logout",
    "revoke_access",
    "impersonation_start",
    "impersonation_stop",
  ]).optional(),
  page: z.coerce.number().int().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const auditLogsQuerySchema = z.object({
  companyId: z.string().trim().regex(objectIdPattern, "Invalid company id").optional(),
  entityType: z.enum(["all", "expense", "invoice", "supplier", "user", "ticket", "report"]).optional(),
  period: z.enum(["all", "24h", "7d", "30d"]).optional(),
  page: z.coerce.number().int().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type CompanyFeatureFlagsDTO = z.infer<typeof companyFeatureFlagsSchema>;