'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import CrmShell from '@/components/crm-shell';
import InvoiceForm from '@/components/invoices/InvoiceForm';
import { useLocale } from '@/components/providers/locale-provider';

function NewInvoicePageContent() {
  const { locale } = useLocale();
  const shellTitle = locale === 'fr' ? 'Nouvelle facture' : 'New Invoice';
  const searchParams = useSearchParams();

  const defaultClientId = searchParams.get('clientId') ?? undefined;
  const defaultQuoteId = searchParams.get('quoteId') ?? undefined;
  const defaultDueDate = searchParams.get('dueDate') ?? undefined;

  return (
    <CrmShell title={shellTitle}>
      <div data-tour-invoice-form>
        <InvoiceForm defaultClientId={defaultClientId} defaultQuoteId={defaultQuoteId} defaultDueDate={defaultDueDate} />
      </div>
    </CrmShell>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}>
      <NewInvoicePageContent />
    </Suspense>
  );
}
