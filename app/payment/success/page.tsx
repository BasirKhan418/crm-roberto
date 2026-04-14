import Link from 'next/link';

export default function PaymentSuccessPage() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Payment received</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your payment was submitted successfully. The invoice status will update automatically.
      </p>
      <div className="mt-4">
        <Link href="/invoices" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Back to invoices
        </Link>
      </div>
    </main>
  );
}
