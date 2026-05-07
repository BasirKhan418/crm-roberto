'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import LineItemsBuilder from '@/components/quotes/LineItemsBuilder';
import QuoteTotals from '@/components/quotes/QuoteTotals';
import type { QuoteLineItem } from '@/components/quotes/LineItemRow';
import { formatInvoiceDisplayNumber } from '@/lib/i18n/messages';
import { computeQuoteLine } from '@/lib/quote-calculations';
import { Button } from '@/components/ui/button';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PriceDisplay } from '@/components/ui/PriceDisplay';

type InvoiceStatus = 'unpaid' | 'partial_paid' | 'paid' | 'overdue';

interface InvoiceEditData {
  _id: string;
  invoiceNumber: string;
  quoteId?: string | null;
  date: string;
  dueDate?: string | null;
  sentAt?: string | null;
  subject?: string | null;
  notes?: string | null;
  status: InvoiceStatus;
  lineItems: Array<{
    _id?: string;
    lineType?: 'catalog' | 'custom' | 'free_text' | 'item';
    name: string;
    quantity: number;
    unitPriceExcludingTax: number;
    baseUnitPriceExcludingTax: number;
    discountPercentage: number;
    vatRate: number;
    totalExcludingTaxBeforeDiscount: number;
    discountAmountExcludingTax: number;
    totalExcludingTax: number;
    vatAmount: number;
    totalIncludingTax: number;
  }>;
}

interface InvoiceApiResponse {
  success: boolean;
  message?: string;
  data?: InvoiceEditData;
}

function getTodayDateInputValue(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
      subject: 'Object',
      subjectPlaceholder: 'Website creation, POS installation, Maintenance...',
      dueDateRequired: 'Due date is mandatory',
      dueDateMin: 'Due date cannot be earlier than today',
      lineItems: 'Line items',
      no: '#',
      description: 'Description',
      qty: 'Qty',
      unitExcl: 'Unit excl.',
      discount: 'Discount %',
      vatRate: 'VAT %',
      lineTotal: 'Total',
      notes: 'Notes',
      notesPlaceholder: 'Add payment or legal notes...',
      save: 'Save changes',
      saving: 'Saving...',
      saved: 'Invoice updated successfully',
      loadFailed: 'Failed to load invoice',
      updateFailed: 'Failed to update invoice',
      locked: 'Only unsent manual invoices can be edited',
      readOnlyInfo: 'This invoice is read-only because it was created from a quote or has already been sent.',
    },
    fr: {
      shellTitle: 'Modifier la facture',
      title: 'Modifier la facture',
      subtitle: "Mettez \u00e0 jour les champs disponibles via l'API facture.",
      back: 'Retour \u00e0 la facture',
      invoiceNumber: 'Num\u00e9ro de facture',
      date: 'Date',
      dueDate: '\u00c9ch\u00e9ance',
      subject: 'Objet',
      subjectPlaceholder: 'Creation de site web, installation POS, maintenance...',
      dueDateRequired: "L'\u00e9ch\u00e9ance est obligatoire",
      dueDateMin: "L'\u00e9ch\u00e9ance ne peut pas être antérieure à aujourd'hui",
      lineItems: 'Lignes',
      no: '#',
      description: 'Description',
      qty: 'Qte',
      unitExcl: 'Unitaire HT',
      discount: 'Remise %',
      vatRate: 'TVA %',
      lineTotal: 'Total',
      notes: 'Notes',
      notesPlaceholder: 'Ajoutez des notes de paiement ou l\u00e9gales...',
      save: 'Enregistrer',
      saving: 'Enregistrement...',
      saved: 'Facture mise \u00e0 jour avec succ\u00e8s',
      loadFailed: 'Impossible de charger la facture',
      updateFailed: 'Impossible de mettre \u00e0 jour la facture',
      locked: 'Seules les factures manuelles non envoyees peuvent etre modifiees',
      readOnlyInfo: 'Cette facture est en lecture seule car elle provient d\'un devis ou a deja ete envoyee.',
    },
  }[locale as 'en' | 'fr'];

  const [invoice, setInvoice] = useState<InvoiceEditData | null>(null);
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueDateError, setDueDateError] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const todayDateInputValue = getTodayDateInputValue();

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

        if (!cancelled) {
          setInvoice(payload.data);
          setSubject(payload.data.subject ?? '');
          setDueDate(payload.data.dueDate ? new Date(payload.data.dueDate).toISOString().slice(0, 10) : '');
          setLineItems(
            payload.data.lineItems.map((item) => ({
              lineType: item.lineType ?? 'custom',
              productId: null,
              productImageUrl: null,
              name: item.name,
              quantity: item.quantity,
              baseUnitPriceExcludingTax: item.baseUnitPriceExcludingTax,
              unitPriceExcludingTax: item.unitPriceExcludingTax,
              discountPercentage: item.discountPercentage,
              vatRate: item.vatRate,
            }))
          );
          setNotes(payload.data.notes ?? '');
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
  }, [params?.id, t.loadFailed]);

  async function handleSave() {
    if (!invoice || saving) {
      return;
    }

    if (!dueDate) {
      const message = t.dueDateRequired;
      setDueDateError(message);
      toast.error(message);
      return;
    }

    if (dueDate < todayDateInputValue) {
      const message = t.dueDateMin;
      setDueDateError(message);
      toast.error(message);
      return;
    }

    if (lineItems.length === 0 || lineItems.some((line) => !line.name.trim())) {
      toast.error(locale === 'fr' ? 'Chaque ligne doit avoir une description' : 'Each line item must have a description');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/invoices/${invoice._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim() || null,
          dueDate,
          lineItems,
          notes: notes.trim() || null,
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

  const isEditable = Boolean(invoice && !invoice.quoteId && !invoice.sentAt);
  const lineComputed = (invoice?.lineItems ?? []).map((item) =>
    computeQuoteLine({
      quantity: item.quantity,
      unitPriceExcludingTax: item.unitPriceExcludingTax,
      baseUnitPriceExcludingTax: item.baseUnitPriceExcludingTax,
      discountPercentage: item.discountPercentage,
      vatRate: item.vatRate,
    })
  );

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
            {!isEditable ? (
              <div className="mb-4 rounded-lg border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
                {t.readOnlyInfo}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invoice-number">{t.invoiceNumber}</Label>
                <Input id="invoice-number" value={formatInvoiceDisplayNumber(locale as 'en' | 'fr', invoice.invoiceNumber)} readOnly className="bg-muted/40" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoice-date">{t.date}</Label>
                <Input id="invoice-date" type="date" value={new Date(invoice.date).toISOString().slice(0, 10)} readOnly className="bg-muted/40" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="invoice-subject">{t.subject}</Label>
                <Input
                  id="invoice-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder={t.subjectPlaceholder}
                  disabled={!isEditable}
                  className={!isEditable ? 'bg-muted/40' : undefined}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoice-due-date">{t.dueDate}</Label>
                <Input
                  id="invoice-due-date"
                  type="date"
                  min={todayDateInputValue}
                  value={dueDate}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setDueDate(nextValue);
                    if (!nextValue) {
                      setDueDateError(null);
                      return;
                    }
                    setDueDateError(nextValue < todayDateInputValue ? t.dueDateMin : null);
                  }}
                  aria-invalid={Boolean(dueDateError)}
                  disabled={!isEditable}
                  className={!isEditable ? 'bg-muted/40' : undefined}
                />
                {dueDateError ? <p className="text-xs text-destructive">{dueDateError}</p> : null}
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
                disabled={!isEditable}
              />
            </div>

            <section className="mt-4 overflow-hidden rounded-xl border border-border/70 bg-background p-4">
              <h2 className="mb-3 font-heading text-base font-semibold">{t.lineItems}</h2>
              {isEditable ? (
                <>
                  <LineItemsBuilder mode="invoice" lineItems={lineItems} onChange={setLineItems} />
                  <div className="mt-4">
                    <QuoteTotals lineItems={lineItems} />
                  </div>
                </>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-secondary/30 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">{t.no}</th>
                        <th className="px-3 py-2 text-left font-medium">{t.description}</th>
                        <th className="px-3 py-2 text-right font-medium">{t.qty}</th>
                        <th className="px-3 py-2 text-right font-medium">{t.unitExcl}</th>
                        <th className="px-3 py-2 text-right font-medium">{t.discount}</th>
                        <th className="px-3 py-2 text-right font-medium">{t.vatRate}</th>
                        <th className="px-3 py-2 text-right font-medium">{t.lineTotal}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.lineItems.map((item, index) => {
                        if (item.lineType === 'free_text') {
                          return (
                            <tr key={item._id || `free-text-${index}`} className="border-t border-border/60 bg-secondary/10">
                              <td className="px-3 py-3 font-medium text-muted-foreground" colSpan={7}>
                                {item.name}
                              </td>
                            </tr>
                          );
                        }

                        const computed = lineComputed[index] ?? null;

                        return (
                          <tr key={item._id || `${item.name}-${index}`} className="border-t border-border/60 odd:bg-background even:bg-secondary/10">
                            <td className="px-3 py-2">{index + 1}</td>
                            <td className="px-3 py-2 font-medium">{item.name}</td>
                            <td className="px-3 py-2 text-right">{item.quantity}</td>
                            <td className="px-3 py-2 text-right"><PriceDisplay cents={computed?.baseUnitPriceExcludingTax ?? item.baseUnitPriceExcludingTax} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} /></td>
                            <td className="px-3 py-2 text-right">{Number(computed?.discountPercentage ?? item.discountPercentage).toFixed(2)}%</td>
                            <td className="px-3 py-2 text-right">{item.vatRate}%</td>
                            <td className="px-3 py-2 text-right font-semibold"><PriceDisplay cents={computed?.totalExcludingTax ?? item.totalExcludingTax} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="mt-4">
              <Button type="button" className="h-10" onClick={handleSave} disabled={saving || !dueDate || !isEditable}>
                {saving ? t.saving : t.save}
              </Button>
              {!isEditable ? <p className="mt-2 text-xs text-muted-foreground">{t.locked}</p> : null}
            </div>
          </section>
        </section>
      ) : null}
    </CrmShell>
  );
}
