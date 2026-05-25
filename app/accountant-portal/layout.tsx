'use client';

import { AccountantPortalShell } from '@/components/accountant-portal/accountant-portal-shell';

export default function AccountantPortalLayout({ children }: { children: React.ReactNode }) {
  return <AccountantPortalShell>{children}</AccountantPortalShell>;
}