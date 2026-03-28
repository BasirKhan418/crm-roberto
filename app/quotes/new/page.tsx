'use client';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import QuoteForm from '@/components/quotes/QuoteForm';

export default function NewQuotePage() {
  const { locale } = useLocale();
  const shellTitle = locale === 'fr' ? 'Nouveau devis' : 'New Quote';

  return (
    <CrmShell title={shellTitle}>
      <QuoteForm mode="create" />
    </CrmShell>
  );
}
