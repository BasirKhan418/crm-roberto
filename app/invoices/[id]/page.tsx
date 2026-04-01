import CrmShell from '@/components/crm-shell';

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { id } = await params;

  return (
    <CrmShell title="Invoice Detail">
      <section>
        <h1 className="text-2xl font-semibold">Invoice Detail</h1>
        <p className="mt-2 text-sm text-muted-foreground">Invoice ID: {id}</p>
      </section>
    </CrmShell>
  );
}
