import CrmShell from '@/components/crm-shell';

export default function CataloguePage() {
  return (
    <CrmShell title="Products & Services">
      <section className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Products & Services</h1>
        <p className="text-sm text-muted-foreground">Catalogue module shell. List, filters, and CRUD UI will be added in Sprint 2.</p>
      </section>
    </CrmShell>
  );
}
