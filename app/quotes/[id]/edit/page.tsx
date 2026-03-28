import CrmShell from '@/components/crm-shell';

interface EditQuotePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditQuotePage({ params }: EditQuotePageProps) {
  const { id } = await params;

  return (
    <CrmShell title="Edit Quote">
      <section className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit Quote</h1>
        <p className="text-sm text-muted-foreground">Quote edit shell for ID: {id}. Full editable form will be added in Sprint 4.</p>
      </section>
    </CrmShell>
  );
}
