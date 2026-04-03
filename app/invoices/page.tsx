'use client';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';

export default function InvoicesPage() {
  const { locale } = useLocale();
  const t = {
    en: {
      title: 'Invoices',
      heading: 'Invoices',
      description: 'Open the invoice workspace to prepare billing and track payment status.',
    },
    fr: {
      title: 'Factures',
      heading: 'Factures',
      description: 'Ouvrez l espace factures pour preparer la facturation et suivre les paiements.',
    },
  }[locale];

  return (
    <CrmShell title={t.title}>
      <section>
        <h1 className="text-2xl font-semibold">{t.heading}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
      </section>
    </CrmShell>
  );
}
