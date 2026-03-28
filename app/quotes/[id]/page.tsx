import CrmShell from '@/components/crm-shell';

interface QuoteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function QuoteDetailPage({ params }: QuoteDetailPageProps) {
  const { id } = await params;

  return (
    <CrmShell title="Quote Detail">
      <section className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Quote Detail</h1>
        <p className="text-sm text-muted-foreground">Quote detail shell for ID: {id}</p>
      </section>
    </CrmShell>
  );
}
