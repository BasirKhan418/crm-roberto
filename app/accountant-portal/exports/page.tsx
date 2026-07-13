'use client';

import { AccountingExportsPage } from '@/components/accounting-exports/accounting-exports-page';

export default function AccountantPortalExportsPage() {
  return (
    <AccountingExportsPage
      sessionEndpoint="/api/accountant/auth/me"
      lookupsEndpoint="/api/accountant/lookups"
      downloadBasePath="/api/accountant/exports"
    />
  );
}