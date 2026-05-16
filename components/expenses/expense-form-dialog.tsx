'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import { CircleHelpIcon, Loader2Icon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ExpenseLookupCategory, ExpenseLookupClient, ExpenseLookupInvoice, ExpenseLookupSupplier } from '@/hooks/useExpenseLookups';
import type { ExpenseDetail } from '@/hooks/useExpenseDetail';
import {
  EXPENSE_PAID_BY,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_STATUS,
  EXPENSE_TYPES,
  EXPENSE_VAT_RATES,
} from '@/lib/expenses/constants';
import {
  getExpensePaidByLabel,
  getExpensePaymentMethodLabel,
  getExpensePaymentStatusLabel,
  getExpenseTypeLabel,
} from '@/lib/expenses/labels';
import { formatInvoiceDisplayNumber } from '@/lib/i18n/messages';

type Mode = 'create' | 'edit';

type SaveTarget = 'default' | 'activate';

type ExpenseLookupSearchResponse = {
  success: boolean;
  message?: string;
  invoices?: ExpenseLookupInvoice[];
};

type ExpenseFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  initialExpense?: ExpenseDetail | null;
  categories: ExpenseLookupCategory[];
  suppliers: ExpenseLookupSupplier[];
  clients: ExpenseLookupClient[];
  invoices: ExpenseLookupInvoice[];
  locale: 'en' | 'fr';
  onCreateSupplier: (payload: { fullName: string }) => Promise<ExpenseLookupSupplier>;
  onSaved: (expense: Record<string, unknown>) => Promise<void> | void;
};

type FormValues = {
  amountExclVat: string;
  vatRate: string;
  expenseDate: string;
  supplierId: string;
  categoryId: string;
  paymentMethod: string;
  paidBy: string;
  paymentStatus: string;
  amountPaid: string;
  paidAt: string;
  dueDate: string;
  supplierRef: string;
  expenseType: string;
  notes: string;
  clientId: string;
  projectId: string;
  invoiceId: string;
};

const DEFAULT_VAT_RATE = '17';
const DEFAULT_DUE_DATE_DELAY_DAYS = 7;

function toInputDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function toInputDateFromDate(value: Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToInputDate(value: string, days: number) {
  if (!value) return '';

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';

  date.setDate(date.getDate() + days);
  return toInputDateFromDate(date);
}

function buildDefaultFormValues(): FormValues {
  const expenseDate = toInputDateFromDate(new Date());

  return {
    amountExclVat: '',
    vatRate: DEFAULT_VAT_RATE,
    expenseDate,
    supplierId: '',
    categoryId: '',
    paymentMethod: '',
    paidBy: '',
    paymentStatus: 'unpaid',
    amountPaid: '',
    paidAt: '',
    dueDate: addDaysToInputDate(expenseDate, DEFAULT_DUE_DATE_DELAY_DAYS),
    supplierRef: '',
    expenseType: 'business',
    notes: '',
    clientId: '',
    projectId: '',
    invoiceId: '',
  };
}

function resolveEntityId(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && '_id' in value) {
    const id = (value as { _id?: unknown })._id;
    return typeof id === 'string' ? id : '';
  }
  return '';
}

function toDecimalFromCents(cents?: number) {
  if (typeof cents !== 'number') return '';
  return (cents / 100).toFixed(2);
}

function toTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}

function formatInvoiceDateLabel(value: string | undefined, locale: 'en' | 'fr') {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatInvoiceAmountLabel(value: number | undefined, locale: 'en' | 'fr') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function buildInvoiceOptionLabel(invoice: ExpenseLookupInvoice, locale: 'en' | 'fr') {
  const rawInvoiceNumber = invoice.invoiceNumber || invoice._id;
  const invoiceNumber = invoice.invoiceNumber
    ? formatInvoiceDisplayNumber(locale, invoice.invoiceNumber)
    : rawInvoiceNumber;
  const clientName = invoice.clientSnapshot?.fullName || invoice.clientSnapshot?.companyName || '-';
  const amount = formatInvoiceAmountLabel(invoice.totalIncludingTax, locale);
  const date = formatInvoiceDateLabel(invoice.date, locale);
  return `${invoiceNumber} - ${clientName} - ${amount} - ${date}`;
}

function buildInvoiceSearchText(invoice: ExpenseLookupInvoice, locale: 'en' | 'fr') {
  const rawInvoiceNumber = invoice.invoiceNumber || invoice._id;
  const displayInvoiceNumber = invoice.invoiceNumber
    ? formatInvoiceDisplayNumber(locale, invoice.invoiceNumber)
    : rawInvoiceNumber;
  const clientName = invoice.clientSnapshot?.fullName || '';
  const companyName = invoice.clientSnapshot?.companyName || '';
  const amountCents = typeof invoice.totalIncludingTax === 'number' ? Math.max(0, Math.round(invoice.totalIncludingTax)) : 0;
  const amountLabel = formatInvoiceAmountLabel(invoice.totalIncludingTax, locale);
  const dateLabel = formatInvoiceDateLabel(invoice.date, locale);

  return `${rawInvoiceNumber} ${displayInvoiceNumber} ${clientName} ${companyName} ${amountLabel} ${(
    amountCents / 100
  ).toFixed(2)} ${Math.round(amountCents / 100)} ${dateLabel}`.toLowerCase();
}

function buildInitialValues(expense?: ExpenseDetail | null): FormValues {
  if (!expense) {
    return buildDefaultFormValues();
  }

  const expenseDate = toInputDate(expense.expenseDate) || toInputDateFromDate(new Date());
  const dueDate = toInputDate(expense.dueDate) || addDaysToInputDate(expenseDate, DEFAULT_DUE_DATE_DELAY_DAYS);

  return {
    ...buildDefaultFormValues(),
    amountExclVat: toDecimalFromCents(expense.amountExclVatCents),
    vatRate: String(typeof expense.vatRate === 'number' ? expense.vatRate : 17),
    expenseDate,
    supplierId: resolveEntityId(expense.supplierId),
    categoryId: resolveEntityId(expense.categoryId),
    paymentMethod: expense.paymentMethod || '',
    paidBy: expense.paidBy || '',
    paymentStatus: expense.paymentStatus || 'unpaid',
    amountPaid: toDecimalFromCents(expense.amountPaidCents),
    paidAt: toInputDate(expense.paidAt),
    dueDate,
    supplierRef: expense.supplierRef || '',
    expenseType: expense.expenseType || 'business',
    notes: expense.notes || '',
    clientId: resolveEntityId(expense.clientId),
    projectId: expense.projectId || '',
    invoiceId: resolveEntityId(expense.invoiceId),
  };
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  mode,
  initialExpense,
  categories,
  suppliers,
  clients,
  invoices,
  locale,
  onCreateSupplier,
  onSaved,
}: ExpenseFormDialogProps) {
  const [values, setValues] = useState<FormValues>(() => buildDefaultFormValues());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [supplierCreating, setSupplierCreating] = useState(false);
  const [inlineSupplierName, setInlineSupplierName] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<SaveTarget>('default');
  const [invoiceSearchInput, setInvoiceSearchInput] = useState('');
  const [debouncedInvoiceSearch, setDebouncedInvoiceSearch] = useState('');
  const [remoteInvoices, setRemoteInvoices] = useState<ExpenseLookupInvoice[]>([]);
  const [invoiceLookupLoading, setInvoiceLookupLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(buildInitialValues(initialExpense));
    setError(null);
    setInlineSupplierName('');
    setConfirmOpen(false);
    setInvoiceSearchInput('');
    setDebouncedInvoiceSearch('');
  }, [initialExpense, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setDebouncedInvoiceSearch(invoiceSearchInput.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [invoiceSearchInput, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const normalizedSearch = debouncedInvoiceSearch.trim();

    if (!normalizedSearch) {
      setRemoteInvoices(invoices);
      setInvoiceLookupLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function fetchInvoiceLookups() {
      setInvoiceLookupLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('search', normalizedSearch);
        params.set('limit', '80');

        const response = await fetch(`/api/expenses/lookups?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => null)) as ExpenseLookupSearchResponse | null;

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || 'Failed to load invoice lookups');
        }

        if (!cancelled) {
          setRemoteInvoices(payload.invoices || []);
        }
      } catch (lookupError) {
        const isAbortError =
          lookupError instanceof Error && lookupError.name === 'AbortError';

        if (!cancelled && !isAbortError) {
          setRemoteInvoices([]);
        }
      } finally {
        if (!cancelled) {
          setInvoiceLookupLoading(false);
        }
      }
    }

    void fetchInvoiceLookups();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedInvoiceSearch, invoices, open]);

  const t = {
    en: {
      createTitle: 'Create Expense',
      editTitle: initialExpense?.status === 'draft' ? 'Edit Draft Expense' : 'Edit Expense',
      description: 'Fill all required fields. Expense validation requires amount, date, category, and supplier.',
      amountExclVat: 'Amount excl. VAT',
      vatRate: 'VAT rate',
      amountInclVatPreview: 'Amount incl. VAT (preview)',
      expenseDate: 'Expense date',
      supplier: 'Supplier',
      category: 'Category',
      paymentMethod: 'Payment method',
      paidBy: 'Paid by',
      paymentStatus: 'Payment status',
      amountPaid: 'Amount already paid',
      amountPaidAutoFilledPaid: 'Amount automatically filled because status = paid.',
      amountPaidLockedHint: 'To modify the paid amount, change the status to Partial or use Add payment.',
      remainingPreview: 'Remaining balance (preview)',
      paidAt: 'Payment date',
      dueDate: 'Due date',
      supplierRef: 'Supplier invoice reference',
      expenseType: 'Expense type',
      notes: 'Internal notes',
      client: 'Linked client',
      project: 'Project',
      invoice: 'Linked invoice',
      financialSection: 'Financial fields',
      relationSection: 'Supplier and links',
      paymentSection: 'Payment tracking',
      paymentEditHint: 'Payments are tracked as immutable lines. Use Add payment or Settle expense actions from the expense list/detail to register new payments.',
      extraSection: 'Classification and notes',
      create: 'Create expense',
      save: 'Save changes',
      saveDraft: 'Save as draft',
      activateDraft: 'Validate expense',
      createSuccess: 'Expense created',
      updateSuccess: 'Expense updated',
      activateSuccess: 'Expense validated',
      cancel: 'Cancel',
      confirmEditTitle: 'Confirm expense update',
      confirmEditDescriptionDefault: 'This will save your edits and update expense history.',
      confirmEditDescriptionActivate: 'This will validate the expense and make it actionable.',
      confirmEditCancel: 'Cancel',
      confirmEditAction: 'Confirm update',
      addSupplier: 'Quick add supplier',
      addSupplierPlaceholder: 'Supplier name',
      createSupplier: 'Add',
      selectPlaceholder: 'Select',
      noneOption: 'None',
      invoiceSearch: 'Search linked invoice',
      invoiceSearchPlaceholder: 'Search by invoice number, client name, or amount...',
      invoiceSearchLoading: 'Searching invoices...',
      invoiceNoResults: 'No invoice matches this search.',
      requiredFieldsError: 'Amount, date, category, and supplier are required to validate the expense.',
      paidByRequiredWithPayment: 'Paid by is required when payment status is Paid or Partial.',
      saveFailed: 'Failed to save expense',
      createSupplierFailed: 'Failed to create supplier',
    },
    fr: {
      createTitle: 'Créer une dépense',
      editTitle: initialExpense?.status === 'draft' ? 'Modifier le brouillon' : 'Modifier la dépense',
      description: 'Renseignez les champs requis. Activation du brouillon : montant, date, catégorie, fournisseur.',
      amountExclVat: 'Montant HT',
      vatRate: 'Taux TVA',
      amountInclVatPreview: 'Montant TTC (aperçu)',
      expenseDate: 'Date de dépense',
      supplier: 'Fournisseur',
      category: 'Catégorie',
      paymentMethod: 'Mode de paiement',
      paidBy: 'Payé par',
      paymentStatus: 'Statut paiement',
      amountPaid: 'Montant déjà payé',
      amountPaidAutoFilledPaid: 'Montant rempli automatiquement car le statut = payé.',
      amountPaidLockedHint: 'Pour modifier le montant payé, passez le statut à Partiel ou utilisez Ajouter un paiement.',
      remainingPreview: 'Reste à payer (aperçu)',
      paidAt: 'Date de paiement',
      dueDate: 'Date limite',
      supplierRef: 'Référence facture fournisseur',
      expenseType: 'Type de dépense',
      notes: 'Notes internes',
      client: 'Client lié',
      project: 'Projet',
      invoice: 'Facture liée',
      financialSection: 'Champs financiers',
      relationSection: 'Fournisseur et liaisons',
      paymentSection: 'Suivi paiement',
      paymentEditHint: 'Les paiements sont enregistrés en lignes immuables. Utilisez Ajouter un paiement ou Solder la dépense depuis la liste/détail pour enregistrer un nouveau paiement.',
      extraSection: 'Classification et notes',
      create: 'Créer la dépense',
      save: 'Enregistrer',
      saveDraft: 'Sauvegarder brouillon',
      activateDraft: 'Valider la dépense',
      createSuccess: 'Dépense créée',
      updateSuccess: 'Dépense mise à jour',
      activateSuccess: 'Dépense validée',
      cancel: 'Annuler',
      confirmEditTitle: 'Confirmer la mise à jour',
      confirmEditDescriptionDefault: "Cette action enregistre vos modifications et met à jour l'historique.",
      confirmEditDescriptionActivate: 'Cette action valide la dépense et la rend exploitable.',
      confirmEditCancel: 'Annuler',
      confirmEditAction: 'Confirmer',
      addSupplier: 'Ajout rapide fournisseur',
      addSupplierPlaceholder: 'Nom du fournisseur',
      createSupplier: 'Ajouter',
      selectPlaceholder: 'Sélectionner',
      noneOption: 'Aucun',
      invoiceSearch: 'Recherche facture liée',
      invoiceSearchPlaceholder: 'Rechercher par numéro, client ou montant...',
      invoiceSearchLoading: 'Recherche des factures...',
      invoiceNoResults: 'Aucune facture ne correspond à cette recherche.',
      requiredFieldsError: 'Montant, date, catégorie et fournisseur requis pour activer le brouillon.',
      paidByRequiredWithPayment: 'Le champ payé par est requis lorsque le statut est Payé ou Partiel.',
      saveFailed: 'Échec enregistrement dépense',
      createSupplierFailed: 'Échec création fournisseur',
    },
  }[locale];

  const amountExclVat = Number(values.amountExclVat || 0);
  const vatRate = Number(values.vatRate || 0);
  const amountInclVat = toTwoDecimals(amountExclVat + amountExclVat * (vatRate / 100));
  const amountPaid = Number(values.amountPaid || 0);
  const amountPaidFromHistory = toTwoDecimals((initialExpense?.amountPaidCents || 0) / 100);

  const computedAmountPaid =
    mode === 'edit'
      ? amountPaidFromHistory
      : values.paymentStatus === 'paid'
        ? amountInclVat
        : values.paymentStatus === 'partial'
          ? amountPaid
          : 0;
  const remaining = toTwoDecimals(Math.max(amountInclVat - computedAmountPaid, 0));

  const invoiceOptions = useMemo(() => {
    const normalizedSearch = debouncedInvoiceSearch.trim().toLowerCase();
    const source = normalizedSearch ? remoteInvoices : invoices;
    const selectedInvoice =
      (values.invoiceId ? invoices.find((invoice) => invoice._id === values.invoiceId) : undefined) ||
      (values.invoiceId ? remoteInvoices.find((invoice) => invoice._id === values.invoiceId) : undefined);

    const byId = new Map<string, ExpenseLookupInvoice>();
    source.forEach((invoice) => {
      byId.set(invoice._id, invoice);
    });

    if (selectedInvoice && !byId.has(selectedInvoice._id)) {
      byId.set(selectedInvoice._id, selectedInvoice);
    }

    const merged = Array.from(byId.values());
    if (!normalizedSearch) {
      return merged;
    }

    return merged.filter((invoice) => buildInvoiceSearchText(invoice, locale).includes(normalizedSearch));
  }, [debouncedInvoiceSearch, invoices, locale, remoteInvoices, values.invoiceId]);

  function updateField<K extends keyof FormValues>(field: K, next: FormValues[K]) {
    setValues((previous) => ({ ...previous, [field]: next }));
  }

  function handleExpenseDateChange(nextDate: string) {
    setValues((previous) => {
      const previousAutoDueDate = addDaysToInputDate(previous.expenseDate, DEFAULT_DUE_DATE_DELAY_DAYS);
      const shouldAutoUpdateDueDate = !previous.dueDate || previous.dueDate === previousAutoDueDate;

      return {
        ...previous,
        expenseDate: nextDate,
        dueDate:
          shouldAutoUpdateDueDate && nextDate
            ? addDaysToInputDate(nextDate, DEFAULT_DUE_DATE_DELAY_DAYS)
            : previous.dueDate,
      };
    });
  }

  function canActivateDraft() {
    return (
      Number(values.amountExclVat || 0) > 0 &&
      Boolean(values.expenseDate) &&
      Boolean(values.categoryId) &&
      Boolean(values.supplierId)
    );
  }

  function requestSubmit(saveTarget: SaveTarget, event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (mode === 'edit') {
      setConfirmTarget(saveTarget);
      setConfirmOpen(true);
      return;
    }

    void submit(saveTarget);
  }

  async function handleCreateSupplier() {
    if (!inlineSupplierName.trim()) return;

    setSupplierCreating(true);
    setError(null);

    try {
      const created = await onCreateSupplier({ fullName: inlineSupplierName.trim() });
      updateField('supplierId', created._id);
      setInlineSupplierName('');
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : t.createSupplierFailed);
    } finally {
      setSupplierCreating(false);
    }
  }

  async function submit(saveTarget: SaveTarget, event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (saveTarget === 'activate' && !canActivateDraft()) {
      setError(t.requiredFieldsError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        amountExclVatCents: Number(values.amountExclVat || 0),
        vatRate: Number(values.vatRate || 0),
        expenseDate: values.expenseDate || undefined,
        supplierId: values.supplierId || undefined,
        categoryId: values.categoryId || undefined,
        dueDate: values.dueDate || undefined,
        supplierRef: values.supplierRef || undefined,
        expenseType: values.expenseType || 'business',
        notes: values.notes || undefined,
        clientId: values.clientId || undefined,
        projectId: values.projectId || undefined,
        invoiceId: values.invoiceId || undefined,
      };

      if (mode === 'create') {
        const hasPaymentStatus = values.paymentStatus === 'paid' || values.paymentStatus === 'partial';
        if (hasPaymentStatus && !values.paidBy) {
          setError(t.paidByRequiredWithPayment);
          setSaving(false);
          return;
        }

        payload.paymentMethod = values.paymentMethod || undefined;
        payload.paidBy = values.paidBy || undefined;
        payload.paymentStatus = values.paymentStatus || undefined;
        payload.amountPaidCents =
          values.paymentStatus === 'unpaid'
            ? 0
            : values.paymentStatus === 'partial' || values.paymentStatus === 'paid'
              ? computedAmountPaid
              : undefined;
        payload.paidAt = values.paidAt || undefined;

        if (values.paymentStatus === 'paid' && !values.paidAt) {
          payload.paidAt = new Date().toISOString().slice(0, 10);
        }
      }

      if (mode === 'edit' && initialExpense?._id) {
        if (saveTarget === 'activate') {
          payload.status = 'active';
        } else if (initialExpense.status === 'draft') {
          payload.status = 'draft';
        }

        const response = await fetch(`/api/expenses/${initialExpense._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = (await response.json().catch(() => null)) as
          | {
              success: boolean;
              message?: string;
              expense?: Record<string, unknown>;
            }
          | null;

        if (!response.ok || !result?.success || !result.expense) {
          throw new Error(result?.message || t.saveFailed);
        }

        await onSaved(result.expense);
        toast.success(saveTarget === 'activate' ? t.activateSuccess : t.updateSuccess);
        onOpenChange(false);
        return;
      }

      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as
        | {
            success: boolean;
            message?: string;
            expense?: Record<string, unknown>;
          }
        | null;

      if (!response.ok || !result?.success || !result.expense) {
        throw new Error(result?.message || t.saveFailed);
      }

      await onSaved(result.expense);
      toast.success(t.createSuccess);
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'create' ? t.createTitle : t.editTitle;
  const selectClassName = 'h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={(event) => requestSubmit('default', event)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">{t.amountInclVatPreview}</p>
              <p className="text-sm font-semibold">{amountInclVat.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">{t.remainingPreview}</p>
              <p className="text-sm font-semibold">{remaining.toFixed(2)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 p-4">
            <div className="mb-3">
              <h4 className="text-sm font-semibold">{t.financialSection}</h4>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label>{t.amountExclVat}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={values.amountExclVat}
                  onChange={(event) => updateField('amountExclVat', event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t.vatRate}</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  list="expense-vat-presets"
                  value={values.vatRate}
                  onChange={(event) => updateField('vatRate', event.target.value)}
                />
                <datalist id="expense-vat-presets">
                  {EXPENSE_VAT_RATES.map((rate) => (
                    <option key={rate} value={String(rate)}>
                      {rate}%
                    </option>
                  ))}
                </datalist>
                <div className="flex flex-wrap gap-1.5">
                  {EXPENSE_VAT_RATES.map((rate) => {
                    const isActive = Number(values.vatRate) === rate;

                    return (
                      <Button
                        key={rate}
                        type="button"
                        size="sm"
                        variant={isActive ? 'default' : 'outline'}
                        className="h-7 px-2 text-xs"
                        onClick={() => updateField('vatRate', String(rate))}
                      >
                        {rate}%
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t.expenseDate}</Label>
                <Input
                  type="date"
                  value={values.expenseDate}
                  onChange={(event) => handleExpenseDateChange(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t.dueDate}</Label>
                <Input
                  type="date"
                  value={values.dueDate}
                  onChange={(event) => updateField('dueDate', event.target.value)}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                <Label>{t.supplierRef}</Label>
                <Input
                  value={values.supplierRef}
                  onChange={(event) => updateField('supplierRef', event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 p-4">
            <div className="mb-3">
              <h4 className="text-sm font-semibold">{t.relationSection}</h4>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label>{t.supplier}</Label>
                <select
                  className={selectClassName}
                  value={values.supplierId}
                  onChange={(event) => updateField('supplierId', event.target.value)}
                >
                  <option value="">{t.selectPlaceholder}</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>
                      {supplier.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>{t.category}</Label>
                <select
                  className={selectClassName}
                  value={values.categoryId}
                  onChange={(event) => updateField('categoryId', event.target.value)}
                >
                  <option value="">{t.selectPlaceholder}</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>{t.client}</Label>
                <select
                  className={selectClassName}
                  value={values.clientId}
                  onChange={(event) => updateField('clientId', event.target.value)}
                >
                  <option value="">{t.noneOption}</option>
                  {clients.map((client) => (
                    <option key={client._id} value={client._id}>
                      {client.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <Label>{t.addSupplier}</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={inlineSupplierName}
                    onChange={(event) => setInlineSupplierName(event.target.value)}
                    placeholder={t.addSupplierPlaceholder}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleCreateSupplier()}
                    disabled={supplierCreating || !inlineSupplierName.trim()}
                  >
                    {supplierCreating ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
                    {t.createSupplier}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <Label>{t.invoice}</Label>
                <Input
                  value={invoiceSearchInput}
                  onChange={(event) => setInvoiceSearchInput(event.target.value)}
                  placeholder={t.invoiceSearchPlaceholder}
                />
                {invoiceLookupLoading ? <p className="text-xs text-muted-foreground">{t.invoiceSearchLoading}</p> : null}
                {!invoiceLookupLoading && debouncedInvoiceSearch && invoiceOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t.invoiceNoResults}</p>
                ) : null}
                <select
                  className={selectClassName}
                  value={values.invoiceId}
                  onChange={(event) => updateField('invoiceId', event.target.value)}
                >
                  <option value="">{t.noneOption}</option>
                  {invoiceOptions.map((invoice) => (
                    <option key={invoice._id} value={invoice._id}>
                      {buildInvoiceOptionLabel(invoice, locale)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <Label>{t.project}</Label>
                <Input
                  value={values.projectId}
                  onChange={(event) => updateField('projectId', event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 p-4">
            <div className="mb-3">
              <h4 className="text-sm font-semibold">{t.paymentSection}</h4>
            </div>
            {mode === 'edit' ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{t.paymentEditHint}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">{t.paymentStatus}</p>
                    <p className="text-sm font-semibold">
                      {EXPENSE_PAYMENT_STATUS.includes(values.paymentStatus as (typeof EXPENSE_PAYMENT_STATUS)[number])
                        ? getExpensePaymentStatusLabel(values.paymentStatus as (typeof EXPENSE_PAYMENT_STATUS)[number], locale)
                        : t.noneOption}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-muted-foreground">{t.amountPaid}</p>
                      {values.paymentStatus === 'paid' ? (
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex size-4 items-center justify-center text-muted-foreground hover:text-foreground"
                                aria-label={t.amountPaidLockedHint}
                              >
                                <CircleHelpIcon className="size-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                              {t.amountPaidLockedHint}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : null}
                    </div>
                    <p className="text-sm font-semibold">{amountPaidFromHistory.toFixed(2)}</p>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">{t.remainingPreview}</p>
                    <p className="text-sm font-semibold">{remaining.toFixed(2)}</p>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">{t.paymentMethod}</p>
                    <p className="text-sm font-semibold">
                      {EXPENSE_PAYMENT_METHODS.includes(values.paymentMethod as (typeof EXPENSE_PAYMENT_METHODS)[number])
                        ? getExpensePaymentMethodLabel(values.paymentMethod as (typeof EXPENSE_PAYMENT_METHODS)[number], locale)
                        : t.noneOption}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">{t.paidBy}</p>
                    <p className="text-sm font-semibold">
                      {EXPENSE_PAID_BY.includes(values.paidBy as (typeof EXPENSE_PAID_BY)[number])
                        ? getExpensePaidByLabel(values.paidBy as (typeof EXPENSE_PAID_BY)[number], locale)
                        : t.noneOption}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">{t.paidAt}</p>
                    <p className="text-sm font-semibold">{values.paidAt || t.noneOption}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>{t.paymentStatus}</Label>
                  <select
                    className={selectClassName}
                    value={values.paymentStatus}
                    onChange={(event) => updateField('paymentStatus', event.target.value)}
                  >
                    {EXPENSE_PAYMENT_STATUS.map((status) => (
                      <option key={status} value={status}>
                        {getExpensePaymentStatusLabel(status, locale)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t.paymentMethod}</Label>
                  <select
                    className={selectClassName}
                    value={values.paymentMethod}
                    onChange={(event) => updateField('paymentMethod', event.target.value)}
                  >
                    <option value="">{t.noneOption}</option>
                    {EXPENSE_PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {getExpensePaymentMethodLabel(method, locale)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t.paidBy}</Label>
                  <select
                    className={selectClassName}
                    value={values.paidBy}
                    onChange={(event) => updateField('paidBy', event.target.value)}
                  >
                    <option value="">{t.noneOption}</option>
                    {EXPENSE_PAID_BY.map((payer) => (
                      <option key={payer} value={payer}>
                        {getExpensePaidByLabel(payer, locale)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label>{t.amountPaid}</Label>
                    {values.paymentStatus === 'paid' ? (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex size-4 items-center justify-center text-muted-foreground hover:text-foreground"
                              aria-label={t.amountPaidLockedHint}
                            >
                              <CircleHelpIcon className="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                            {t.amountPaidLockedHint}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : null}
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={values.paymentStatus === 'paid' ? amountInclVat.toFixed(2) : values.amountPaid}
                    onChange={(event) => updateField('amountPaid', event.target.value)}
                    readOnly={values.paymentStatus === 'paid'}
                    disabled={values.paymentStatus === 'unpaid'}
                  />
                  {values.paymentStatus === 'paid' ? (
                    <p className="text-xs text-muted-foreground">{t.amountPaidAutoFilledPaid}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label>{t.paidAt}</Label>
                  <Input
                    type="date"
                    value={values.paidAt}
                    onChange={(event) => updateField('paidAt', event.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/70 p-4">
            <div className="mb-3">
              <h4 className="text-sm font-semibold">{t.extraSection}</h4>
            </div>
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label>{t.expenseType}</Label>
                <select
                  className={selectClassName}
                  value={values.expenseType}
                  onChange={(event) => updateField('expenseType', event.target.value)}
                >
                  {EXPENSE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {getExpenseTypeLabel(type, locale)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>{t.notes}</Label>
                <Textarea
                  rows={4}
                  value={values.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                />
              </div>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              {t.cancel}
            </Button>

            {mode === 'edit' && initialExpense?.status === 'draft' ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => requestSubmit('default')}
                  disabled={saving}
                >
                  {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  {t.saveDraft}
                </Button>
                <Button type="button" onClick={() => requestSubmit('activate')} disabled={saving}>
                  {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  {t.activateDraft}
                </Button>
              </>
            ) : (
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {mode === 'create' ? t.create : t.save}
              </Button>
            )}
          </DialogFooter>
        </form>

        {mode === 'edit' ? (
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.confirmEditTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmTarget === 'activate' ? t.confirmEditDescriptionActivate : t.confirmEditDescriptionDefault}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <Button type="button" variant="outline" disabled={saving}>
                    {t.confirmEditCancel}
                  </Button>
                </AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setConfirmOpen(false);
                      void submit(confirmTarget);
                    }}
                  >
                    {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                    {confirmTarget === 'activate' ? t.activateDraft : t.confirmEditAction}
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
