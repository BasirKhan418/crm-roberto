'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type InvoiceStatus = 'unpaid' | 'deposit_paid' | 'initial_paid' | 'paid' | 'overdue';

interface InvoiceEditData {
  _id: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string | null;
  notes?: string | null;
  depositPercentage?: number;
  status: InvoiceStatus;
}

interface InvoiceApiResponse {
  success: boolean;
  message?: string;
  data?: InvoiceEditData;
}

export default function EditInvoicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { locale } = useLocale();

  const t = {
    en: {
      shellTitle: 'Edit Invoice',
      title: 'Edit invoice',
      subtitle: 'Update invoice details available from the invoice API.',
      back: 'Back to invoice',
      invoiceNumber: 'Invoice number',
      date: 'Date',
      dueDate: 'Due date',
      depositPercentage: 'Deposit percentage',
      notes: 'Notes',
      notesPlaceholder: 'Add payment or legal notes...',
      save: 'Save changes',
      saving: 'Saving...',
      saved: 'Invoice updated successfully',
      loadFailed: 'Failed to load invoice',
      updateFailed: 'Failed to update invoice',
      locked: 'Only unpaid invoices can be edited',
    },
    fr: {
      shellTitle: 'Modifier la facture',
      title: 'Modifier la facture',
      subtitle: "Mettez \u00e0 jour les champs disponibles via l'API facture.",
      back: 'Retour \u00e0 la facture',
      invoiceNumber: 'Num\u00e9ro de facture',
      date: 'Date',
      dueDate: '\u00c9ch\u00e9ance',
      depositPercentage: "Pourcentage d'acompte",
      notes: 'Notes',
      notesPlaceholder: 'Ajoutez des notes de paiement ou l\u00e9gales...',
      save: 'Enregistrer',
      saving: 'Enregistrement...',
      saved: 'Facture mise \u00e0 jour avec succ\u00e8s',
      loadFailed: 'Impossible de charger la facture',
      updateFailed: 'Impossible de mettre \u00e0 jour la facture',
      locked: 'Seules les factures impay\u00e9es peuvent \u00eatre modifi\u00e9es',
    },
  }[locale as 'en' | 'fr'];

  const [invoice, setInvoice] = useState<InvoiceEditData | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [depositPercentage, setDepositPercentage] = useState('100');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) {
      return;
    }

    let cancelled = false;

    async function loadInvoice() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/invoices/${params.id}`, { cache: 'no-store' });
        const payload = (await response.json()) as InvoiceApiResponse;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.message || t.loadFailed);
        }

        if (payload.data.status !== 'unpaid') {
          throw new Error(t.locked);
        }

        if (!cancelled) {
          setInvoice(payload.data);
          setDueDate(payload.data.dueDate ? new Date(payload.data.dueDate).toISOString().slice(0, 10) : '');
          setNotes(payload.data.notes ?? '');
          setDepositPercentage(String(payload.data.depositPercentage ?? 100));
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : t.loadFailed);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInvoice();

    return () => {
      cancelled = true;
    };
  }, [params?.id, t.loadFailed, t.locked]);

  async function handleSave() {
    if (!invoice || saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const parsedDeposit = Number(depositPercentage);
      const normalizedDeposit = Number.isFinite(parsedDeposit)
        ? Math.max(0, Math.min(100, Math.round(parsedDeposit)))
        : 100;

      const response = await fetch(`/api/invoices/${invoice._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dueDate: dueDate || null,
          notes: notes.trim() || null,
          depositPercentage: normalizedDeposit,
        }),
      });

      const payload = (await response.json()) as InvoiceApiResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t.updateFailed);
      }

      toast.success(t.saved);
      router.push(`/invoices/${invoice._id}`);
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : t.updateFailed;
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <CrmShell title={t.shellTitle}>
      {loading ? (
        <div className="space-y-2">
          <div className="h-8 w-52 animate-pulse rounded bg-muted" />
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : null}

      {!loading && error ? <ErrorMessage message={error} /> : null}

      {!loading && !error && invoice ? (
        <section className="space-y-4">
          <header className="rounded-xl border border-border/70 bg-linear-to-b from-background to-secondary/30 p-4 sm:p-5">
            <button
              type="button"
              className="mb-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => router.push(`/invoices/${invoice._id}`)}
            >
              {t.back}
            </button>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{t.title}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </header>

          <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invoice-number">{t.invoiceNumber}</Label>
                <Input id="invoice-number" value={invoice.invoiceNumber} readOnly className="bg-muted/40" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoice-date">{t.date}</Label>
                <Input id="invoice-date" type="date" value={new Date(invoice.date).toISOString().slice(0, 10)} readOnly className="bg-muted/40" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoice-due-date">{t.dueDate}</Label>
                <Input id="invoice-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoice-deposit">{t.depositPercentage}</Label>
                <Input
                  id="invoice-deposit"
                  type="number"
                  min={0}
                  max={100}
                  value={depositPercentage}
                  onChange={(event) => setDepositPercentage(event.target.value)}
                  onBlur={() => {
                    const parsed = Number(depositPercentage);
                    const normalized = Number.isFinite(parsed)
                      ? Math.max(0, Math.min(100, Math.round(parsed)))
                      : 100;
                    setDepositPercentage(String(normalized));
                  }}
                />
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              <Label htmlFor="invoice-notes">{t.notes}</Label>
              <textarea
                id="invoice-notes"
                className="mt-1 min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder={t.notesPlaceholder}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>

            <div className="mt-4">
              <Button type="button" className="h-10" onClick={handleSave} disabled={saving}>
                {saving ? t.saving : t.save}
              </Button>
            </div>
          </section>
        </section>
      ) : null}
    </CrmShell>
  );
}
