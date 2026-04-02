'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import QuoteForm from '@/components/quotes/QuoteForm';

function NewQuotePageContent() {
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

export default function NewQuotePage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}>
      <NewQuotePageContent />
    </Suspense>
  );
}
