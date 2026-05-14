'use client';

import { FormEvent, useEffect, useState } from 'react';

import { Loader2Icon, PlusIcon } from 'lucide-react';

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
import type { ExpenseLookupCategory, ExpenseLookupClient, ExpenseLookupInvoice, ExpenseLookupSupplier } from '@/hooks/useExpenseLookups';
import type { ExpenseDetail } from '@/hooks/useExpenseDetail';
import {
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_STATUS,
  EXPENSE_TYPES,
  EXPENSE_VAT_RATES,
} from '@/lib/expenses/constants';

type Mode = 'create' | 'edit';

type SaveTarget = 'default' | 'activate';

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

const INITIAL_VALUES: FormValues = {
  amountExclVat: '',
  vatRate: '20',
  expenseDate: '',
  supplierId: '',
  categoryId: '',
  paymentMethod: '',
  paymentStatus: 'unpaid',
  amountPaid: '',
  paidAt: '',
  dueDate: '',
  supplierRef: '',
  expenseType: 'business',
  notes: '',
  clientId: '',
  projectId: '',
  invoiceId: '',
};

function toInputDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
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

function buildInitialValues(expense?: ExpenseDetail | null): FormValues {
  if (!expense) {
    return INITIAL_VALUES;
  }

  return {
    amountExclVat: toDecimalFromCents(expense.amountExclVatCents),
    vatRate: String(typeof expense.vatRate === 'number' ? expense.vatRate : 20),
    expenseDate: toInputDate(expense.expenseDate),
    supplierId: resolveEntityId(expense.supplierId),
    categoryId: resolveEntityId(expense.categoryId),
    paymentMethod: expense.paymentMethod || '',
    paymentStatus: expense.paymentStatus || 'unpaid',
    amountPaid: toDecimalFromCents(expense.amountPaidCents),
    paidAt: toInputDate(expense.paidAt),
    dueDate: toInputDate(expense.dueDate),
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
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [supplierCreating, setSupplierCreating] = useState(false);
  const [inlineSupplierName, setInlineSupplierName] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(buildInitialValues(initialExpense));
    setError(null);
    setInlineSupplierName('');
  }, [initialExpense, open]);

  const t = {
    en: {
      createTitle: 'Create Expense',
      editTitle: initialExpense?.status === 'draft' ? 'Edit Draft Expense' : 'Edit Expense',
      description: 'Fill all required fields. Draft activation requires amount, date, category, and supplier.',
      amountExclVat: 'Amount excl. VAT',
      vatRate: 'VAT rate',
      amountInclVatPreview: 'Amount incl. VAT (preview)',
      expenseDate: 'Expense date',
      supplier: 'Supplier',
      category: 'Category',
      paymentMethod: 'Payment method',
      paymentStatus: 'Payment status',
      amountPaid: 'Amount already paid',
      remainingPreview: 'Remaining balance (preview)',
      paidAt: 'Payment date',
      dueDate: 'Due date',
      supplierRef: 'Supplier invoice reference',
      expenseType: 'Expense type',
      notes: 'Internal notes',
      client: 'Linked client',
      project: 'Project placeholder',
      invoice: 'Linked invoice',
      create: 'Create expense',
      save: 'Save changes',
      saveDraft: 'Save as draft',
      activateDraft: 'Activate draft',
      cancel: 'Cancel',
      addSupplier: 'Quick add supplier',
      addSupplierPlaceholder: 'Supplier name',
      createSupplier: 'Add',
      selectPlaceholder: 'Select',
      noneOption: 'None',
      requiredFieldsError: 'Amount, date, category, and supplier are required to activate draft.',
      saveFailed: 'Failed to save expense',
      createSupplierFailed: 'Failed to create supplier',
    },
    fr: {
      createTitle: 'Creer une depense',
      editTitle: initialExpense?.status === 'draft' ? 'Modifier le brouillon' : 'Modifier la depense',
      description: 'Renseignez les champs requis. Activation du brouillon: montant, date, categorie, fournisseur.',
      amountExclVat: 'Montant HT',
      vatRate: 'Taux TVA',
      amountInclVatPreview: 'Montant TTC (apercu)',
      expenseDate: 'Date de depense',
      supplier: 'Fournisseur',
      category: 'Categorie',
      paymentMethod: 'Mode de paiement',
      paymentStatus: 'Statut paiement',
      amountPaid: 'Montant deja paye',
      remainingPreview: 'Reste a payer (apercu)',
      paidAt: 'Date de paiement',
      dueDate: 'Date limite',
      supplierRef: 'Reference facture fournisseur',
      expenseType: 'Type de depense',
      notes: 'Notes internes',
      client: 'Client lie',
      project: 'Projet (placeholder)',
      invoice: 'Facture liee',
      create: 'Creer la depense',
      save: 'Enregistrer',
      saveDraft: 'Sauvegarder brouillon',
      activateDraft: 'Activer brouillon',
      cancel: 'Annuler',
      addSupplier: 'Ajout rapide fournisseur',
      addSupplierPlaceholder: 'Nom du fournisseur',
      createSupplier: 'Ajouter',
      selectPlaceholder: 'Selectionner',
      noneOption: 'Aucun',
      requiredFieldsError: 'Montant, date, categorie et fournisseur requis pour activer le brouillon.',
      saveFailed: 'Echec enregistrement depense',
      createSupplierFailed: 'Echec creation fournisseur',
    },
  }[locale];

  const amountExclVat = Number(values.amountExclVat || 0);
  const vatRate = Number(values.vatRate || 0);
  const amountInclVat = toTwoDecimals(amountExclVat + amountExclVat * (vatRate / 100));
  const amountPaid = Number(values.amountPaid || 0);

  const computedAmountPaid =
    values.paymentStatus === 'paid' ? amountInclVat : values.paymentStatus === 'partial' ? amountPaid : 0;
  const remaining = toTwoDecimals(Math.max(amountInclVat - computedAmountPaid, 0));

  function updateField<K extends keyof FormValues>(field: K, next: FormValues[K]) {
    setValues((previous) => ({ ...previous, [field]: next }));
  }

  function canActivateDraft() {
    return (
      Number(values.amountExclVat || 0) > 0 &&
      Boolean(values.expenseDate) &&
      Boolean(values.categoryId) &&
      Boolean(values.supplierId)
    );
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
        paymentMethod: values.paymentMethod || undefined,
        paymentStatus: values.paymentStatus || undefined,
        amountPaidCents:
          values.paymentStatus === 'unpaid'
            ? 0
            : values.paymentStatus === 'partial' || values.paymentStatus === 'paid'
              ? computedAmountPaid
              : undefined,
        paidAt: values.paidAt || undefined,
        dueDate: values.dueDate || undefined,
        supplierRef: values.supplierRef || undefined,
        expenseType: values.expenseType || 'business',
        notes: values.notes || undefined,
        clientId: values.clientId || undefined,
        projectId: values.projectId || undefined,
        invoiceId: values.invoiceId || undefined,
      };

      if (values.paymentStatus === 'paid' && !values.paidAt) {
        payload.paidAt = new Date().toISOString().slice(0, 10);
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
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'create' ? t.createTitle : t.editTitle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(event) => void submit('default', event)}>
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
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={values.vatRate}
                onChange={(event) => updateField('vatRate', event.target.value)}
              >
                {EXPENSE_VAT_RATES.map((rate) => (
                  <option key={rate} value={String(rate)}>
                    {rate}%
                  </option>
                ))}
                {!EXPENSE_VAT_RATES.includes(vatRate as (typeof EXPENSE_VAT_RATES)[number]) ? (
                  <option value={values.vatRate}>{values.vatRate}%</option>
                ) : null}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>{t.amountInclVatPreview}</Label>
              <Input type="text" readOnly value={amountInclVat.toFixed(2)} />
            </div>

            <div className="space-y-1.5">
              <Label>{t.expenseDate}</Label>
              <Input
                type="date"
                value={values.expenseDate}
                onChange={(event) => updateField('expenseDate', event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.supplier}</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
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
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
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

            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label>{t.addSupplier}</Label>
              <div className="flex gap-2">
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

            <div className="space-y-1.5">
              <Label>{t.paymentMethod}</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={values.paymentMethod}
                onChange={(event) => updateField('paymentMethod', event.target.value)}
              >
                <option value="">{t.noneOption}</option>
                {EXPENSE_PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>{t.paymentStatus}</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={values.paymentStatus}
                onChange={(event) => updateField('paymentStatus', event.target.value)}
              >
                {EXPENSE_PAYMENT_STATUS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>{t.amountPaid}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={values.amountPaid}
                onChange={(event) => updateField('amountPaid', event.target.value)}
                disabled={values.paymentStatus === 'paid' || values.paymentStatus === 'unpaid'}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.remainingPreview}</Label>
              <Input type="text" readOnly value={remaining.toFixed(2)} />
            </div>

            <div className="space-y-1.5">
              <Label>{t.paidAt}</Label>
              <Input
                type="date"
                value={values.paidAt}
                onChange={(event) => updateField('paidAt', event.target.value)}
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

            <div className="space-y-1.5">
              <Label>{t.supplierRef}</Label>
              <Input
                value={values.supplierRef}
                onChange={(event) => updateField('supplierRef', event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.expenseType}</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={values.expenseType}
                onChange={(event) => updateField('expenseType', event.target.value)}
              >
                {EXPENSE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>{t.client}</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
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

            <div className="space-y-1.5">
              <Label>{t.project}</Label>
              <Input
                value={values.projectId}
                onChange={(event) => updateField('projectId', event.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label>{t.invoice}</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={values.invoiceId}
                onChange={(event) => updateField('invoiceId', event.target.value)}
              >
                <option value="">{t.noneOption}</option>
                {invoices.map((invoice) => (
                  <option key={invoice._id} value={invoice._id}>
                    {invoice.invoiceNumber || invoice._id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t.notes}</Label>
            <Textarea
              rows={4}
              value={values.notes}
              onChange={(event) => updateField('notes', event.target.value)}
            />
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
                  onClick={() => void submit('default')}
                  disabled={saving}
                >
                  {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  {t.saveDraft}
                </Button>
                <Button type="button" onClick={() => void submit('activate')} disabled={saving}>
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
      </DialogContent>
    </Dialog>
  );
}
