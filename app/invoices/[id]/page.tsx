interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { id } = await params;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Invoice Detail</h1>
      <p className="mt-2 text-sm text-muted-foreground">Invoice ID: {id}</p>
    </main>
  );
}
