import CrmShell from '@/components/crm-shell';

export default function QuotesPage() {
  return (
    <CrmShell title="Quotes">
      <section className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Quotes</h1>
        <p className="text-sm text-muted-foreground">Quotes list shell. Search, filters, statuses, and actions will be added in Sprint 3.</p>
      </section>
    </CrmShell>
  );
}
