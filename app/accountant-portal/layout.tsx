import { AccountantPortalShell } from '@/components/accountant-portal/accountant-portal-shell';
import getAccountantSession from '@/utils/middlewares/accountantSession';

export const dynamic = 'force-dynamic';

export default async function AccountantPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getAccountantSession();

  return (
    <AccountantPortalShell featureFlags={session.success && session.user ? session.user.featureFlags : undefined}>
      {children}
    </AccountantPortalShell>
  );
}