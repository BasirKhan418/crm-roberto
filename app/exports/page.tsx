'use client';

import { useEffect } from 'react';
import { Loader2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { AccountingExportsPage } from '@/components/accounting-exports/accounting-exports-page';
import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import { useAuthMe } from '@/hooks/useAuthMe';
import { canAccessCrmPath, getDefaultCrmLandingPath } from '@/lib/route-access';

const shellCopy = {
  en: {
    title: 'Accounting exports',
  },
  fr: {
    title: 'Exports comptables',
  },
} as const;

export default function CompanyExportsPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const { user, loading } = useAuthMe();
  const t = shellCopy[locale];
  const canViewExports = canAccessCrmPath('/exports', user?.role, user?.modulePermissions, user?.featureFlags);

  useEffect(() => {
    if (loading || canViewExports) {
      return;
    }

    router.replace(getDefaultCrmLandingPath(user?.role, user?.modulePermissions, user?.featureFlags));
  }, [canViewExports, loading, router, user?.featureFlags, user?.modulePermissions, user?.role]);

  if (loading || !canViewExports) {
    return (
      <CrmShell title={t.title}>
        <div className="flex min-h-52 items-center justify-center">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      </CrmShell>
    );
  }

  return (
    <CrmShell title={t.title}>
      <AccountingExportsPage
        sessionEndpoint="/api/me"
        lookupsEndpoint="/api/exports/lookups"
        downloadBasePath="/api/exports"
      />
    </CrmShell>
  );
}