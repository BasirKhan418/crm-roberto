'use client';

import { useParams } from 'next/navigation';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';

export default function InvoiceDetailPage() {
  const { locale } = useLocale();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const t = {
    en: {
      title: 'Invoice Detail',
      heading: 'Invoice Detail',
      invoiceId: 'Invoice ID',
    },
    fr: {
      title: 'Detail de la facture',
      heading: 'Detail de la facture',
      invoiceId: 'ID de facture',
    },
  }[locale];

  return (
    <CrmShell title={t.title}>
      <section>
        <h1 className="text-2xl font-semibold">{t.heading}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.invoiceId}: {id}</p>
      </section>
    </CrmShell>
  );
}
