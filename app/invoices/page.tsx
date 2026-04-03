'use client';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';

export default function InvoicesPage() {
  const { locale } = useLocale();
  const t = {
    en: {
      title: 'Invoices',
      heading: 'Invoices',
      description: 'Phase 3 invoice list page shell.',
    },
    fr: {
      title: 'Factures',
      heading: 'Factures',
      description: 'Coque de la page liste des factures pour la phase 3.',
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
