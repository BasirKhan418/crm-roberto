import Invoice from '@/db/models/Invoice';
import { formatCanonicalInvoiceNumber, parseInvoiceNumber } from '@/lib/invoice-number';

let ensurePromise: Promise<void> | null = null;

type InvoiceNumberRow = {
  _id: unknown;
  userId: unknown;
  invoiceNumber?: string | null;
  invoiceNumberYear?: number | null;
  invoiceNumberSequence?: number | null;
  createdAt?: Date | null;
};

function sortRowsByCreatedAtThenId(a: InvoiceNumberRow, b: InvoiceNumberRow): number {
  const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  if (aTime !== bTime) {
    return aTime - bTime;
  }

  return String(a._id).localeCompare(String(b._id));
}

async function normalizeExistingInvoiceNumbers(): Promise<void> {
  const rows = await Invoice.find({})
    .select('_id userId invoiceNumber invoiceNumberYear invoiceNumberSequence createdAt')
    .lean<InvoiceNumberRow[]>();

  if (rows.length === 0) {
    return;
  }

  const usedSequencesByUserYear = new Map<string, Set<number>>();
  const groups = new Map<string, InvoiceNumberRow[]>();

  for (const row of rows) {
    const parsed = parseInvoiceNumber(row.invoiceNumber ?? null);
    if (!parsed) {
      continue;
    }

    const userId = String(row.userId);
    const userYearKey = `${userId}|${parsed.year}`;
    const groupKey = `${userYearKey}|${parsed.sequence}`;

    if (!usedSequencesByUserYear.has(userYearKey)) {
      usedSequencesByUserYear.set(userYearKey, new Set<number>());
    }
    usedSequencesByUserYear.get(userYearKey)?.add(parsed.sequence);

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)?.push(row);
  }

  const operations: Array<{ updateOne: { filter: { _id: unknown }; update: { $set: Record<string, unknown> } } }> = [];

  for (const [groupKey, groupRows] of groups) {
    const [userId, yearRaw, sequenceRaw] = groupKey.split('|');
    const year = Number.parseInt(yearRaw, 10);
    const sequence = Number.parseInt(sequenceRaw, 10);
    if (!Number.isFinite(year) || !Number.isFinite(sequence) || sequence <= 0) {
      continue;
    }

    const sorted = [...groupRows].sort(sortRowsByCreatedAtThenId);
    const userYearKey = `${userId}|${year}`;
    const used = usedSequencesByUserYear.get(userYearKey) ?? new Set<number>();
    usedSequencesByUserYear.set(userYearKey, used);

    for (let index = 0; index < sorted.length; index += 1) {
      const row = sorted[index];
      let targetSequence = sequence;

      if (index > 0) {
        targetSequence = sequence;
        while (used.has(targetSequence)) {
          targetSequence += 1;
        }
        used.add(targetSequence);
      }

      const targetInvoiceNumber = formatCanonicalInvoiceNumber(year, targetSequence);
      const needsUpdate =
        row.invoiceNumber !== targetInvoiceNumber ||
        row.invoiceNumberYear !== year ||
        row.invoiceNumberSequence !== targetSequence;

      if (!needsUpdate) {
        continue;
      }

      operations.push({
        updateOne: {
          filter: { _id: row._id },
          update: {
            $set: {
              invoiceNumber: targetInvoiceNumber,
              invoiceNumberYear: year,
              invoiceNumberSequence: targetSequence,
            },
          },
        },
      });
    }
  }

  if (operations.length > 0) {
    await Invoice.bulkWrite(operations, { ordered: false });
  }
}

// Ensures stale indexes (like legacy global unique invoiceNumber) are replaced once per process.
export async function ensureInvoiceIndexes(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await normalizeExistingInvoiceNumbers();
      await Invoice.syncIndexes();
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  await ensurePromise;
}
