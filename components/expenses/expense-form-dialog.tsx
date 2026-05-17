'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { BriefcaseIcon, Building2Icon, ChevronDownIcon, Loader2Icon, PlusIcon, ReceiptIcon } from 'lucide-react';
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
import type { ExpenseLookupCategory, ExpenseLookupClient, ExpenseLookupInvoice, ExpenseLookupSupplier } from '@/hooks/useExpenseLookups';
import type { ExpenseDetail } from '@/hooks/useExpenseDetail';
import {
  DEFAULT_EXPENSE_TYPE,
  EXPENSE_CANONICAL_TYPES,
  EXPENSE_PAID_BY,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_STATUS,
  EXPENSE_VAT_RATES,
  normalizeExpenseType,
} from '@/lib/expenses/constants';
import {
  getExpensePaidByLabel,
  getExpensePaymentMethodLabel,
  getExpensePaymentStatusLabel,
} from '@/lib/expenses/labels';
import {
  EXPENSE_MAX_FILE_SIZE_BYTES,
  formatFileSizeMb,
  getExpenseFileExtension,
  isExpenseMimeTypeAllowed,
} from '@/lib/expenses/upload';
import { formatInvoiceDisplayNumber } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';

type Mode = 'create' | 'edit';

type SaveTarget = 'default' | 'activate' | 'draft';

type UiFlow = 'supplier_expense' | 'manual_expense_note' | 'client_project';
type Step = 'select-type' | 'form';

type ExpenseLookupSearchResponse = {
  success: boolean;
  message?: string;
  invoices?: ExpenseLookupInvoice[];
};

type ExpenseUploadPresignResponse = {
  success: boolean;
  message?: string;
  uploadUrl?: string;
  fileUrl?: string;
  key?: string;
};

type ExpenseDraftCreateResponse = {
  success: boolean;
  message?: string;
  expense?: Record<string, unknown>;
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

function inferDraftMimeType(file: File) {
  if (isExpenseMimeTypeAllowed(file.type)) {
    return file.type;
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'heic') return 'image/heic';
  return null;
}

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
    expenseType: DEFAULT_EXPENSE_TYPE,
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

function toInvoiceLookupFromExpense(expense: ExpenseDetail | null | undefined): ExpenseLookupInvoice | null {
  const invoiceValue = expense?.invoiceId;
  if (!invoiceValue || typeof invoiceValue === 'string') {
    return null;
  }

  const clientSnapshotValue = invoiceValue.clientSnapshot;
  const clientSnapshot =
    clientSnapshotValue && typeof clientSnapshotValue === 'object'
      ? {
          fullName:
            typeof clientSnapshotValue.fullName === 'string'
              ? clientSnapshotValue.fullName
              : undefined,
          companyName:
            typeof clientSnapshotValue.companyName === 'string'
              ? clientSnapshotValue.companyName
              : undefined,
        }
      : undefined;

  return {
    _id: invoiceValue._id,
    invoiceNumber:
      typeof invoiceValue.invoiceNumber === 'string' ? invoiceValue.invoiceNumber : undefined,
    date: typeof invoiceValue.date === 'string' ? invoiceValue.date : undefined,
    status: typeof invoiceValue.status === 'string' ? invoiceValue.status : undefined,
    totalIncludingTax:
      typeof invoiceValue.totalIncludingTax === 'number'
        ? invoiceValue.totalIncludingTax
        : undefined,
    clientSnapshot,
  };
}

function hasAdvancedData(values: FormValues, flow: UiFlow): boolean {
  if (flow === 'manual_expense_note') {
    return Boolean(values.supplierId);
  }
  if (flow === 'supplier_expense') {
    return Boolean(
      values.supplierRef ||
      values.clientId ||
      values.projectId ||
      values.invoiceId ||
      values.paymentStatus !== 'unpaid' ||
      values.paymentMethod ||
      values.paidBy
    );
  }
  // client_project
  return Boolean(
    values.invoiceId ||
    values.supplierId ||
    values.supplierRef ||
    values.paymentStatus !== 'unpaid' ||
    values.paymentMethod ||
    values.paidBy
  );
}

function deriveUiFlow(expense?: ExpenseDetail | null): UiFlow {
  if (!expense) return 'supplier_expense';
  if (normalizeExpenseType(expense.expenseType) === 'manual_expense_note') return 'manual_expense_note';
  if (resolveEntityId(expense.clientId)) return 'client_project';
  return 'supplier_expense';
}

function uiFlowToExpenseType(flow: UiFlow): (typeof EXPENSE_CANONICAL_TYPES)[number] {
  return flow === 'manual_expense_note' ? 'manual_expense_note' : 'supplier_expense';
}

function getExpenseIdFromPayload(payload: Record<string, unknown> | null | undefined) {
  if (!payload) return null;
  const id = payload._id;
  return typeof id === 'string' ? id : null;
}

function dispatchExpenseRefresh(expenseId?: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent('expenses:refresh', {
      detail: {
        expenseId: expenseId || undefined,
      },
    })
  );
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
    expenseType: normalizeExpenseType(expense.expenseType),
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
  const [step, setStep] = useState<Step>(() => (mode === 'create' ? 'select-type' : 'form'));
  const [uiFlow, setUiFlow] = useState<UiFlow>(() => deriveUiFlow(initialExpense));
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cameraDraftLoading, setCameraDraftLoading] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialValues = buildInitialValues(initialExpense);
    setValues(initialValues);
    setError(null);
    setInlineSupplierName('');
    setConfirmOpen(false);
    setInvoiceSearchInput('');
    setDebouncedInvoiceSearch('');

    if (mode === 'create') {
      setStep('select-type');
      setUiFlow('supplier_expense');
      setShowAdvanced(false);
    } else {
      setStep('form');
      const flow = deriveUiFlow(initialExpense);
      setUiFlow(flow);
      setShowAdvanced(hasAdvancedData(initialValues, flow));
    }
  }, [initialExpense, mode, open]);

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
      description: 'Fill all required fields. Draft validation requires amount, date, and category.',
      amountExclVat: 'Amount excl. VAT',
      vatRate: 'VAT rate',
      amountInclVatPreview: 'Amount incl. VAT (preview)',
      expenseDate: 'Expense date',
      supplier: 'Supplier (optional)',
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
      expenseType: 'Expense mode',
      notes: 'Internal notes',
      client: 'Linked client (optional)',
      project: 'Project (optional)',
      invoice: 'Linked invoice (optional)',
      financialSection: 'Financial fields',
      relationSection: 'Supplier and links',
      relationHintSupplier: 'Supplier is recommended for supplier expenses. Client, invoice, and project links remain optional.',
      relationHintManual: 'For free/manual expense notes, supplier is optional. Client, invoice, and project links remain optional.',
      paymentSection: 'Payment tracking',
      paymentEditHint: 'Payments are tracked as immutable lines. Use Add payment or Settle expense actions from the expense list/detail to register new payments.',
      extraSection: 'Classification and notes',
      create: 'Create expense',
      createAndValidate: 'Create and validate',
      save: 'Save changes',
      saveDraft: 'Save as draft',
      activateDraft: 'Validate expense',
      createSuccess: 'Expense created',
      createDraftSuccess: 'Draft saved',
      updateSuccess: 'Expense updated',
      activateSuccess: 'Expense validated',
      cameraDraftTitle: 'Receipt photo to draft',
      cameraDraftDescription: 'Capture a receipt now and create a draft instantly. Finalize it later from the draft list.',
      cameraDraftAction: 'Take photo and save draft',
      cameraDraftLoading: 'Creating draft...',
      cameraDraftSuccess: 'Draft created from photo',
      cameraDraftFailed: 'Failed to create draft from photo',
      cameraDraftUnsupportedFile: 'Unsupported file type. Allowed: PDF, JPEG, PNG, HEIC.',
      cameraDraftFileTooLarge: `File too large. Maximum ${formatFileSizeMb(EXPENSE_MAX_FILE_SIZE_BYTES)} MB`,
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
      requiredFieldsError: 'Amount, date, and category are required to validate the expense.',
      paidByRequiredWithPayment: 'Paid by is required when payment status is Paid or Partial.',
      saveFailed: 'Failed to save expense',
      createSupplierFailed: 'Failed to create supplier',
      selectTypeTitle: 'Select expense type',
      selectTypeDescription: 'Choose the type of expense you want to create.',
      flowSupplierTitle: 'Supplier Expense',
      flowSupplierDesc: 'OVH, POST, equipment supplier, subscription, telecom invoice...',
      flowManualTitle: 'Free Expense / Expense Note',
      flowManualDesc: 'Fuel, parking, restaurant, toll, coffee, travel expense...',
      flowClientTitle: 'Client / Project Expense',
      flowClientDesc: 'Purchases linked to a customer project or refacturable expenses.',
      back: 'Back',
      moreOptions: 'More options',
      hideAdvanced: 'Fewer options',
      addSupplierOptional: '+ Add supplier (optional)',
      hideOptionalSupplier: 'Hide supplier',
      selectedTypeLabel: 'Selected type',
    },
    fr: {
      createTitle: 'Créer une dépense',
      editTitle: initialExpense?.status === 'draft' ? 'Modifier le brouillon' : 'Modifier la dépense',
      description: 'Renseignez les champs requis. Activation du brouillon : montant, date et catégorie.',
      amountExclVat: 'Montant HT',
      vatRate: 'Taux TVA',
      amountInclVatPreview: 'Montant TTC (aperçu)',
      expenseDate: 'Date de dépense',
      supplier: 'Fournisseur (optionnel)',
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
      expenseType: 'Mode de dépense',
      notes: 'Notes internes',
      client: 'Client lié (optionnel)',
      project: 'Projet (optionnel)',
      invoice: 'Facture liée (optionnelle)',
      financialSection: 'Champs financiers',
      relationSection: 'Fournisseur et liaisons',
      relationHintSupplier: 'Le fournisseur est recommandé pour les dépenses fournisseur. Les liens client, facture et projet restent optionnels.',
      relationHintManual: 'Pour les dépenses libres/notes de frais, le fournisseur est optionnel. Les liens client, facture et projet restent optionnels.',
      paymentSection: 'Suivi paiement',
      paymentEditHint: 'Les paiements sont enregistrés en lignes immuables. Utilisez Ajouter un paiement ou Solder la dépense depuis la liste/détail pour enregistrer un nouveau paiement.',
      extraSection: 'Classification et notes',
      create: 'Créer la dépense',
      createAndValidate: 'Créer et valider',
      save: 'Enregistrer',
      saveDraft: 'Sauvegarder brouillon',
      activateDraft: 'Valider la dépense',
      createSuccess: 'Dépense créée',
      createDraftSuccess: 'Brouillon enregistré',
      updateSuccess: 'Dépense mise à jour',
      activateSuccess: 'Dépense validée',
      cameraDraftTitle: 'Photo reçu vers brouillon',
      cameraDraftDescription: 'Capturez un reçu maintenant et créez un brouillon immédiatement. Finalisez-le plus tard depuis la liste des brouillons.',
      cameraDraftAction: 'Prendre une photo et sauvegarder brouillon',
      cameraDraftLoading: 'Création du brouillon...',
      cameraDraftSuccess: 'Brouillon créé depuis la photo',
      cameraDraftFailed: 'Échec création brouillon depuis la photo',
      cameraDraftUnsupportedFile: 'Type de fichier non supporté. Autorisés : PDF, JPEG, PNG, HEIC.',
      cameraDraftFileTooLarge: `Fichier trop volumineux. Maximum ${formatFileSizeMb(EXPENSE_MAX_FILE_SIZE_BYTES)} MB`,
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
      requiredFieldsError: 'Montant, date et catégorie requis pour activer le brouillon.',
      paidByRequiredWithPayment: 'Le champ payé par est requis lorsque le statut est Payé ou Partiel.',
      saveFailed: 'Échec enregistrement dépense',
      createSupplierFailed: 'Échec création fournisseur',
      selectTypeTitle: 'Sélectionner le type de dépense',
      selectTypeDescription: 'Choisissez le type de dépense que vous souhaitez créer.',
      flowSupplierTitle: 'Dépense fournisseur',
      flowSupplierDesc: 'OVH, POST, équipement, abonnement, facture télécom...',
      flowManualTitle: 'Dépense libre / Note de frais',
      flowManualDesc: 'Carburant, parking, restaurant, péage, café, déplacement...',
      flowClientTitle: 'Dépense client / Projet',
      flowClientDesc: 'Achats liés à un projet client ou dépenses refacturables.',
      back: 'Retour',
      moreOptions: 'Plus d\'options',
      hideAdvanced: 'Moins d\'options',
      addSupplierOptional: '+ Ajouter un fournisseur (optionnel)',
      hideOptionalSupplier: 'Masquer le fournisseur',
      selectedTypeLabel: 'Type sélectionné',
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
    const initialInvoice = toInvoiceLookupFromExpense(initialExpense);
    const selectedInvoice =
      (values.invoiceId ? invoices.find((invoice) => invoice._id === values.invoiceId) : undefined) ||
      (values.invoiceId ? remoteInvoices.find((invoice) => invoice._id === values.invoiceId) : undefined) ||
      (initialInvoice && initialInvoice._id === values.invoiceId ? initialInvoice : undefined);

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
  }, [debouncedInvoiceSearch, initialExpense, invoices, locale, remoteInvoices, values.invoiceId]);

  function updateField<K extends keyof FormValues>(field: K, next: FormValues[K]) {
    setValues((previous) => ({ ...previous, [field]: next }));
  }

  useEffect(() => {
    if (mode !== 'create' || values.paymentStatus !== 'unpaid') {
      return;
    }

    setValues((previous) => {
      if (!previous.paymentMethod && !previous.paidBy && !previous.paidAt && !previous.amountPaid) {
        return previous;
      }

      return {
        ...previous,
        paymentMethod: '',
        paidBy: '',
        paidAt: '',
        amountPaid: '',
      };
    });
  }, [mode, values.paymentStatus]);

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
      Boolean(values.categoryId)
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

  async function createDraftFromCapturedFile(file: File) {
    const mimeType = inferDraftMimeType(file);
    if (!mimeType) {
      setError(t.cameraDraftUnsupportedFile);
      toast.error(t.cameraDraftUnsupportedFile);
      return;
    }

    if (file.size > EXPENSE_MAX_FILE_SIZE_BYTES) {
      setError(t.cameraDraftFileTooLarge);
      toast.error(t.cameraDraftFileTooLarge);
      return;
    }

    setCameraDraftLoading(true);
    setError(null);

    try {
      const presignResponse = await fetch('/api/expenses/upload-presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: mimeType,
          fileSize: file.size,
        }),
      });

      const presignPayload = (await presignResponse.json().catch(() => null)) as
        | ExpenseUploadPresignResponse
        | null;

      if (
        !presignResponse.ok ||
        !presignPayload?.success ||
        !presignPayload.uploadUrl ||
        !presignPayload.fileUrl ||
        !presignPayload.key
      ) {
        throw new Error(presignPayload?.message || t.cameraDraftFailed);
      }

      const uploadResponse = await fetch(presignPayload.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': mimeType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(t.cameraDraftFailed);
      }

      const extension = getExpenseFileExtension(file.name, mimeType);

      const draftResponse = await fetch('/api/expenses/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachment: {
            originalName: file.name,
            displayName: file.name,
            mimeType,
            extension,
            sizeBytes: file.size,
            storageKey: presignPayload.key,
            url: presignPayload.fileUrl,
            checksum: null,
          },
        }),
      });

      const draftPayload = (await draftResponse.json().catch(() => null)) as
        | ExpenseDraftCreateResponse
        | null;

      if (!draftResponse.ok || !draftPayload?.success || !draftPayload.expense) {
        throw new Error(draftPayload?.message || t.cameraDraftFailed);
      }

      const createdExpenseId = getExpenseIdFromPayload(draftPayload.expense);
      dispatchExpenseRefresh(createdExpenseId);
      await onSaved(draftPayload.expense);
      toast.success(t.cameraDraftSuccess);
      onOpenChange(false);
    } catch (captureError) {
      const message = captureError instanceof Error ? captureError.message : t.cameraDraftFailed;
      setError(message);
      toast.error(message);
    } finally {
      setCameraDraftLoading(false);
    }
  }

  function handleCameraFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile) {
      return;
    }

    void createDraftFromCapturedFile(selectedFile);
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
        supplierId: values.supplierId || null,
        categoryId: values.categoryId || null,
        dueDate: values.dueDate || undefined,
        supplierRef: values.supplierRef || undefined,
        expenseType: normalizeExpenseType(values.expenseType),
        notes: values.notes || undefined,
        clientId: values.clientId || null,
        projectId: values.projectId || null,
        // Keep explicit null so invoice unlink operations are persisted.
        invoiceId: values.invoiceId || null,
      };

      if (mode === 'create') {
        payload.status = saveTarget === 'draft' ? 'draft' : 'active';

        const normalizedPaymentStatus = values.paymentStatus || 'unpaid';
        const hasPaymentStatus = normalizedPaymentStatus === 'paid' || normalizedPaymentStatus === 'partial';
        const isUnpaid = normalizedPaymentStatus === 'unpaid';

        if (hasPaymentStatus && !values.paidBy) {
          setError(t.paidByRequiredWithPayment);
          setSaving(false);
          return;
        }

        payload.paymentStatus = normalizedPaymentStatus;
        payload.amountPaidCents = isUnpaid ? 0 : computedAmountPaid;

        if (isUnpaid) {
          payload.paymentMethod = undefined;
          payload.paidBy = undefined;
          payload.paidAt = undefined;
        } else {
          payload.paymentMethod = values.paymentMethod || undefined;
          payload.paidBy = values.paidBy || undefined;
          payload.paidAt = values.paidAt || undefined;

          if (normalizedPaymentStatus === 'paid' && !values.paidAt) {
            payload.paidAt = new Date().toISOString().slice(0, 10);
          }
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

        dispatchExpenseRefresh(getExpenseIdFromPayload(result.expense) || initialExpense._id);
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

      dispatchExpenseRefresh(getExpenseIdFromPayload(result.expense));
      await onSaved(result.expense);
      toast.success(saveTarget === 'draft' ? t.createDraftSuccess : t.createSuccess);
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'create' ? t.createTitle : t.editTitle;
  const selectClassName = 'h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm';

  const isSupplierFlow = uiFlow === 'supplier_expense';
  const isManualFlow = uiFlow === 'manual_expense_note';
  const isClientProjectFlow = uiFlow === 'client_project';

  const uiFlowLabel =
    isManualFlow ? t.flowManualTitle : isClientProjectFlow ? t.flowClientTitle : t.flowSupplierTitle;

  const flowCardClass =
    'w-full rounded-xl border border-border/70 p-4 text-left transition-colors hover:border-primary hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  if (step === 'select-type') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.selectTypeTitle}</DialogTitle>
            <DialogDescription>{t.selectTypeDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <button
              type="button"
              className={flowCardClass}
              onClick={() => {
                setUiFlow('supplier_expense');
                setValues((previous) => ({ ...previous, expenseType: uiFlowToExpenseType('supplier_expense') }));
                setStep('form');
              }}
            >
              <div className="flex items-start gap-3">
                <Building2Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold">{t.flowSupplierTitle}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.flowSupplierDesc}</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              className={flowCardClass}
              onClick={() => {
                setUiFlow('manual_expense_note');
                setValues((previous) => ({ ...previous, expenseType: uiFlowToExpenseType('manual_expense_note') }));
                setStep('form');
              }}
            >
              <div className="flex items-start gap-3">
                <ReceiptIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold">{t.flowManualTitle}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.flowManualDesc}</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              className={flowCardClass}
              onClick={() => {
                setUiFlow('client_project');
                setValues((previous) => ({ ...previous, expenseType: uiFlowToExpenseType('client_project') }));
                setStep('form');
              }}
            >
              <div className="flex items-start gap-3">
                <BriefcaseIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold">{t.flowClientTitle}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.flowClientDesc}</p>
                </div>
              </div>
            </button>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t.cancel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {mode === 'create' ? (
          <div className="flex items-center gap-2 -mt-1">
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {uiFlowLabel}
            </span>
          </div>
        ) : null}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*,.jpg,.jpeg,.png,.heic,.pdf"
          capture="environment"
          className="hidden"
          onChange={handleCameraFileSelection}
        />

        <form className="space-y-4" onSubmit={(event) => requestSubmit('default', event)}>
          {mode === 'create' && isManualFlow ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/55 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">{t.cameraDraftTitle}</p>
                <p className="text-xs text-muted-foreground">{t.cameraDraftDescription}</p>
              </div>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={saving || cameraDraftLoading}
                >
                  {cameraDraftLoading ? <Loader2Icon className="size-4 animate-spin" /> : <ReceiptIcon className="size-4" />}
                  {cameraDraftLoading ? t.cameraDraftLoading : t.cameraDraftAction}
                </Button>
              </div>
            </div>
          ) : null}

          {/* === Financial fields === */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>{t.amountExclVat}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={values.amountExclVat}
                onChange={(event) => updateField('amountExclVat', event.target.value)}
              />
              {amountInclVat > 0 ? (
                <p className="text-xs text-muted-foreground">
                  = {amountInclVat.toFixed(2)} {locale === 'fr' ? 'TTC' : 'incl. VAT'}
                </p>
              ) : null}
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
              <div className="flex flex-wrap gap-1">
                {EXPENSE_VAT_RATES.map((rate) => {
                  const isActive = Number(values.vatRate) === rate;
                  return (
                    <Button
                      key={rate}
                      type="button"
                      size="sm"
                      variant={isActive ? 'default' : 'outline'}
                      className="h-6 px-2 text-xs"
                      onClick={() => updateField('vatRate', String(rate))}
                    >
                      {rate}%
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Date + Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.expenseDate}</Label>
              <Input
                type="date"
                value={values.expenseDate}
                onChange={(event) => handleExpenseDateChange(event.target.value)}
              />
            </div>
            {!isManualFlow ? (
              <div className="space-y-1.5">
                <Label>{t.dueDate}</Label>
                <Input
                  type="date"
                  value={values.dueDate}
                  onChange={(event) => updateField('dueDate', event.target.value)}
                />
              </div>
            ) : null}
          </div>

          {/* === Supplier flow: supplier + category === */}
          {isSupplierFlow ? (
            <div className="grid grid-cols-2 gap-3">
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
            </div>
          ) : null}

          {/* === Manual flow: category + payment === */}
          {isManualFlow ? (
            <div className="space-y-3">
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
              {mode === 'create' ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
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
                  </div>
                  {values.paymentStatus !== 'unpaid' ? (
                    <div className="grid grid-cols-2 gap-3">
                      {values.paymentStatus === 'partial' ? (
                        <div className="space-y-1.5">
                          <Label>{t.amountPaid}</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={values.amountPaid}
                            onChange={(event) => updateField('amountPaid', event.target.value)}
                          />
                        </div>
                      ) : null}
                      <div className="space-y-1.5">
                        <Label>{t.paidAt}</Label>
                        <Input
                          type="date"
                          value={values.paidAt}
                          onChange={(event) => updateField('paidAt', event.target.value)}
                        />
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">{t.paymentEditHint}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">{t.paymentStatus}</p>
                      <p className="text-sm font-medium">
                        {EXPENSE_PAYMENT_STATUS.includes(values.paymentStatus as (typeof EXPENSE_PAYMENT_STATUS)[number])
                          ? getExpensePaymentStatusLabel(values.paymentStatus as (typeof EXPENSE_PAYMENT_STATUS)[number], locale)
                          : t.noneOption}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t.amountPaid}</p>
                      <p className="text-sm font-medium">{amountPaidFromHistory.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t.remainingPreview}</p>
                      <p className="text-sm font-medium">{remaining.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t.paymentMethod}</p>
                      <p className="text-sm font-medium">
                        {EXPENSE_PAYMENT_METHODS.includes(values.paymentMethod as (typeof EXPENSE_PAYMENT_METHODS)[number])
                          ? getExpensePaymentMethodLabel(values.paymentMethod as (typeof EXPENSE_PAYMENT_METHODS)[number], locale)
                          : t.noneOption}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t.paidBy}</p>
                      <p className="text-sm font-medium">
                        {EXPENSE_PAID_BY.includes(values.paidBy as (typeof EXPENSE_PAID_BY)[number])
                          ? getExpensePaidByLabel(values.paidBy as (typeof EXPENSE_PAID_BY)[number], locale)
                          : t.noneOption}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t.paidAt}</p>
                      <p className="text-sm font-medium">{values.paidAt || t.noneOption}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* === Client/Project flow: client + project + category === */}
          {isClientProjectFlow ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
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
                <div className="space-y-1.5">
                  <Label>{t.project}</Label>
                  <Input
                    value={values.projectId}
                    onChange={(event) => updateField('projectId', event.target.value)}
                  />
                </div>
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
            </div>
          ) : null}

          {/* === Notes (always visible) === */}
          <div className="space-y-1.5">
            <Label>{t.notes}</Label>
            <Textarea
              rows={2}
              value={values.notes}
              onChange={(event) => updateField('notes', event.target.value)}
            />
          </div>

          {/* === Advanced section toggle === */}
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            onClick={() => setShowAdvanced((prev) => !prev)}
          >
            <span>
              {isManualFlow
                ? showAdvanced
                  ? t.hideOptionalSupplier
                  : t.addSupplierOptional
                : showAdvanced
                  ? t.hideAdvanced
                  : t.moreOptions}
            </span>
            <ChevronDownIcon className={cn('size-4 transition-transform', showAdvanced && 'rotate-180')} />
          </button>

          {/* === Advanced content === */}
          {showAdvanced ? (
            <div className="space-y-3 rounded-lg bg-muted/30 px-4 py-3">
              {/* SUPPLIER FLOW advanced */}
              {isSupplierFlow ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>{t.supplierRef}</Label>
                      <Input
                        value={values.supplierRef}
                        onChange={(event) => updateField('supplierRef', event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
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

                  <div className="grid grid-cols-2 gap-3">
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
                    <div className="space-y-1.5">
                      <Label>{t.project}</Label>
                      <Input
                        value={values.projectId}
                        onChange={(event) => updateField('projectId', event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
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

                  {mode === 'create' ? (
                    <div className="space-y-3 border-t border-border/50 pt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.paymentSection}</p>
                      <div className="grid grid-cols-3 gap-3">
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
                      </div>
                      {values.paymentStatus !== 'unpaid' ? (
                        <div className="grid grid-cols-2 gap-3">
                          {values.paymentStatus === 'partial' ? (
                            <div className="space-y-1.5">
                              <Label>{t.amountPaid}</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={values.amountPaid}
                                onChange={(event) => updateField('amountPaid', event.target.value)}
                              />
                            </div>
                          ) : null}
                          <div className="space-y-1.5">
                            <Label>{t.paidAt}</Label>
                            <Input
                              type="date"
                              value={values.paidAt}
                              onChange={(event) => updateField('paidAt', event.target.value)}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {mode === 'edit' ? (
                    <div className="space-y-2 border-t border-border/50 pt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.paymentSection}</p>
                      <p className="text-xs text-muted-foreground">{t.paymentEditHint}</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">{t.paymentStatus}</p>
                          <p className="text-sm font-medium">
                            {EXPENSE_PAYMENT_STATUS.includes(values.paymentStatus as (typeof EXPENSE_PAYMENT_STATUS)[number])
                              ? getExpensePaymentStatusLabel(values.paymentStatus as (typeof EXPENSE_PAYMENT_STATUS)[number], locale)
                              : t.noneOption}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t.amountPaid}</p>
                          <p className="text-sm font-medium">{amountPaidFromHistory.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t.remainingPreview}</p>
                          <p className="text-sm font-medium">{remaining.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t.paymentMethod}</p>
                          <p className="text-sm font-medium">
                            {EXPENSE_PAYMENT_METHODS.includes(values.paymentMethod as (typeof EXPENSE_PAYMENT_METHODS)[number])
                              ? getExpensePaymentMethodLabel(values.paymentMethod as (typeof EXPENSE_PAYMENT_METHODS)[number], locale)
                              : t.noneOption}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t.paidBy}</p>
                          <p className="text-sm font-medium">
                            {EXPENSE_PAID_BY.includes(values.paidBy as (typeof EXPENSE_PAID_BY)[number])
                              ? getExpensePaidByLabel(values.paidBy as (typeof EXPENSE_PAID_BY)[number], locale)
                              : t.noneOption}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t.paidAt}</p>
                          <p className="text-sm font-medium">{values.paidAt || t.noneOption}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {/* MANUAL FLOW advanced: supplier only */}
              {isManualFlow ? (
                <div className="space-y-3">
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
                </div>
              ) : null}

              {/* CLIENT/PROJECT FLOW advanced: invoice + supplier + payment */}
              {isClientProjectFlow ? (
                <>
                  <div className="space-y-1.5">
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

                  <div className="grid grid-cols-2 gap-3">
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
                      <Label>{t.supplierRef}</Label>
                      <Input
                        value={values.supplierRef}
                        onChange={(event) => updateField('supplierRef', event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
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

                  {mode === 'create' ? (
                    <div className="space-y-3 border-t border-border/50 pt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.paymentSection}</p>
                      <div className="grid grid-cols-3 gap-3">
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
                      </div>
                      {values.paymentStatus !== 'unpaid' ? (
                        <div className="grid grid-cols-2 gap-3">
                          {values.paymentStatus === 'partial' ? (
                            <div className="space-y-1.5">
                              <Label>{t.amountPaid}</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={values.amountPaid}
                                onChange={(event) => updateField('amountPaid', event.target.value)}
                              />
                            </div>
                          ) : null}
                          <div className="space-y-1.5">
                            <Label>{t.paidAt}</Label>
                            <Input
                              type="date"
                              value={values.paidAt}
                              onChange={(event) => updateField('paidAt', event.target.value)}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {mode === 'edit' ? (
                    <div className="space-y-2 border-t border-border/50 pt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.paymentSection}</p>
                      <p className="text-xs text-muted-foreground">{t.paymentEditHint}</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">{t.paymentStatus}</p>
                          <p className="text-sm font-medium">
                            {EXPENSE_PAYMENT_STATUS.includes(values.paymentStatus as (typeof EXPENSE_PAYMENT_STATUS)[number])
                              ? getExpensePaymentStatusLabel(values.paymentStatus as (typeof EXPENSE_PAYMENT_STATUS)[number], locale)
                              : t.noneOption}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t.amountPaid}</p>
                          <p className="text-sm font-medium">{amountPaidFromHistory.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t.remainingPreview}</p>
                          <p className="text-sm font-medium">{remaining.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t.paymentMethod}</p>
                          <p className="text-sm font-medium">
                            {EXPENSE_PAYMENT_METHODS.includes(values.paymentMethod as (typeof EXPENSE_PAYMENT_METHODS)[number])
                              ? getExpensePaymentMethodLabel(values.paymentMethod as (typeof EXPENSE_PAYMENT_METHODS)[number], locale)
                              : t.noneOption}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t.paidBy}</p>
                          <p className="text-sm font-medium">
                            {EXPENSE_PAID_BY.includes(values.paidBy as (typeof EXPENSE_PAID_BY)[number])
                              ? getExpensePaidByLabel(values.paidBy as (typeof EXPENSE_PAID_BY)[number], locale)
                              : t.noneOption}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t.paidAt}</p>
                          <p className="text-sm font-medium">{values.paidAt || t.noneOption}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter className="sm:justify-between">
            <div>
              {mode === 'create' ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('select-type')}
                  disabled={saving}
                >
                  {t.back}
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                {t.cancel}
              </Button>

              {mode === 'create' ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => requestSubmit('draft')}
                    disabled={saving || cameraDraftLoading}
                  >
                    {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                    {t.saveDraft}
                  </Button>
                  <Button type="submit" disabled={saving || cameraDraftLoading}>
                    {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                    {t.createAndValidate}
                  </Button>
                </>
              ) : mode === 'edit' && initialExpense?.status === 'draft' ? (
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
                  {t.save}
                </Button>
              )}
            </div>
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
