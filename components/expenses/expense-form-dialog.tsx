'use client';

import { ChangeEvent, FocusEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import Image from 'next/image';

import { BriefcaseIcon, Building2Icon, ChevronDownIcon, ExternalLinkIcon, Loader2Icon, PlusIcon, ReceiptIcon } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AttachmentPreviewDialog, type AttachmentPreview } from '@/components/expenses/attachment-preview-dialog';
import { InteractiveReceiptImage } from '@/components/expenses/interactive-receipt-image';
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
import { resolveExpenseCategoryNameByLocale } from '@/lib/expenses/category-i18n';
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

type ExpenseAttachmentMetadata = {
  originalName: string;
  displayName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  storageKey: string;
  url: string;
  checksum: string | null;
};

type ExpenseAttachmentMutationResponse = {
  success: boolean;
  message?: string;
  attachment?: Record<string, unknown>;
};

type PendingCameraCapture = {
  file: File;
  mimeType: string;
  previewUrl: string;
  decisionRequired: boolean;
};

type ExpenseReceiptAttachment = NonNullable<ExpenseDetail['attachments']>[number];

type ExpenseFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  initialExpense?: ExpenseDetail | null;
  initialReceiptFile?: File | null;
  categories: ExpenseLookupCategory[];
  suppliers: ExpenseLookupSupplier[];
  clients: ExpenseLookupClient[];
  invoices: ExpenseLookupInvoice[];
  locale: 'en' | 'fr';
  onCreateSupplier: (payload: { fullName: string }) => Promise<ExpenseLookupSupplier>;
  onCreateCategory: (payload: { name: string }) => Promise<ExpenseLookupCategory>;
  onSaved: (expense: Record<string, unknown>) => Promise<void> | void;
};

type FormValues = {
  amountInclVat: string;
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
const ADD_SUPPLIER_OPTION_VALUE = '__add_new_supplier__';
const ADD_CATEGORY_OPTION_VALUE = '__add_new_category__';

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

function isInlineImageMimeType(mimeType?: string) {
  return typeof mimeType === 'string' && mimeType.startsWith('image/');
}

function isInlinePdfMimeType(mimeType?: string) {
  return mimeType === 'application/pdf';
}

function toInputDate(value?: string | null) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return toInputDateFromDate(date);
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

function isLikelyMobileViewport() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(max-width: 767px)').matches;
}

function buildDefaultFormValues(): FormValues {
  const expenseDate = toInputDateFromDate(new Date());

  return {
    amountInclVat: '',
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

function normalizeDecimalValue(value: string) {
  return value.trim().replace(',', '.');
}

function sanitizeDecimalInput(value: string) {
  return value.replace(/[^\d.,]/g, '');
}

function toNonNegativeNumber(value: string) {
  const parsed = Number(normalizeDecimalValue(value));
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(parsed, 0);
}

function formatCurrencyFromUnits(value: number, locale: 'en' | 'fr') {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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
    amountInclVat: toDecimalFromCents(expense.amountInclVatCents),
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
  initialReceiptFile,
  categories,
  suppliers,
  clients,
  invoices,
  locale,
  onCreateSupplier,
  onCreateCategory,
  onSaved,
}: ExpenseFormDialogProps) {
  const [values, setValues] = useState<FormValues>(() => buildDefaultFormValues());
  const [step, setStep] = useState<Step>(() => (mode === 'create' ? 'select-type' : 'form'));
  const [uiFlow, setUiFlow] = useState<UiFlow>(() => deriveUiFlow(initialExpense));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingTarget, setSavingTarget] = useState<SaveTarget | null>(null);
  const [supplierCreating, setSupplierCreating] = useState(false);
  const [supplierQuickCreateOpen, setSupplierQuickCreateOpen] = useState(false);
  const [supplierQuickCreateName, setSupplierQuickCreateName] = useState('');
  const [supplierQuickCreateError, setSupplierQuickCreateError] = useState<string | null>(null);
  const [inlineCreatedSupplier, setInlineCreatedSupplier] = useState<ExpenseLookupSupplier | null>(null);
  const [categoryCreating, setCategoryCreating] = useState(false);
  const [categoryQuickCreateOpen, setCategoryQuickCreateOpen] = useState(false);
  const [categoryQuickCreateName, setCategoryQuickCreateName] = useState('');
  const [categoryQuickCreateError, setCategoryQuickCreateError] = useState<string | null>(null);
  const [inlineCreatedCategory, setInlineCreatedCategory] = useState<ExpenseLookupCategory | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<SaveTarget>('default');
  const [invoiceSearchInput, setInvoiceSearchInput] = useState('');
  const [debouncedInvoiceSearch, setDebouncedInvoiceSearch] = useState('');
  const [remoteInvoices, setRemoteInvoices] = useState<ExpenseLookupInvoice[]>([]);
  const [invoiceLookupLoading, setInvoiceLookupLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cameraDraftLoading, setCameraDraftLoading] = useState(false);
  const [pendingCameraCapture, setPendingCameraCapture] = useState<PendingCameraCapture | null>(null);
  const [finalizeAsPaid, setFinalizeAsPaid] = useState(false);
  const [receiptViewerAttachment, setReceiptViewerAttachment] = useState<AttachmentPreview | null>(null);

  const isDraftEditMode = mode === 'edit' && initialExpense?.status === 'draft';

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const amountInclVatFirstFocusRef = useRef(true);

  useEffect(() => {
    if (!open) {
      setPendingCameraCapture(null);
      amountInclVatFirstFocusRef.current = true;
      return;
    }

    const initialValues = buildInitialValues(initialExpense);
    setValues(initialValues);
    setError(null);
    setSaving(false);
    setSavingTarget(null);
    setSupplierQuickCreateOpen(false);
    setSupplierQuickCreateName('');
    setSupplierQuickCreateError(null);
    setInlineCreatedSupplier(null);
    setCategoryQuickCreateOpen(false);
    setCategoryQuickCreateName('');
    setCategoryQuickCreateError(null);
    setInlineCreatedCategory(null);
    setConfirmOpen(false);
    setInvoiceSearchInput('');
    setDebouncedInvoiceSearch('');
    setPendingCameraCapture(null);
    setFinalizeAsPaid(Boolean(mode === 'edit' && initialExpense?.status === 'draft' && initialExpense?.paymentStatus === 'paid'));
    setReceiptViewerAttachment(null);
    amountInclVatFirstFocusRef.current = true;

    if (mode === 'create') {
      if (initialReceiptFile) {
        const mimeType = inferDraftMimeType(initialReceiptFile);

        setStep('form');
        setUiFlow('manual_expense_note');
        setValues((previous) => ({
          ...previous,
          expenseType: uiFlowToExpenseType('manual_expense_note'),
        }));
        setShowAdvanced(false);

        if (mimeType) {
          setPendingCameraCapture({
            file: initialReceiptFile,
            mimeType,
            previewUrl: URL.createObjectURL(initialReceiptFile),
            decisionRequired: true,
          });
        }
      } else {
        setStep('select-type');
        setUiFlow('supplier_expense');
        setShowAdvanced(false);
      }
    } else {
      setStep('form');
      const flow = deriveUiFlow(initialExpense);
      setUiFlow(flow);
      setShowAdvanced(hasAdvancedData(initialValues, flow));
    }
  }, [initialExpense, initialReceiptFile, mode, open]);

  useEffect(() => {
    const previewUrl = pendingCameraCapture?.previewUrl;

    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [pendingCameraCapture?.previewUrl]);

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
      description: 'Fill all required fields. Completing a draft requires amount, date, and category.',
      amountInclVat: 'Total amount (incl. VAT)',
      amountInclVatHint: 'Enter the final amount shown on the receipt (TTC).',
      amountExclVat: 'Amount excl. VAT (auto-calculated)',
      amountExclVatHint: 'Calculated from total amount and VAT rate.',
      vatAmountPreview: 'VAT amount (preview)',
      vatRate: 'VAT rate',
      vatRateHint: 'You can type any VAT value (example: 10).',
      expenseDate: 'Expense date',
      supplier: 'Supplier (optional)',
      category: 'Category',
      requiredBadge: 'Required',
      categoryRequiredTitle: 'Expense Category ',
      categoryRequiredHint: 'Choose a category now. This is required to finalize a draft.',
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
      receiptPreviewTitle: 'Receipt preview',
      receiptPreviewDescription: 'Keep the receipt visible while completing the expense fields.',
      receiptPreviewMobileDescription: 'Open the receipt in full screen when you need to inspect details, then return to the form.',
      receiptPreviewUnavailable: 'This receipt type cannot be previewed inline.',
      openReceipt: 'Open receipt',
      viewReceiptFullScreen: 'View receipt full screen',
      extraSection: 'Classification and notes',
      create: 'Create expense',
      createAndValidate: 'Create expense',
      save: 'Save changes',
      saveDraft: 'Save as draft',
      activateDraft: 'Finalize draft',
      activateAndPayDraft: 'Finalize & pay',
      createSuccess: 'Expense created',
      createDraftSuccess: 'Draft saved',
      updateSuccess: 'Expense updated',
      activateSuccess: 'Expense finalized',
      activateAndPaySuccess: 'Expense finalized and paid',
      finalizeDraftPaymentSection: 'Finalize payment',
      alreadyPaidLabel: 'Already paid',
      alreadyPaidHint: 'If enabled, finalizing will register full payment immediately.',
      cameraDraftTitle: 'Receipt photo',
      cameraDraftDescription: 'Take a receipt photo, review it, then save a quick draft or continue in the form.',
      cameraDraftAction: 'Take photo',
      cameraDraftLoading: 'Saving draft...',
      cameraDraftSuccess: 'Draft created from photo',
      cameraDraftFailed: 'Failed to create draft from photo',
      cameraDraftUnsupportedFile: 'Unsupported file type. Allowed: PDF, JPEG, PNG, HEIC.',
      cameraDraftFileTooLarge: `File too large. Maximum ${formatFileSizeMb(EXPENSE_MAX_FILE_SIZE_BYTES)} MB`,
      cameraCaptureReadyTitle: 'Receipt captured',
      cameraCaptureReadyDescription: 'Choose whether to save a quick draft now or keep the form open and finish the expense.',
      cameraCaptureAttachedDescription: 'This photo will be attached when you save the expense.',
      cameraCaptureContinue: 'Continue in form',
      cameraCaptureRetake: 'Retake photo',
      cameraCaptureRemove: 'Remove photo',
      cameraCapturePendingChoice: 'Choose what to do with this photo before submitting the expense.',
      cameraCapturePreviewAlt: 'Captured receipt preview',
      cameraCaptureAttachFailedAfterCreate:
        'Expense created, but the receipt could not be attached. Open the expense and upload it again.',
      cancel: 'Cancel',
      confirmEditTitle: 'Confirm expense update',
      confirmEditDescriptionDefault: 'This will save your edits and update expense history.',
      confirmEditDescriptionActivate: 'This will finalize the draft and make it actionable.',
      confirmEditDescriptionActivateAndPay: 'This will finalize the draft and register full payment immediately.',
      confirmEditDescriptionPaidFinancialWarning:
        'Warning: financial values changed on a paid expense. This can impact paid totals and accounting consistency.',
      confirmEditDescriptionPaidFinancialSummary: (paid: string, remaining: string) =>
        `Paid history stays at ${paid}. New projected remaining balance: ${remaining}.`,
      confirmEditCancel: 'Cancel',
      confirmEditAction: 'Confirm update',
      addSupplier: 'Quick add supplier',
      addSupplierPlaceholder: 'Supplier name',
      createSupplier: 'Add',
      addSupplierOption: '+ Add new supplier',
      addSupplierInlineAction: 'Add new supplier',
      quickAddSupplierTitle: 'Add supplier',
      quickAddSupplierDescription: 'Create a supplier without leaving this expense. It will be selected automatically.',
      quickAddSupplierNameLabel: 'Supplier name',
      quickAddSupplierCancel: 'Cancel',
      quickAddSupplierSave: 'Save supplier',
      quickAddSupplierSuccess: 'Supplier created and selected',
      addCategoryPlaceholder: 'Category name',
      addCategoryOption: ' New category',
      addCategoryInlineAction: 'New category',
      quickAddCategoryTitle: 'Add category',
      quickAddCategoryDescription: 'Create a category without leaving this expense. It will be selected automatically.',
      quickAddCategoryNameLabel: 'Category name',
      quickAddCategoryCancel: 'Cancel',
      quickAddCategorySave: 'Save category',
      quickAddCategorySuccess: 'Category created and selected',
      selectPlaceholder: 'Select',
      noneOption: 'None',
      invoiceSearch: 'Search linked invoice',
      invoiceSearchPlaceholder: 'Search by invoice number, client name, or amount...',
      invoiceSearchLoading: 'Searching invoices...',
      invoiceNoResults: 'No invoice matches this search.',
      requiredFieldsError: 'Total amount (incl. VAT), date, and category are required to finalize the draft.',
      paymentMethodRequiredOnFinalizePaid: 'Payment method is required when finalizing as paid.',
      paidByRequiredWithPayment: 'Paid by is required when payment status is Paid or Partial.',
      saveFailed: 'Failed to save expense',
      createSupplierFailed: 'Failed to create supplier',
      createCategoryFailed: 'Failed to create category',
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
      description: 'Renseignez les champs requis. Finalisation du brouillon : montant, date et catégorie.',
      amountInclVat: 'Montant TTC (total ticket)',
      amountInclVatHint: 'Saisissez le montant final visible sur le reçu (TTC).',
      amountExclVat: 'Montant HT (calculé automatiquement)',
      amountExclVatHint: 'Calculé à partir du montant TTC et du taux TVA.',
      vatAmountPreview: 'Montant TVA (aperçu)',
      vatRate: 'Taux TVA',
      vatRateHint: 'Vous pouvez saisir n’importe quel taux TVA (exemple : 10).',
      expenseDate: 'Date de dépense',
      supplier: 'Fournisseur (optionnel)',
      category: 'Catégorie',
      requiredBadge: 'Requise',
      categoryRequiredTitle: 'Catégorie de dépense ',
      categoryRequiredHint: 'Sélectionnez la catégorie maintenant. Ce champ est obligatoire pour finaliser un brouillon.',
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
      receiptPreviewTitle: 'Aperçu du reçu',
      receiptPreviewDescription: 'Gardez le reçu visible pendant que vous complétez les champs de dépense.',
      receiptPreviewMobileDescription: 'Ouvrez le reçu en plein écran quand vous devez lire les détails, puis revenez au formulaire.',
      receiptPreviewUnavailable: 'Ce type de reçu ne peut pas être prévisualisé ici.',
      openReceipt: 'Ouvrir le reçu',
      viewReceiptFullScreen: 'Voir le reçu en plein écran',
      extraSection: 'Classification et notes',
      create: 'Créer la dépense',
      createAndValidate: 'Créer la dépense',
      save: 'Enregistrer',
      saveDraft: 'Sauvegarder brouillon',
      activateDraft: 'Finaliser le brouillon',
      activateAndPayDraft: 'Finaliser et payer',
      createSuccess: 'Dépense créée',
      createDraftSuccess: 'Brouillon enregistré',
      updateSuccess: 'Dépense mise à jour',
      activateSuccess: 'Dépense finalisée',
      activateAndPaySuccess: 'Dépense finalisée et payée',
      finalizeDraftPaymentSection: 'Paiement à la finalisation',
      alreadyPaidLabel: 'Déjà payée',
      alreadyPaidHint: 'Si activé, la finalisation enregistre immédiatement le paiement complet.',
      cameraDraftTitle: 'Photo du reçu',
      cameraDraftDescription: 'Prenez une photo du reçu, vérifiez-la, puis sauvegardez un brouillon rapide ou continuez dans le formulaire.',
      cameraDraftAction: 'Prendre une photo',
      cameraDraftLoading: 'Enregistrement du brouillon...',
      cameraDraftSuccess: 'Brouillon créé depuis la photo',
      cameraDraftFailed: 'Échec création brouillon depuis la photo',
      cameraDraftUnsupportedFile: 'Type de fichier non supporté. Autorisés : PDF, JPEG, PNG, HEIC.',
      cameraDraftFileTooLarge: `Fichier trop volumineux. Maximum ${formatFileSizeMb(EXPENSE_MAX_FILE_SIZE_BYTES)} MB`,
      cameraCaptureReadyTitle: 'Reçu capturé',
      cameraCaptureReadyDescription: 'Choisissez si vous voulez enregistrer un brouillon rapide maintenant ou continuer dans le formulaire.',
      cameraCaptureAttachedDescription: 'Cette photo sera jointe lors de l’enregistrement de la dépense.',
      cameraCaptureContinue: 'Continuer dans le formulaire',
      cameraCaptureRetake: 'Reprendre la photo',
      cameraCaptureRemove: 'Retirer la photo',
      cameraCapturePendingChoice: 'Choisissez quoi faire avec cette photo avant de créer la dépense.',
      cameraCapturePreviewAlt: 'Aperçu du reçu capturé',
      cameraCaptureAttachFailedAfterCreate:
        'Dépense créée, mais le reçu n’a pas pu être joint. Ouvrez la dépense pour le téléverser à nouveau.',
      cancel: 'Annuler',
      confirmEditTitle: 'Confirmer la mise à jour',
      confirmEditDescriptionDefault: "Cette action enregistre vos modifications et met à jour l'historique.",
      confirmEditDescriptionActivate: 'Cette action finalise le brouillon et le rend exploitable.',
      confirmEditDescriptionActivateAndPay: 'Cette action finalise le brouillon et enregistre immédiatement le paiement complet.',
      confirmEditDescriptionPaidFinancialWarning:
        'Attention : des valeurs financieres ont ete modifiees sur une depense payee. Cela peut impacter les totaux payes et la coherence comptable.',
      confirmEditDescriptionPaidFinancialSummary: (paid: string, remaining: string) =>
        `Historique paye conserve a ${paid}. Nouveau solde restant projete : ${remaining}.`,
      confirmEditCancel: 'Annuler',
      confirmEditAction: 'Confirmer',
      addSupplier: 'Ajout rapide fournisseur',
      addSupplierPlaceholder: 'Nom du fournisseur',
      createSupplier: 'Ajouter',
      addSupplierOption: '+ Ajouter un nouveau fournisseur',
      addSupplierInlineAction: 'Nouveau fournisseur',
      quickAddSupplierTitle: 'Ajouter un fournisseur',
      quickAddSupplierDescription: 'Créez un fournisseur sans quitter cette dépense. Il sera sélectionné automatiquement.',
      quickAddSupplierNameLabel: 'Nom du fournisseur',
      quickAddSupplierCancel: 'Annuler',
      quickAddSupplierSave: 'Enregistrer',
      quickAddSupplierSuccess: 'Fournisseur créé et sélectionné',
      addCategoryPlaceholder: 'Nom de la catégorie',
      addCategoryOption: '+ Nouvelle catégorie',
      addCategoryInlineAction: '+ Nouvelle catégorie',
      quickAddCategoryTitle: 'Ajouter une catégorie',
      quickAddCategoryDescription: 'Créez une catégorie sans quitter cette dépense. Elle sera sélectionnée automatiquement.',
      quickAddCategoryNameLabel: 'Nom de la catégorie',
      quickAddCategoryCancel: 'Annuler',
      quickAddCategorySave: 'Enregistrer la catégorie',
      quickAddCategorySuccess: 'Catégorie créée et sélectionnée',
      selectPlaceholder: 'Sélectionner',
      noneOption: 'Aucun',
      invoiceSearch: 'Recherche facture liée',
      invoiceSearchPlaceholder: 'Rechercher par numéro, client ou montant...',
      invoiceSearchLoading: 'Recherche des factures...',
      invoiceNoResults: 'Aucune facture ne correspond à cette recherche.',
      requiredFieldsError: 'Montant TTC, date et catégorie requis pour finaliser le brouillon.',
      paymentMethodRequiredOnFinalizePaid: 'Le mode de paiement est requis pour finaliser comme payée.',
      paidByRequiredWithPayment: 'Le champ payé par est requis lorsque le statut est Payé ou Partiel.',
      saveFailed: 'Échec enregistrement dépense',
      createSupplierFailed: 'Échec création fournisseur',
      createCategoryFailed: 'Échec création catégorie',
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

  const amountInclVat = toTwoDecimals(toNonNegativeNumber(values.amountInclVat));
  const vatRate = toNonNegativeNumber(values.vatRate);
  const vatDivisor = 1 + vatRate / 100;
  const amountExclVat = vatDivisor > 0 ? toTwoDecimals(amountInclVat / vatDivisor) : 0;
  const vatAmount = toTwoDecimals(Math.max(amountInclVat - amountExclVat, 0));
  const amountPaid = toNonNegativeNumber(values.amountPaid);
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
  const isPaidExpenseEdit =
    mode === 'edit' && initialExpense?.status === 'active' && initialExpense?.paymentStatus === 'paid';
  const initialAmountInclVat = toTwoDecimals((initialExpense?.amountInclVatCents || 0) / 100);
  const initialVatRate =
    typeof initialExpense?.vatRate === 'number' && Number.isFinite(initialExpense.vatRate)
      ? initialExpense.vatRate
      : 0;
  const hasPaidFinancialImpactChange =
    isPaidExpenseEdit &&
    (Math.abs(amountInclVat - initialAmountInclVat) > 0.0001 || Math.abs(vatRate - initialVatRate) > 0.0001);
  const projectedPaidTotalAfterFinancialEdit = toTwoDecimals(Math.min(amountPaidFromHistory, amountInclVat));
  const projectedRemainingAfterFinancialEdit = toTwoDecimals(
    Math.max(amountInclVat - projectedPaidTotalAfterFinancialEdit, 0)
  );

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

  const supplierOptions = useMemo(() => {
    if (!inlineCreatedSupplier) {
      return suppliers;
    }

    if (suppliers.some((supplier) => supplier._id === inlineCreatedSupplier._id)) {
      return suppliers;
    }

    return [inlineCreatedSupplier, ...suppliers];
  }, [inlineCreatedSupplier, suppliers]);

  const categoryOptions = useMemo(() => {
    if (!inlineCreatedCategory) {
      return categories;
    }

    if (categories.some((category) => category._id === inlineCreatedCategory._id)) {
      return categories;
    }

    return [inlineCreatedCategory, ...categories];
  }, [categories, inlineCreatedCategory]);

  function updateField<K extends keyof FormValues>(field: K, next: FormValues[K]) {
    setValues((previous) => ({ ...previous, [field]: next }));
  }

  function handleAmountInclVatFocus(event: FocusEvent<HTMLInputElement>) {
    if (!amountInclVatFirstFocusRef.current) {
      return;
    }

    if (isLikelyMobileViewport()) {
      return;
    }

    amountInclVatFirstFocusRef.current = false;

    requestAnimationFrame(() => {
      if (document.activeElement !== event.currentTarget) {
        return;
      }

      event.currentTarget.select();
    });
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

  useEffect(() => {
    if (!isDraftEditMode || finalizeAsPaid) {
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
  }, [finalizeAsPaid, isDraftEditMode]);

  useEffect(() => {
    if (!isDraftEditMode || !finalizeAsPaid) {
      return;
    }

    setValues((previous) => {
      if (previous.paidAt) {
        return previous;
      }

      return {
        ...previous,
        paidAt: toInputDateFromDate(new Date()),
      };
    });
  }, [finalizeAsPaid, isDraftEditMode]);

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
      amountInclVat > 0 &&
      Boolean(values.expenseDate) &&
      Boolean(values.categoryId)
    );
  }

  function requestSubmit(saveTarget: SaveTarget, event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (mode === 'create' && pendingCameraCapture?.decisionRequired) {
      setError(t.cameraCapturePendingChoice);
      return;
    }

    if (mode === 'edit') {
      if (initialExpense?.status === 'draft') {
        void submit(saveTarget);
        return;
      }

      setConfirmTarget(saveTarget);
      setConfirmOpen(true);
      return;
    }

    void submit(saveTarget);
  }

  function clearPendingCameraCapture() {
    setPendingCameraCapture(null);
  }

  function handleContinueWithCapturedFile() {
    setError(null);
    setPendingCameraCapture((previous) =>
      previous
        ? {
            ...previous,
            decisionRequired: false,
          }
        : previous
    );
  }

  async function uploadCapturedFile(file: File): Promise<ExpenseAttachmentMetadata> {
    const mimeType = inferDraftMimeType(file);
    if (!mimeType) {
      throw new Error(t.cameraDraftUnsupportedFile);
    }

    if (file.size > EXPENSE_MAX_FILE_SIZE_BYTES) {
      throw new Error(t.cameraDraftFileTooLarge);
    }

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

    return {
      originalName: file.name,
      displayName: file.name,
      mimeType,
      extension,
      sizeBytes: file.size,
      storageKey: presignPayload.key,
      url: presignPayload.fileUrl,
      checksum: null,
    };
  }

  async function attachCapturedFileToExpense(expenseId: string, attachment: ExpenseAttachmentMetadata) {
    const attachmentResponse = await fetch(`/api/expenses/${expenseId}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attachment }),
    });

    const attachmentPayload = (await attachmentResponse.json().catch(() => null)) as
      | ExpenseAttachmentMutationResponse
      | null;

    if (!attachmentResponse.ok || !attachmentPayload?.success) {
      throw new Error(attachmentPayload?.message || t.cameraCaptureAttachFailedAfterCreate);
    }
  }

  async function createDraftFromCapturedFile(file: File) {
    setCameraDraftLoading(true);
    setError(null);

    try {
      const attachment = await uploadCapturedFile(file);

      const draftResponse = await fetch('/api/expenses/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachment,
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

    const mimeType = inferDraftMimeType(selectedFile);
    if (!mimeType) {
      setError(t.cameraDraftUnsupportedFile);
      toast.error(t.cameraDraftUnsupportedFile);
      return;
    }

    if (selectedFile.size > EXPENSE_MAX_FILE_SIZE_BYTES) {
      setError(t.cameraDraftFileTooLarge);
      toast.error(t.cameraDraftFileTooLarge);
      return;
    }

    setError(null);
    setPendingCameraCapture({
      file: selectedFile,
      mimeType,
      previewUrl: URL.createObjectURL(selectedFile),
      decisionRequired: true,
    });
  }

  function openSupplierQuickCreate() {
    setSupplierQuickCreateError(null);
    setSupplierQuickCreateName('');
    setSupplierQuickCreateOpen(true);
  }

  function handleSupplierSelectionChange(nextValue: string) {
    if (nextValue === ADD_SUPPLIER_OPTION_VALUE) {
      openSupplierQuickCreate();
      return;
    }

    updateField('supplierId', nextValue);
  }

  function openCategoryQuickCreate() {
    setCategoryQuickCreateError(null);
    setCategoryQuickCreateName('');
    setCategoryQuickCreateOpen(true);
  }

  function handleCategorySelectionChange(nextValue: string) {
    if (nextValue === ADD_CATEGORY_OPTION_VALUE) {
      openCategoryQuickCreate();
      return;
    }

    updateField('categoryId', nextValue);
  }

  async function handleCreateSupplier() {
    const supplierName = supplierQuickCreateName.trim();
    if (!supplierName) return;

    setSupplierCreating(true);
    setSupplierQuickCreateError(null);
    setError(null);

    try {
      const created = await onCreateSupplier({ fullName: supplierName });
      setInlineCreatedSupplier(created);
      updateField('supplierId', created._id);
      setSupplierQuickCreateName('');
      setSupplierQuickCreateOpen(false);
      toast.success(t.quickAddSupplierSuccess);
    } catch (creationError) {
      const message = creationError instanceof Error ? creationError.message : t.createSupplierFailed;
      setSupplierQuickCreateError(message);
      toast.error(message);
    } finally {
      setSupplierCreating(false);
    }
  }

  async function handleCreateCategory() {
    const categoryName = categoryQuickCreateName.trim();
    if (!categoryName) return;

    setCategoryCreating(true);
    setCategoryQuickCreateError(null);
    setError(null);

    try {
      const created = await onCreateCategory({ name: categoryName });
      setInlineCreatedCategory(created);
      updateField('categoryId', created._id);
      setCategoryQuickCreateName('');
      setCategoryQuickCreateOpen(false);
      toast.success(t.quickAddCategorySuccess);
    } catch (creationError) {
      const message = creationError instanceof Error ? creationError.message : t.createCategoryFailed;
      setCategoryQuickCreateError(message);
      toast.error(message);
    } finally {
      setCategoryCreating(false);
    }
  }

  async function submit(saveTarget: SaveTarget, event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (saveTarget === 'activate' && !canActivateDraft()) {
      setError(t.requiredFieldsError);
      return;
    }

    if (mode === 'create' && pendingCameraCapture?.decisionRequired) {
      setError(t.cameraCapturePendingChoice);
      return;
    }

    setSaving(true);
    setSavingTarget(saveTarget);
    setError(null);

    try {
      let uploadedCameraAttachment: ExpenseAttachmentMetadata | null = null;

      if (mode === 'create' && pendingCameraCapture && !pendingCameraCapture.decisionRequired) {
        uploadedCameraAttachment = await uploadCapturedFile(pendingCameraCapture.file);
      }

      const payload: Record<string, unknown> = {
        amountExclVatCents: amountExclVat,
        vatRate,
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
          setSavingTarget(null);
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
            payload.paidAt = toInputDateFromDate(new Date());
          }
        }
      }

      if (mode === 'edit' && initialExpense?._id) {
        const shouldFinalizeAndPay = isDraftEditMode && saveTarget === 'activate' && finalizeAsPaid;

        if (hasPaidFinancialImpactChange) {
          payload.confirmPaidFinancialChange = true;
        }

        if (saveTarget === 'activate') {
          payload.status = 'active';

          if (isDraftEditMode) {
            if (finalizeAsPaid) {
              if (!values.paymentMethod) {
                setError(t.paymentMethodRequiredOnFinalizePaid);
                setSaving(false);
                setSavingTarget(null);
                return;
              }

              if (!values.paidBy) {
                setError(t.paidByRequiredWithPayment);
                setSaving(false);
                setSavingTarget(null);
                return;
              }

              payload.paymentStatus = 'paid';
              payload.amountPaidCents = amountInclVat;
              payload.paymentMethod = values.paymentMethod;
              payload.paidBy = values.paidBy;
              payload.paidAt = values.paidAt || toInputDateFromDate(new Date());
            } else {
              payload.paymentStatus = 'unpaid';
              payload.amountPaidCents = 0;
              payload.paymentMethod = undefined;
              payload.paidBy = undefined;
              payload.paidAt = undefined;
            }
          }
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
        toast.success(
          saveTarget === 'activate'
            ? shouldFinalizeAndPay
              ? t.activateAndPaySuccess
              : t.activateSuccess
            : t.updateSuccess
        );
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

      const createdExpenseId = getExpenseIdFromPayload(result.expense);
      let attachmentErrorMessage: string | null = null;

      if (uploadedCameraAttachment) {
        if (createdExpenseId) {
          try {
            await attachCapturedFileToExpense(createdExpenseId, uploadedCameraAttachment);
          } catch (attachmentError) {
            attachmentErrorMessage =
              attachmentError instanceof Error
                ? attachmentError.message
                : t.cameraCaptureAttachFailedAfterCreate;
          }
        } else {
          attachmentErrorMessage = t.cameraCaptureAttachFailedAfterCreate;
        }
      }

      dispatchExpenseRefresh(createdExpenseId);
      await onSaved(result.expense);
      toast.success(saveTarget === 'draft' ? t.createDraftSuccess : t.createSuccess);

      if (attachmentErrorMessage) {
        toast.error(attachmentErrorMessage);
      }

      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.saveFailed);
    } finally {
      setSaving(false);
      setSavingTarget(null);
    }
  }

  const title = mode === 'create' ? t.createTitle : t.editTitle;
  const selectClassName = 'h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm';
  const receiptPreviewAttachment: ExpenseReceiptAttachment | null =
    mode === 'edit' ? initialExpense?.attachments?.[0] ?? null : null;
  const hasReceiptPreviewAttachment = Boolean(receiptPreviewAttachment);

  const isSupplierFlow = uiFlow === 'supplier_expense';
  const isManualFlow = uiFlow === 'manual_expense_note';
  const isClientProjectFlow = uiFlow === 'client_project';
  const hasPendingCameraCapture = Boolean(pendingCameraCapture);
  const captureDecisionPending = Boolean(pendingCameraCapture?.decisionRequired);
  const canPreviewCapturedImage = Boolean(
    pendingCameraCapture && pendingCameraCapture.mimeType.startsWith('image/')
  );
  const canPreviewCapturedReceiptFullscreen = Boolean(
    pendingCameraCapture && (pendingCameraCapture.mimeType.startsWith('image/') || pendingCameraCapture.mimeType === 'application/pdf')
  );
  const isSavingDefault = saving && savingTarget === 'default';
  const isSavingDraft = saving && savingTarget === 'draft';
  const isSavingActivate = saving && savingTarget === 'activate';

  const uiFlowLabel =
    isManualFlow ? t.flowManualTitle : isClientProjectFlow ? t.flowClientTitle : t.flowSupplierTitle;

  const flowCardClass =
    'w-full rounded-xl border border-border/70 p-4 text-left transition-colors hover:border-primary hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  if (step === 'select-type') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-1rem)] gap-3 p-4 pr-4 sm:max-w-lg sm:gap-4 sm:p-5 sm:pr-12">
          <DialogHeader className="pr-8">
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
      <DialogContent
        data-disable-keyboard-scroll="true"
        className={cn(
          '[--app-keyboard-inset-height:0px] w-[calc(100%-1rem)] max-h-[calc(var(--app-viewport-height)-1rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))] gap-3 p-4 pr-4 scroll-pb-24 sm:max-h-[calc(var(--app-viewport-height)-2rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))] sm:gap-4 sm:p-5 sm:pr-12',
          hasReceiptPreviewAttachment
            ? 'flex min-h-0 flex-col overflow-hidden sm:max-w-5xl lg:max-w-6xl'
            : 'overflow-x-hidden overflow-y-auto sm:max-w-2xl'
        )}
      >
        <DialogHeader className="pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{t.description}</DialogDescription>
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

        <div
          className={cn(
            hasReceiptPreviewAttachment
              ? 'flex min-h-0 flex-1 flex-col gap-3 md:grid md:grid-cols-[minmax(260px,0.95fr)_minmax(0,1.1fr)] lg:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.1fr)]'
              : 'contents'
          )}
        >
          {receiptPreviewAttachment ? (
            <>
              <div className="rounded-xl border border-sky-200/75 bg-sky-50/55 p-3 dark:border-sky-900/40 dark:bg-sky-950/18 md:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">{t.receiptPreviewTitle}</p>
                    <p className="text-xs text-muted-foreground">{t.receiptPreviewMobileDescription}</p>
                    <p className="truncate text-xs text-muted-foreground">{receiptPreviewAttachment.displayName}</p>
                  </div>
                </div>
                <div className="mt-3 h-[30dvh] min-h-40 overflow-hidden rounded-lg border border-border/70 bg-background">
                  {isInlineImageMimeType(receiptPreviewAttachment.mimeType) ? (
                    <InteractiveReceiptImage
                      src={receiptPreviewAttachment.url}
                      alt={receiptPreviewAttachment.displayName}
                      locale={locale}
                      maxScale={8}
                      className="h-full w-full rounded-none border-0"
                    />
                  ) : isInlinePdfMimeType(receiptPreviewAttachment.mimeType) ? (
                    <iframe
                      src={receiptPreviewAttachment.url}
                      title={receiptPreviewAttachment.displayName}
                      className="h-full w-full"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-start justify-center gap-2 p-4 text-sm">
                      <p className="font-medium">{receiptPreviewAttachment.displayName}</p>
                      <p className="text-xs text-muted-foreground">{t.receiptPreviewUnavailable}</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                    onClick={() =>
                      setReceiptViewerAttachment({
                        name: receiptPreviewAttachment.displayName,
                        url: receiptPreviewAttachment.url,
                        mimeType: receiptPreviewAttachment.mimeType,
                      })
                    }
                  >
                    {t.viewReceiptFullScreen}
                  </Button>
                  <Button asChild type="button" variant="outline" className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap">
                    <a href={receiptPreviewAttachment.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLinkIcon className="size-3.5" />
                      {t.openReceipt}
                    </a>
                  </Button>
                </div>
              </div>

              <aside className="hidden h-[34dvh] min-h-40 shrink-0 flex-col rounded-xl border border-sky-200/75 bg-sky-50/55 p-3 dark:border-sky-900/40 dark:bg-sky-950/18 md:flex md:h-full md:min-h-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold">{t.receiptPreviewTitle}</p>
                  <p className="text-xs text-muted-foreground">{t.receiptPreviewDescription}</p>
                  <p className="truncate text-xs text-muted-foreground">{receiptPreviewAttachment.displayName}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() =>
                      setReceiptViewerAttachment({
                        name: receiptPreviewAttachment.displayName,
                        url: receiptPreviewAttachment.url,
                        mimeType: receiptPreviewAttachment.mimeType,
                      })
                    }
                  >
                    {t.viewReceiptFullScreen}
                  </Button>
                  <Button asChild type="button" variant="outline" size="sm" className="h-8 px-2 text-xs">
                    <a href={receiptPreviewAttachment.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLinkIcon className="size-3.5" />
                      <span className="hidden sm:inline">{t.openReceipt}</span>
                    </a>
                  </Button>
                </div>
              </div>

              <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-lg border border-border/70 bg-background">
                {isInlineImageMimeType(receiptPreviewAttachment.mimeType) ? (
                  <InteractiveReceiptImage
                    src={receiptPreviewAttachment.url}
                    alt={receiptPreviewAttachment.displayName}
                    locale={locale}
                    maxScale={8}
                    className="h-full w-full rounded-none border-0"
                  />
                ) : isInlinePdfMimeType(receiptPreviewAttachment.mimeType) ? (
                  <iframe
                    src={receiptPreviewAttachment.url}
                    title={receiptPreviewAttachment.displayName}
                    className="h-full w-full"
                  />
                ) : (
                  <div className="flex h-full flex-col items-start justify-center gap-2 p-4 text-sm">
                    <p className="font-medium">{receiptPreviewAttachment.displayName}</p>
                    <p className="text-xs text-muted-foreground">{t.receiptPreviewUnavailable}</p>
                    <Button asChild type="button" variant="outline" size="sm">
                      <a href={receiptPreviewAttachment.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLinkIcon className="size-3.5" />
                        {t.openReceipt}
                      </a>
                    </Button>
                  </div>
                )}
              </div>
              </aside>
            </>
          ) : null}

        <form
          className={cn(
            'space-y-4 pb-4 scroll-pb-24',
            hasReceiptPreviewAttachment && 'min-h-0 flex-1 overflow-y-auto pr-1'
          )}
          onSubmit={(event) => requestSubmit('default', event)}
        >
          {mode === 'create' && isManualFlow ? (
            <div
              className={cn(
                'rounded-xl border p-3',
                hasPendingCameraCapture
                  ? 'border-primary/20 bg-primary/5'
                  : 'border-amber-200/80 bg-amber-50/55 dark:border-amber-900/40 dark:bg-amber-950/20'
              )}
            >
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">
                  {hasPendingCameraCapture ? t.cameraCaptureReadyTitle : t.cameraDraftTitle}
                </p>
                <p className="text-xs text-muted-foreground">
                  {hasPendingCameraCapture
                    ? captureDecisionPending
                      ? t.cameraCaptureReadyDescription
                      : t.cameraCaptureAttachedDescription
                    : t.cameraDraftDescription}
                </p>
              </div>
              {pendingCameraCapture ? (
                <div className="mt-3 space-y-3">
                  {canPreviewCapturedImage ? (
                    <Image
                      src={pendingCameraCapture.previewUrl}
                      alt={t.cameraCapturePreviewAlt}
                      width={960}
                      height={720}
                      unoptimized
                      className="h-48 w-full rounded-lg border border-border/60 object-cover"
                    />
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/60 bg-background/80 px-3 py-4">
                      <p className="text-sm font-medium">{pendingCameraCapture.file.name}</p>
                      <p className="text-xs text-muted-foreground">{pendingCameraCapture.mimeType}</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {canPreviewCapturedReceiptFullscreen ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                        onClick={() =>
                          setReceiptViewerAttachment({
                            name: pendingCameraCapture.file.name,
                            url: pendingCameraCapture.previewUrl,
                            mimeType: pendingCameraCapture.mimeType,
                          })
                        }
                        disabled={saving || cameraDraftLoading}
                      >
                        {t.viewReceiptFullScreen}
                      </Button>
                    ) : null}

                    {captureDecisionPending ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                          onClick={() => void createDraftFromCapturedFile(pendingCameraCapture.file)}
                          disabled={saving || cameraDraftLoading}
                        >
                          {cameraDraftLoading ? <Loader2Icon className="size-4 animate-spin" /> : <ReceiptIcon className="size-4" />}
                          {cameraDraftLoading ? t.cameraDraftLoading : t.saveDraft}
                        </Button>
                        <Button
                          type="button"
                          className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                          onClick={handleContinueWithCapturedFile}
                          disabled={saving || cameraDraftLoading}
                        >
                          {t.cameraCaptureContinue}
                        </Button>
                      </>
                    ) : null}

                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={saving || cameraDraftLoading}
                    >
                      {t.cameraCaptureRetake}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                      onClick={clearPendingCameraCapture}
                      disabled={saving || cameraDraftLoading}
                    >
                      {t.cameraCaptureRemove}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full justify-start whitespace-normal px-3 py-2 text-left sm:h-8 sm:w-auto sm:justify-center sm:whitespace-nowrap"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={saving || cameraDraftLoading}
                  >
                    <ReceiptIcon className="size-4" />
                    {t.cameraDraftAction}
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          {/* === Financial fields === */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t.amountInclVat}</Label>
              <Input
                inputMode="decimal"
                autoComplete="off"
                value={values.amountInclVat}
                onChange={(event) => updateField('amountInclVat', sanitizeDecimalInput(event.target.value))}
                onFocus={handleAmountInclVatFocus}
                className="text-base font-semibold"
              />
              <p className="text-xs text-muted-foreground">{t.amountInclVatHint}</p>
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
              <p className="text-xs text-muted-foreground">{t.vatRateHint}</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t.amountExclVat}</Label>
              <Input
                type="number"
                value={values.amountInclVat ? amountExclVat.toFixed(2) : ''}
                readOnly
                className="bg-muted/30 font-medium"
              />
              <p className="text-xs text-muted-foreground">{t.amountExclVatHint}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 sm:col-span-1">
              <p className="text-xs text-muted-foreground">{t.vatAmountPreview}</p>
              <p className="mt-1 text-sm font-semibold">
                {values.amountInclVat ? vatAmount.toFixed(2) : '-'}
              </p>
            </div>
          </div>

          {/* Date + Due date */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

          <div
            className={cn(
              'space-y-3 rounded-2xl border px-3.5 py-3.5 shadow-sm',
              values.categoryId
                ? 'border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/15'
                : 'border-amber-300/85 bg-amber-50/70 dark:border-amber-900/55 dark:bg-amber-950/25'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
              <Label htmlFor="expense-required-category" className="text-sm font-semibold">
                {t.categoryRequiredTitle}
              </Label>
              <p className="text-xs text-muted-foreground">{t.categoryRequiredHint}</p>
              </div>
              <span className="rounded-full border border-amber-300/70 bg-amber-100/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                {t.requiredBadge}
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                id="expense-required-category"
                className={cn(selectClassName, 'sm:flex-1')}
                value={values.categoryId}
                onChange={(event) => handleCategorySelectionChange(event.target.value)}
              >
                <option value="">{t.selectPlaceholder}</option>
                <option value={ADD_CATEGORY_OPTION_VALUE}>{t.addCategoryOption}</option>
                {categoryOptions.map((category) => (
                  <option key={category._id} value={category._id}>
                    {resolveExpenseCategoryNameByLocale(category, locale)}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-10 sm:w-auto sm:whitespace-nowrap"
                onClick={openCategoryQuickCreate}
                disabled={categoryCreating || saving || cameraDraftLoading}
              >
                <PlusIcon className="size-4" />
                {t.addCategoryInlineAction}
              </Button>
            </div>
          </div>

          {/* === Supplier flow: supplier === */}
          {isSupplierFlow ? (
            <div className="space-y-1.5">
              <Label>{t.supplier}</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  className={cn(selectClassName, 'sm:flex-1')}
                  value={values.supplierId}
                  onChange={(event) => handleSupplierSelectionChange(event.target.value)}
                >
                  <option value="">{t.selectPlaceholder}</option>
                  <option value={ADD_SUPPLIER_OPTION_VALUE}>{t.addSupplierOption}</option>
                  {supplierOptions.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>
                      {supplier.fullName}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-10 sm:w-auto sm:whitespace-nowrap"
                  onClick={openSupplierQuickCreate}
                  disabled={supplierCreating || saving || cameraDraftLoading}
                >
                  <PlusIcon className="size-4" />
                  {t.addSupplierInlineAction}
                </Button>
              </div>
            </div>
          ) : null}

          {/* === Manual flow: payment === */}
          {isManualFlow ? (
            <div className="space-y-3">
              {mode === 'create' ? (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {values.paymentStatus === 'partial' ? (
                        <div className="space-y-1.5">
                          <Label>{t.amountPaid}</Label>
                          <Input
                            inputMode="decimal"
                            autoComplete="off"
                            value={values.amountPaid}
                            onChange={(event) => updateField('amountPaid', sanitizeDecimalInput(event.target.value))}
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
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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

          {/* === Client/Project flow: client + project === */}
          {isClientProjectFlow ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1.5">
                      <Label>{t.supplierRef}</Label>
                      <Input
                        value={values.supplierRef}
                        onChange={(event) => updateField('supplierRef', event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {values.paymentStatus === 'partial' ? (
                            <div className="space-y-1.5">
                              <Label>{t.amountPaid}</Label>
                              <Input
                                inputMode="decimal"
                                autoComplete="off"
                                value={values.amountPaid}
                                onChange={(event) => updateField('amountPaid', sanitizeDecimalInput(event.target.value))}
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
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        className={cn(selectClassName, 'sm:flex-1')}
                        value={values.supplierId}
                        onChange={(event) => handleSupplierSelectionChange(event.target.value)}
                      >
                        <option value="">{t.selectPlaceholder}</option>
                        <option value={ADD_SUPPLIER_OPTION_VALUE}>{t.addSupplierOption}</option>
                        {supplierOptions.map((supplier) => (
                          <option key={supplier._id} value={supplier._id}>
                            {supplier.fullName}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-10 sm:w-auto sm:whitespace-nowrap"
                        onClick={openSupplierQuickCreate}
                        disabled={supplierCreating || saving || cameraDraftLoading}
                      >
                        <PlusIcon className="size-4" />
                        {t.addSupplierInlineAction}
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

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>{t.supplier}</Label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          className={cn(selectClassName, 'sm:flex-1')}
                          value={values.supplierId}
                          onChange={(event) => handleSupplierSelectionChange(event.target.value)}
                        >
                          <option value="">{t.selectPlaceholder}</option>
                          <option value={ADD_SUPPLIER_OPTION_VALUE}>{t.addSupplierOption}</option>
                          {supplierOptions.map((supplier) => (
                            <option key={supplier._id} value={supplier._id}>
                              {supplier.fullName}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-10 sm:w-auto sm:whitespace-nowrap"
                          onClick={openSupplierQuickCreate}
                          disabled={supplierCreating || saving || cameraDraftLoading}
                        >
                          <PlusIcon className="size-4" />
                          {t.addSupplierInlineAction}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t.supplierRef}</Label>
                      <Input
                        value={values.supplierRef}
                        onChange={(event) => updateField('supplierRef', event.target.value)}
                      />
                    </div>
                  </div>

                  {mode === 'create' ? (
                    <div className="space-y-3 border-t border-border/50 pt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.paymentSection}</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {values.paymentStatus === 'partial' ? (
                            <div className="space-y-1.5">
                              <Label>{t.amountPaid}</Label>
                              <Input
                                inputMode="decimal"
                                autoComplete="off"
                                value={values.amountPaid}
                                onChange={(event) => updateField('amountPaid', sanitizeDecimalInput(event.target.value))}
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
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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

          {isDraftEditMode ? (
            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.finalizeDraftPaymentSection}</p>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="expense-finalize-already-paid"
                  checked={finalizeAsPaid}
                  onCheckedChange={(checked) => setFinalizeAsPaid(Boolean(checked))}
                  disabled={saving}
                />
                <div className="space-y-1">
                  <Label htmlFor="expense-finalize-already-paid" className="cursor-pointer text-sm font-medium">
                    {t.alreadyPaidLabel}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t.alreadyPaidHint}</p>
                </div>
              </div>

              {finalizeAsPaid ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter className="gap-3 sm:justify-between">
            <div>
              {mode === 'create' ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                  onClick={() => {
                    clearPendingCameraCapture();
                    setStep('select-type');
                  }}
                  disabled={saving}
                >
                  {t.back}
                </Button>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                {t.cancel}
              </Button>

              {mode === 'create' ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                    onClick={() => requestSubmit('draft')}
                    disabled={saving || cameraDraftLoading || captureDecisionPending}
                  >
                    {isSavingDraft ? <Loader2Icon className="size-4 animate-spin" /> : null}
                    {t.saveDraft}
                  </Button>
                  <Button
                    type="submit"
                    className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                    disabled={saving || cameraDraftLoading || captureDecisionPending}
                  >
                    {isSavingDefault ? <Loader2Icon className="size-4 animate-spin" /> : null}
                    {t.createAndValidate}
                  </Button>
                </>
              ) : mode === 'edit' && initialExpense?.status === 'draft' ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                    onClick={() => requestSubmit('default')}
                    disabled={saving}
                  >
                    {isSavingDefault ? <Loader2Icon className="size-4 animate-spin" /> : null}
                    {t.saveDraft}
                  </Button>
                  <Button
                    type="button"
                    className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                    onClick={() => requestSubmit('activate')}
                    disabled={saving}
                  >
                    {isSavingActivate ? <Loader2Icon className="size-4 animate-spin" /> : null}
                    {finalizeAsPaid ? t.activateAndPayDraft : t.activateDraft}
                  </Button>
                </>
              ) : (
                <Button
                  type="submit"
                  className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                  disabled={saving}
                >
                  {isSavingDefault ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  {t.save}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
        </div>

        <Dialog
          open={supplierQuickCreateOpen}
          onOpenChange={(nextOpen) => {
            if (supplierCreating && !nextOpen) {
              return;
            }

            setSupplierQuickCreateOpen(nextOpen);
            if (!nextOpen) {
              setSupplierQuickCreateName('');
              setSupplierQuickCreateError(null);
            }
          }}
        >
          <DialogContent className="w-[calc(100%-1rem)] gap-3 p-4 pr-4 sm:max-w-md sm:gap-4 sm:p-5 sm:pr-12">
            <DialogHeader className="pr-8">
              <DialogTitle>{t.quickAddSupplierTitle}</DialogTitle>
              <DialogDescription>{t.quickAddSupplierDescription}</DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="expense-quick-supplier-name">{t.quickAddSupplierNameLabel}</Label>
              <Input
                id="expense-quick-supplier-name"
                value={supplierQuickCreateName}
                onChange={(event) => setSupplierQuickCreateName(event.target.value)}
                placeholder={t.addSupplierPlaceholder}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (!supplierCreating && supplierQuickCreateName.trim()) {
                      void handleCreateSupplier();
                    }
                  }
                }}
                autoFocus
              />
            </div>

            {supplierQuickCreateError ? <p className="text-sm text-destructive">{supplierQuickCreateError}</p> : null}

            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                onClick={() => {
                  setSupplierQuickCreateOpen(false);
                  setSupplierQuickCreateName('');
                  setSupplierQuickCreateError(null);
                }}
                disabled={supplierCreating}
              >
                {t.quickAddSupplierCancel}
              </Button>
              <Button
                type="button"
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                onClick={() => void handleCreateSupplier()}
                disabled={supplierCreating || !supplierQuickCreateName.trim()}
              >
                {supplierCreating ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
                {t.quickAddSupplierSave}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={categoryQuickCreateOpen}
          onOpenChange={(nextOpen) => {
            if (categoryCreating && !nextOpen) {
              return;
            }

            setCategoryQuickCreateOpen(nextOpen);
            if (!nextOpen) {
              setCategoryQuickCreateName('');
              setCategoryQuickCreateError(null);
            }
          }}
        >
          <DialogContent className="w-[calc(100%-1rem)] gap-3 p-4 pr-4 sm:max-w-md sm:gap-4 sm:p-5 sm:pr-12">
            <DialogHeader className="pr-8">
              <DialogTitle>{t.quickAddCategoryTitle}</DialogTitle>
              <DialogDescription>{t.quickAddCategoryDescription}</DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="expense-quick-category-name">{t.quickAddCategoryNameLabel}</Label>
              <Input
                id="expense-quick-category-name"
                value={categoryQuickCreateName}
                onChange={(event) => setCategoryQuickCreateName(event.target.value)}
                placeholder={t.addCategoryPlaceholder}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (!categoryCreating && categoryQuickCreateName.trim()) {
                      void handleCreateCategory();
                    }
                  }
                }}
                autoFocus
              />
            </div>

            {categoryQuickCreateError ? <p className="text-sm text-destructive">{categoryQuickCreateError}</p> : null}

            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                onClick={() => {
                  setCategoryQuickCreateOpen(false);
                  setCategoryQuickCreateName('');
                  setCategoryQuickCreateError(null);
                }}
                disabled={categoryCreating}
              >
                {t.quickAddCategoryCancel}
              </Button>
              <Button
                type="button"
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                onClick={() => void handleCreateCategory()}
                disabled={categoryCreating || !categoryQuickCreateName.trim()}
              >
                {categoryCreating ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
                {t.quickAddCategorySave}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {mode === 'edit' ? (
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.confirmEditTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmTarget === 'activate'
                    ? finalizeAsPaid
                      ? t.confirmEditDescriptionActivateAndPay
                      : t.confirmEditDescriptionActivate
                    : hasPaidFinancialImpactChange
                      ? t.confirmEditDescriptionPaidFinancialWarning
                      : t.confirmEditDescriptionDefault}
                </AlertDialogDescription>
                {confirmTarget !== 'activate' && hasPaidFinancialImpactChange ? (
                  <div className="rounded-md border border-amber-300/70 bg-amber-50/80 p-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                    {t.confirmEditDescriptionPaidFinancialSummary(
                      formatCurrencyFromUnits(projectedPaidTotalAfterFinancialEdit, locale),
                      formatCurrencyFromUnits(projectedRemainingAfterFinancialEdit, locale)
                    )}
                  </div>
                ) : null}
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-3">
                <AlertDialogCancel asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                    disabled={saving}
                  >
                    {t.confirmEditCancel}
                  </Button>
                </AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button
                    type="button"
                    className={cn(
                      'h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap',
                      confirmTarget !== 'activate' && hasPaidFinancialImpactChange
                        ? 'bg-amber-600 text-white hover:bg-amber-700 hover:text-white'
                        : undefined
                    )}
                    disabled={saving}
                    onClick={() => {
                      setConfirmOpen(false);
                      void submit(confirmTarget);
                    }}
                  >
                    {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                    {confirmTarget === 'activate'
                      ? finalizeAsPaid
                        ? t.activateAndPayDraft
                        : t.activateDraft
                      : t.confirmEditAction}
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}

        <AttachmentPreviewDialog
          open={Boolean(receiptViewerAttachment)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setReceiptViewerAttachment(null);
            }
          }}
          attachment={receiptViewerAttachment}
          locale={locale}
        />
      </DialogContent>
    </Dialog>
  );
}
