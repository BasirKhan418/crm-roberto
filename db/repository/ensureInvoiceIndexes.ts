import Invoice from '@/db/models/Invoice';

let ensurePromise: Promise<void> | null = null;

// Ensures stale indexes (like legacy global unique invoiceNumber) are replaced once per process.
export async function ensureInvoiceIndexes(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await Invoice.syncIndexes();
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  await ensurePromise;
}
