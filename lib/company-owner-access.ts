import { resolveCompanyOwnerUserId } from "@/db/repository/company-owner";
import { requireModulePermission } from "@/lib/role-matrix";

/**
 * Resolves the company owner's user ID (the key for company-level records such as the
 * company profile, Stripe Connect account and reminder settings) and whether `user` may
 * change those records. The owner always can; anyone else needs edit rights on the
 * "settings" module (administrators by default, or as configured in the role matrix).
 */
export async function getCompanyOwnerAccess(user: {
  id: string;
  role?: string | null;
  companyId?: string | null;
}) {
  const ownerUserId = await resolveCompanyOwnerUserId({ userId: user.id, companyId: user.companyId });

  if (ownerUserId === user.id) {
    return { ownerUserId, canManageCompany: true };
  }

  const permission = await requireModulePermission({
    companyId: user.companyId,
    role: user.role,
    moduleKey: "settings",
    action: "edit",
  });

  return { ownerUserId, canManageCompany: permission.success };
}

export const COMPANY_ADMIN_ONLY_MESSAGE = "Only company administrators can change company settings";
