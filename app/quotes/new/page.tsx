import CrmShell from '@/components/crm-shell';

export default function NewQuotePage() {
  return (
    <CrmShell title="New Quote">
      <section className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Create Quote</h1>
        <p className="text-sm text-muted-foreground">Dedicated new quote form route shell. Builder UI will be implemented in Sprint 4.</p>
      </section>
    </CrmShell>
  );
}
