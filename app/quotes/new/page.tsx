'use client';

import { useSearchParams } from 'next/navigation';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import QuoteForm from '@/components/quotes/QuoteForm';

export default function NewQuotePage() {
  const { locale } = useLocale();
  const shellTitle = locale === 'fr' ? 'Nouveau devis' : 'New Quote';
  const searchParams = useSearchParams();
  const defaultClientId = searchParams.get('clientId') ?? undefined;

  return (
    <CrmShell title={shellTitle}>
      <QuoteForm mode="create" defaultClientId={defaultClientId} />
    </CrmShell>
  );
}
