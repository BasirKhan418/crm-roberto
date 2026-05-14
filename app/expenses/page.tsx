'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';

import {
  ArchiveIcon,
  CameraIcon,
  CheckCircle2Icon,
  CopyIcon,
  ExternalLinkIcon,
  FilePlus2Icon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react';

import CrmShell from '@/components/crm-shell';
import { ExpenseFormDialog } from '@/components/expenses/expense-form-dialog';
import { ExpenseMoneyDisplay } from '@/components/expenses/expense-money-display';
import { ExpenseStatusBadge } from '@/components/expenses/expense-status-badge';
import { MarkPaidDialog } from '@/components/expenses/mark-paid-dialog';
import { useLocale } from '@/components/providers/locale-provider';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuthMe } from '@/hooks/useAuthMe';
import { ExpenseDetail } from '@/hooks/useExpenseDetail';
import { createInlineExpenseSupplier, useExpenseLookups } from '@/hooks/useExpenseLookups';
import { ExpenseListItem, useExpenses } from '@/hooks/useExpenses';
import { useIsMobile } from '@/hooks/use-mobile';
import { EXPENSE_PAYMENT_STATUS, EXPENSE_STATUS } from '@/lib/expenses/constants';
import {
  EXPENSE_ALLOWED_MIME_TYPES,
  EXPENSE_MAX_FILE_SIZE_BYTES,
  formatFileSizeMb,
  getExpenseFileExtension,
  isExpenseMimeTypeAllowed,
} from '@/lib/expenses/upload';
import { hasPermission } from '@/lib/permissions';

type UploadStatus =
  | 'queued'
  | 'presigning'
  | 'uploading'
  | 'creating_draft'
  | 'success'
  | 'error';

type UploadItem = {
  id: string;
  file: File;
  fileName: string;
  status: UploadStatus;
  progress: number;
  source: 'photo' | 'import' | 'drop';
  error: string | null;
  expenseId: string | null;
};

type PresignResponse = {
  success: boolean;
  message?: string;
  uploadUrl?: string;
  fileUrl?: string;
  key?: string;
};

type DraftResponse = {
  success: boolean;
  message?: string;
  expense?: { _id?: string };
};

type GenericApiResponse = {
  success: boolean;
  message?: string;
  expense?: Record<string, unknown>;
};

const extensionToMime: Record<string, (typeof EXPENSE_ALLOWED_MIME_TYPES)[number]> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};

const ACCEPTED_FILES = '.pdf,.jpg,.jpeg,.png,.heic';

function createUploadId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function inferMimeType(file: File): (typeof EXPENSE_ALLOWED_MIME_TYPES)[number] | null {
  if (isExpenseMimeTypeAllowed(file.type)) {
    return file.type as (typeof EXPENSE_ALLOWED_MIME_TYPES)[number];
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return extensionToMime[extension] || null;
}

function formatDateDisplay(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR');
}

function getSupplierName(expense: ExpenseListItem) {
  if (typeof expense.supplierId === 'object' && expense.supplierId) {
    return expense.supplierId.fullName || expense.supplierId.companyName || '-';
  }

  return '-';
}

function getCategoryName(expense: ExpenseListItem) {
  if (typeof expense.categoryId === 'object' && expense.categoryId) {
    return expense.categoryId.name || '-';
  }

  return '-';
}

function getSortByOptions(locale: 'en' | 'fr') {
  if (locale === 'fr') {
    return [
      { value: 'expenseDate', label: 'Date depense' },
      { value: 'amountInclVatCents', label: 'Montant TTC' },
      { value: 'supplierRef', label: 'Reference' },
      { value: 'status', label: 'Statut' },
      { value: 'createdAt', label: 'Date creation' },
    ];
  }

  return [
    { value: 'expenseDate', label: 'Expense date' },
    { value: 'amountInclVatCents', label: 'Amount incl. VAT' },
    { value: 'supplierRef', label: 'Reference' },
    { value: 'status', label: 'Status' },
    { value: 'createdAt', label: 'Created at' },
  ];
}

export default function ExpensesPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const { user, loading: authLoading } = useAuthMe();
  const isMobile = useIsMobile();

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [sortBy, setSortBy] = useState('expenseDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseDetail | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState<ExpenseListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseListItem | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, paymentStatusFilter, categoryFilter, supplierFilter, periodStart, periodEnd, sortBy, sortOrder, limit]);

  const canViewExpenses = hasPermission(user?.role, 'expenses.view');
  const canManageExpenses = hasPermission(user?.role, 'expenses.manage');

  const {
    categories,
    suppliers,
    clients,
    invoices,
    loading: lookupsLoading,
    error: lookupsError,
    refetch: refetchLookups,
  } = useExpenseLookups(undefined, 80);

  const { expenses, pagination, loading, error, refetch } = useExpenses({
    page,
    limit,
    status: statusFilter ? (statusFilter as (typeof EXPENSE_STATUS)[number]) : undefined,
    paymentStatus: paymentStatusFilter ? (paymentStatusFilter as (typeof EXPENSE_PAYMENT_STATUS)[number]) : undefined,
    categoryId: categoryFilter || undefined,
    supplierId: supplierFilter || undefined,
    periodStart: periodStart || undefined,
    periodEnd: periodEnd || undefined,
    search: debouncedSearch || undefined,
    sortBy,
    sortOrder,
  });

  useEffect(() => {
    if (pagination.totalPages > 0 && page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [page, pagination.totalPages]);

  const t = {
    en: {
      shellTitle: 'Expenses',
      heading: 'Expenses Workspace',
      subtitle: 'Capture files, create manual entries, and manage the full expense lifecycle.',
      forbiddenTitle: 'You do not have access to expenses',
      forbiddenHelp: 'Ask an administrator to grant expenses permissions.',
      takePhoto: 'Take photo',
      takePhotoHint: 'Mobile-first capture for receipts.',
      importFile: 'Import file',
      importFileHint: 'Upload PDF/JPEG/PNG/HEIC and create one draft per file.',
      forwardEmail: 'Forward email',
      forwardEmailHint: 'Mailbox ingestion endpoint is ready for phase integration.',
      dragDrop: 'Drag and drop',
      dragDropHint: 'Drop files here on desktop to create draft expenses quickly.',
      dragDropMobileHint: 'Desktop entry point. Use Import or Take photo on mobile.',
      createManual: 'Create manually',
      createManualHint: 'Open the full manual expense form.',
      copy: 'Copy',
      copied: 'Copied',
      pendingSetup: 'Setup pending',
      browseFiles: 'Browse files',
      choosePhoto: 'Capture photo',
      uploadQueueTitle: 'Upload Queue',
      uploadQueueSubtitle: 'Track progress, retry failures, and open created drafts.',
      retry: 'Retry',
      openDraft: 'Open draft',
      filtersTitle: 'Filters and sorting',
      searchLabel: 'Search',
      searchPlaceholder: 'Supplier, reference, notes...',
      statusLabel: 'Status',
      paymentStatusLabel: 'Payment status',
      categoryLabel: 'Category',
      supplierLabel: 'Supplier',
      periodStartLabel: 'Period start',
      periodEndLabel: 'Period end',
      sortByLabel: 'Sort by',
      sortOrderLabel: 'Order',
      rowsPerPage: 'Rows',
      clearFilters: 'Clear',
      asc: 'Ascending',
      desc: 'Descending',
      all: 'All',
      listTitle: 'Expenses list',
      listSubtitle: 'Complete list with actions, drill-down, and payment controls.',
      refresh: 'Refresh',
      noExpenses: 'No expenses found for the selected filters.',
      tableDate: 'Date',
      tableSupplier: 'Supplier',
      tableCategory: 'Category',
      tableReference: 'Reference',
      tableAmount: 'Incl. VAT',
      tablePayment: 'Payment',
      tableState: 'State',
      tableAttachments: 'Files',
      tableAction: 'Actions',
      open: 'Open',
      edit: 'Edit',
      duplicate: 'Duplicate',
      archive: 'Archive',
      markPaid: 'Mark paid',
      delete: 'Delete',
      noReference: '-',
      pageInfo: (current: number, total: number, count: number) => `Page ${current}/${total || 1} - ${count} items`,
      previous: 'Previous',
      next: 'Next',
      fileTooLarge: `File too large. Maximum ${formatFileSizeMb(EXPENSE_MAX_FILE_SIZE_BYTES)} MB`,
      unsupportedFile: 'Unsupported file type. Allowed: PDF, JPEG, PNG, HEIC.',
      failedPresign: 'Unable to create upload URL',
      failedUpload: 'File upload failed',
      failedDraft: 'Unable to create draft expense',
      copiedEmail: 'Forward address copied',
      mobileCaptureNote: 'If camera capture is not supported on your browser, select an image file manually.',
      actionDuplicateSuccess: 'Expense duplicated',
      actionCreateSuccess: 'Expense created',
      actionUpdateSuccess: 'Expense updated',
      actionArchiveSuccess: 'Expense archived',
      actionDeleteSuccess: 'Expense deleted',
      markPaidSuccess: 'Expense marked as paid',
      actionFailed: 'Action failed',
      editLoadFailed: 'Failed to load expense detail for editing',
      confirmArchive: 'Archive this expense?',
      confirmDelete: 'Delete this expense? This cannot be undone.',
      confirmDeleteTitle: 'Confirm expense deletion',
      confirmDeleteDescription: (label: string) =>
        `You are about to permanently remove this expense (${label}). This action cannot be undone.`,
      confirmDeleteCancel: 'Cancel',
      confirmDeleteAction: 'Delete expense',
      lookupsLoading: 'Loading lookups...',
      lookupsErrorTitle: 'Lookup data unavailable',
    },
    fr: {
      shellTitle: 'Depenses',
      heading: 'Espace Depenses',
      subtitle: 'Capturez des fichiers, creez des depenses manuelles et gerez tout le cycle de vie.',
      forbiddenTitle: "Vous n'avez pas acces aux depenses",
      forbiddenHelp: "Demandez a un administrateur d'activer les permissions depenses.",
      takePhoto: 'Prendre une photo',
      takePhotoHint: 'Capture mobile pour les recus.',
      importFile: 'Importer un fichier',
      importFileHint: 'Upload PDF/JPEG/PNG/HEIC et creation d\'un brouillon par fichier.',
      forwardEmail: 'Transferer par email',
      forwardEmailHint: 'Le point d\'ingestion est pret pour la phase suivante.',
      dragDrop: 'Glisser-deposer',
      dragDropHint: 'Deposez des fichiers ici sur desktop pour creer des brouillons.',
      dragDropMobileHint: 'Point d\'entree desktop. Utilisez Importer ou Photo sur mobile.',
      createManual: 'Creer manuellement',
      createManualHint: 'Ouvre le formulaire complet de depense.',
      copy: 'Copier',
      copied: 'Copie',
      pendingSetup: 'Configuration en attente',
      browseFiles: 'Parcourir',
      choosePhoto: 'Capturer',
      uploadQueueTitle: 'File d\'upload',
      uploadQueueSubtitle: 'Suivez la progression, relancez les echecs, et ouvrez les brouillons crees.',
      retry: 'Relancer',
      openDraft: 'Ouvrir brouillon',
      filtersTitle: 'Filtres et tri',
      searchLabel: 'Recherche',
      searchPlaceholder: 'Fournisseur, reference, notes...',
      statusLabel: 'Statut',
      paymentStatusLabel: 'Paiement',
      categoryLabel: 'Categorie',
      supplierLabel: 'Fournisseur',
      periodStartLabel: 'Debut periode',
      periodEndLabel: 'Fin periode',
      sortByLabel: 'Trier par',
      sortOrderLabel: 'Ordre',
      rowsPerPage: 'Lignes',
      clearFilters: 'Effacer',
      asc: 'Croissant',
      desc: 'Decroissant',
      all: 'Tous',
      listTitle: 'Liste des depenses',
      listSubtitle: 'Liste complete avec actions, detail et controle paiement.',
      refresh: 'Actualiser',
      noExpenses: 'Aucune depense pour ces filtres.',
      tableDate: 'Date',
      tableSupplier: 'Fournisseur',
      tableCategory: 'Categorie',
      tableReference: 'Reference',
      tableAmount: 'TTC',
      tablePayment: 'Paiement',
      tableState: 'Etat',
      tableAttachments: 'Fichiers',
      tableAction: 'Actions',
      open: 'Ouvrir',
      edit: 'Modifier',
      duplicate: 'Dupliquer',
      archive: 'Archiver',
      markPaid: 'Marquer payee',
      delete: 'Supprimer',
      noReference: '-',
      pageInfo: (current: number, total: number, count: number) => `Page ${current}/${total || 1} - ${count} elements`,
      previous: 'Precedent',
      next: 'Suivant',
      fileTooLarge: `Fichier trop volumineux. Maximum ${formatFileSizeMb(EXPENSE_MAX_FILE_SIZE_BYTES)} MB`,
      unsupportedFile: 'Type non supporte. Autorises: PDF, JPEG, PNG, HEIC.',
      failedPresign: "Impossible de generer l'URL d'upload",
      failedUpload: "Echec de l'upload",
      failedDraft: 'Impossible de creer le brouillon',
      copiedEmail: 'Adresse de transfert copiee',
      mobileCaptureNote: 'Si la capture camera est non supportee, choisissez une image manuellement.',
      actionDuplicateSuccess: 'Depense dupliquee',
      actionCreateSuccess: 'Depense creee',
      actionUpdateSuccess: 'Depense mise a jour',
      actionArchiveSuccess: 'Depense archivee',
      actionDeleteSuccess: 'Depense supprimee',
      markPaidSuccess: 'Depense marquee payee',
      actionFailed: 'Echec action',
      editLoadFailed: 'Impossible de charger la depense pour modification',
      confirmArchive: 'Archiver cette depense ?',
      confirmDelete: 'Supprimer cette depense ? Cette action est irreversible.',
      confirmDeleteTitle: 'Confirmer suppression depense',
      confirmDeleteDescription: (label: string) =>
        `Vous allez supprimer definitivement cette depense (${label}). Cette action est irreversible.`,
      confirmDeleteCancel: 'Annuler',
      confirmDeleteAction: 'Supprimer depense',
      lookupsLoading: 'Chargement des referentiels...',
      lookupsErrorTitle: 'Referentiels indisponibles',
    },
  }[locale];

  const sortByOptions = useMemo(() => getSortByOptions(locale), [locale]);

  const forwardAddress = useMemo(() => {
    if (!user?.companyId) {
      return 'expenses@ingest.crm-roberto.local';
    }

    return `expenses+${user.companyId}@ingest.crm-roberto.local`;
  }, [user?.companyId]);

  function updateUploadItem(id: string, patch: Partial<UploadItem>) {
    setUploads((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function resetInputValue(event: ChangeEvent<HTMLInputElement>) {
    event.target.value = '';
  }

  function validateFile(file: File): { mimeType: string | null; error: string | null } {
    if (file.size > EXPENSE_MAX_FILE_SIZE_BYTES) {
      return { mimeType: null, error: t.fileTooLarge };
    }

    const mimeType = inferMimeType(file);
    if (!mimeType) {
      return { mimeType: null, error: t.unsupportedFile };
    }

    return { mimeType, error: null };
  }

  async function createDraftFromFile(uploadId: string, file: File) {
    const validation = validateFile(file);
    if (validation.error || !validation.mimeType) {
      updateUploadItem(uploadId, {
        status: 'error',
        progress: 100,
        error: validation.error || t.unsupportedFile,
      });
      return;
    }

    try {
      updateUploadItem(uploadId, {
        status: 'presigning',
        progress: 20,
        error: null,
      });

      const presignResponse = await fetch('/api/expenses/upload-presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: validation.mimeType,
          fileSize: file.size,
        }),
      });

      const presignPayload = (await presignResponse.json().catch(() => null)) as PresignResponse | null;
      if (
        !presignResponse.ok ||
        !presignPayload?.success ||
        !presignPayload.uploadUrl ||
        !presignPayload.fileUrl ||
        !presignPayload.key
      ) {
        throw new Error(presignPayload?.message || t.failedPresign);
      }

      updateUploadItem(uploadId, {
        status: 'uploading',
        progress: 55,
      });

      const uploadResponse = await fetch(presignPayload.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': validation.mimeType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(t.failedUpload);
      }

      updateUploadItem(uploadId, {
        status: 'creating_draft',
        progress: 80,
      });

      const extension = getExpenseFileExtension(file.name, validation.mimeType);

      const draftResponse = await fetch('/api/expenses/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachment: {
            originalName: file.name,
            displayName: file.name,
            mimeType: validation.mimeType,
            extension,
            sizeBytes: file.size,
            storageKey: presignPayload.key,
            url: presignPayload.fileUrl,
            checksum: null,
          },
        }),
      });

      const draftPayload = (await draftResponse.json().catch(() => null)) as DraftResponse | null;
      if (!draftResponse.ok || !draftPayload?.success || !draftPayload.expense?._id) {
        throw new Error(draftPayload?.message || t.failedDraft);
      }

      updateUploadItem(uploadId, {
        status: 'success',
        progress: 100,
        expenseId: draftPayload.expense._id,
      });

      void refetch();
    } catch (uploadError) {
      updateUploadItem(uploadId, {
        status: 'error',
        progress: 100,
        error: uploadError instanceof Error ? uploadError.message : t.failedDraft,
      });
    }
  }

  function queueFiles(files: FileList | null, source: UploadItem['source']) {
    if (!files || files.length === 0 || !canManageExpenses) {
      return;
    }

    const newItems: UploadItem[] = Array.from(files).map((file) => ({
      id: createUploadId(),
      file,
      fileName: file.name,
      status: 'queued',
      progress: 0,
      source,
      error: null,
      expenseId: null,
    }));

    setUploads((previous) => [...newItems, ...previous]);

    for (const item of newItems) {
      void createDraftFromFile(item.id, item.file);
    }
  }

  function onPhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    queueFiles(event.target.files, 'photo');
    resetInputValue(event);
  }

  function onImportSelected(event: ChangeEvent<HTMLInputElement>) {
    queueFiles(event.target.files, 'import');
    resetInputValue(event);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    queueFiles(event.dataTransfer.files, 'drop');
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!isMobile) {
      setIsDragActive(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
  }

  async function copyForwardAddress() {
    try {
      await navigator.clipboard.writeText(forwardAddress);
      setCopyFeedback(t.copiedEmail);
      window.setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback(null);
    }
  }

  function setFeedback(type: 'success' | 'error', message: string) {
    setActionFeedback({ type, message });
    window.setTimeout(() => {
      setActionFeedback((previous) => {
        if (!previous || previous.message !== message) return previous;
        return null;
      });
    }, 3000);
  }

  async function openEditExpense(expenseId: string) {
    setActionLoadingId(expenseId);

    try {
      const response = await fetch(`/api/expenses/${expenseId}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as
        | {
            success: boolean;
            message?: string;
            expense?: ExpenseDetail;
          }
        | null;

      if (!response.ok || !payload?.success || !payload.expense) {
        throw new Error(payload?.message || t.editLoadFailed);
      }

      setEditingExpense(payload.expense);
      setEditDialogOpen(true);
    } catch (openError) {
      setFeedback('error', openError instanceof Error ? openError.message : t.editLoadFailed);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function runDuplicate(expenseId: string) {
    setActionLoadingId(expenseId);

    try {
      const response = await fetch(`/api/expenses/${expenseId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', copyAttachments: true }),
      });

      const payload = (await response.json().catch(() => null)) as GenericApiResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.actionFailed);
      }

      await refetch();
      setFeedback('success', t.actionDuplicateSuccess);
    } catch (duplicateError) {
      setFeedback('error', duplicateError instanceof Error ? duplicateError.message : t.actionFailed);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function runArchive(expenseId: string) {
    if (!window.confirm(t.confirmArchive)) {
      return;
    }

    setActionLoadingId(expenseId);

    try {
      const response = await fetch(`/api/expenses/${expenseId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' }),
      });

      const payload = (await response.json().catch(() => null)) as GenericApiResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.actionFailed);
      }

      await refetch();
      setFeedback('success', t.actionArchiveSuccess);
    } catch (archiveError) {
      setFeedback('error', archiveError instanceof Error ? archiveError.message : t.actionFailed);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function runDelete(expenseId: string) {
    setActionLoadingId(expenseId);

    try {
      const response = await fetch(`/api/expenses/${expenseId}?mode=delete`, {
        method: 'DELETE',
      });

      const payload = (await response.json().catch(() => null)) as GenericApiResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.actionFailed);
      }

      await refetch();
      setFeedback('success', t.actionDeleteSuccess);
    } catch (deleteError) {
      setFeedback('error', deleteError instanceof Error ? deleteError.message : t.actionFailed);
    } finally {
      setActionLoadingId(null);
    }
  }

  function resetFilters() {
    setSearchInput('');
    setStatusFilter('');
    setPaymentStatusFilter('');
    setCategoryFilter('');
    setSupplierFilter('');
    setPeriodStart('');
    setPeriodEnd('');
    setSortBy('expenseDate');
    setSortOrder('desc');
    setLimit(20);
    setPage(1);
  }

  if (authLoading) {
    return (
      <CrmShell title={t.shellTitle}>
        <div className="flex min-h-52 items-center justify-center">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      </CrmShell>
    );
  }

  if (!canViewExpenses) {
    return (
      <CrmShell title={t.shellTitle}>
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-lg">{t.forbiddenTitle}</CardTitle>
            <CardDescription>{t.forbiddenHelp}</CardDescription>
          </CardHeader>
        </Card>
      </CrmShell>
    );
  }

  return (
    <CrmShell title={t.shellTitle}>
      <div className="space-y-5">
        <section className="space-y-1.5">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.heading}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          <p className="text-xs text-muted-foreground">{t.mobileCaptureNote}</p>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t.takePhoto}</CardTitle>
              <CardDescription>{t.takePhotoHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                className="w-full"
                onClick={() => photoInputRef.current?.click()}
                disabled={!canManageExpenses}
              >
                <CameraIcon className="size-4" />
                {t.choosePhoto}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t.importFile}</CardTitle>
              <CardDescription>{t.importFileHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                className="w-full"
                variant="outline"
                onClick={() => importInputRef.current?.click()}
                disabled={!canManageExpenses}
              >
                <UploadIcon className="size-4" />
                {t.browseFiles}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t.forwardEmail}</CardTitle>
              <CardDescription>{t.forwardEmailHint}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="rounded-lg border border-border/60 bg-muted/30 px-2 py-1.5 text-xs font-medium text-foreground/80">
                {forwardAddress}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void copyForwardAddress()}>
                  <CopyIcon className="size-3.5" />
                  {copyFeedback ? t.copied : t.copy}
                </Button>
                <span className="text-[11px] text-muted-foreground">{t.pendingSetup}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t.dragDrop}</CardTitle>
              <CardDescription>{isMobile ? t.dragDropMobileHint : t.dragDropHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                role="presentation"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`flex min-h-24 items-center justify-center rounded-lg border border-dashed px-3 text-xs transition ${
                  isMobile
                    ? 'border-border/50 bg-muted/20 text-muted-foreground'
                    : isDragActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/70 bg-muted/10 text-muted-foreground'
                }`}
              >
                {isMobile ? t.dragDropMobileHint : t.dragDropHint}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t.createManual}</CardTitle>
              <CardDescription>{t.createManualHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                className="w-full"
                variant="secondary"
                onClick={() => setManualDialogOpen(true)}
                disabled={!canManageExpenses}
              >
                <FilePlus2Icon className="size-4" />
                {t.createManual}
              </Button>
            </CardContent>
          </Card>
        </section>

        <input
          ref={photoInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={onPhotoSelected}
          disabled={!canManageExpenses}
        />

        <input
          ref={importInputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_FILES}
          multiple
          onChange={onImportSelected}
          disabled={!canManageExpenses}
        />

        {uploads.length > 0 ? (
          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.uploadQueueTitle}</CardTitle>
              <CardDescription>{t.uploadQueueSubtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {uploads.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/60 p-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.status}
                        {item.source === 'photo' ? ' - camera' : item.source === 'drop' ? ' - drag/drop' : ' - import'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === 'success' ? (
                        <CheckCircle2Icon className="size-4 text-emerald-600" />
                      ) : item.status === 'error' ? (
                        <span className="text-xs text-destructive">{item.error}</span>
                      ) : (
                        <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${
                        item.status === 'error' ? 'bg-destructive' : 'bg-primary'
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    {item.status === 'error' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void createDraftFromFile(item.id, item.file)}
                      >
                        <RefreshCwIcon className="size-3.5" />
                        {t.retry}
                      </Button>
                    ) : null}

                    {item.status === 'success' && item.expenseId ? (
                      <Button asChild type="button" variant="outline" size="sm">
                        <Link href={`/expenses/${item.expenseId}`}>
                          <ExternalLinkIcon className="size-3.5" />
                          {t.openDraft}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.filtersTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <div className="space-y-1.5 md:col-span-2 xl:col-span-2">
                <Label>{t.searchLabel}</Label>
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder={t.searchPlaceholder}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t.statusLabel}</Label>
                <select
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="">{t.all}</option>
                  {EXPENSE_STATUS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>{t.paymentStatusLabel}</Label>
                <select
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  value={paymentStatusFilter}
                  onChange={(event) => setPaymentStatusFilter(event.target.value)}
                >
                  <option value="">{t.all}</option>
                  {EXPENSE_PAYMENT_STATUS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>{t.categoryLabel}</Label>
                <select
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="">{t.all}</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>{t.supplierLabel}</Label>
                <select
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  value={supplierFilter}
                  onChange={(event) => setSupplierFilter(event.target.value)}
                >
                  <option value="">{t.all}</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>
                      {supplier.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>{t.periodStartLabel}</Label>
                <Input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>{t.periodEndLabel}</Label>
                <Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>{t.sortByLabel}</Label>
                <select
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                >
                  {sortByOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>{t.sortOrderLabel}</Label>
                <select
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as 'asc' | 'desc')}
                >
                  <option value="asc">{t.asc}</option>
                  <option value="desc">{t.desc}</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Label>{t.rowsPerPage}</Label>
                <select
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  value={String(limit)}
                  onChange={(event) => setLimit(Number(event.target.value))}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </div>

              <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                {t.clearFilters}
              </Button>
            </div>

            {lookupsLoading ? <p className="text-xs text-muted-foreground">{t.lookupsLoading}</p> : null}
            {lookupsError ? (
              <p className="text-xs text-destructive">
                {t.lookupsErrorTitle}: {lookupsError}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">{t.listTitle}</CardTitle>
                <CardDescription>{t.listSubtitle}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {actionFeedback ? (
                  <p
                    className={`text-xs font-medium ${
                      actionFeedback.type === 'success' ? 'text-emerald-600' : 'text-destructive'
                    }`}
                  >
                    {actionFeedback.message}
                  </p>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                  <RefreshCwIcon className="size-3.5" />
                  {t.refresh}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex min-h-28 items-center justify-center">
                <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <ErrorMessage message={error} />
            ) : expenses.length === 0 ? (
              <EmptyState message={t.noExpenses} />
            ) : isMobile ? (
              <div className="space-y-2.5">
                {expenses.map((expense) => {
                  const rowLoading = actionLoadingId === expense._id;

                  return (
                    <div key={expense._id} className="rounded-xl border border-border/70 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{getSupplierName(expense)}</p>
                          <p className="text-xs text-muted-foreground">{formatDateDisplay(expense.expenseDate)}</p>
                        </div>
                        <ExpenseStatusBadge status={expense.status} paymentStatus={expense.paymentStatus} />
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md border border-border/60 p-2">
                          <p className="text-muted-foreground">{t.tableAmount}</p>
                          <ExpenseMoneyDisplay
                            cents={expense.amountInclVatCents || 0}
                            locale={locale === 'fr' ? 'fr-FR' : 'en-GB'}
                            className="text-sm font-medium"
                          />
                        </div>
                        <div className="rounded-md border border-border/60 p-2">
                          <p className="text-muted-foreground">{t.tablePayment}</p>
                          <p className="text-sm font-medium">{expense.paymentStatus}</p>
                        </div>
                        <div className="rounded-md border border-border/60 p-2">
                          <p className="text-muted-foreground">{t.tableCategory}</p>
                          <p className="truncate text-sm font-medium">{getCategoryName(expense)}</p>
                        </div>
                        <div className="rounded-md border border-border/60 p-2">
                          <p className="text-muted-foreground">{t.tableAttachments}</p>
                          <p className="text-sm font-medium">{expense.attachmentsCount || 0}</p>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Button asChild type="button" size="sm" variant="outline">
                          <Link href={`/expenses/${expense._id}`}>{t.open}</Link>
                        </Button>

                        <div className="flex items-center gap-1.5">
                          {rowLoading ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" /> : null}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="outline" size="icon" className="size-8" disabled={rowLoading}>
                                <MoreHorizontalIcon className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onSelect={() => router.push(`/expenses/${expense._id}`)}>
                                {t.open}
                              </DropdownMenuItem>
                              {canManageExpenses ? (
                                <DropdownMenuItem onSelect={() => void openEditExpense(expense._id)}>
                                  <PencilIcon className="size-4" />
                                  {t.edit}
                                </DropdownMenuItem>
                              ) : null}
                              {canManageExpenses ? (
                                <DropdownMenuItem onSelect={() => void runDuplicate(expense._id)}>
                                  <CopyIcon className="size-4" />
                                  {t.duplicate}
                                </DropdownMenuItem>
                              ) : null}
                              {canManageExpenses && expense.status !== 'archived' ? (
                                <DropdownMenuItem onSelect={() => void runArchive(expense._id)}>
                                  <ArchiveIcon className="size-4" />
                                  {t.archive}
                                </DropdownMenuItem>
                              ) : null}
                              {canManageExpenses && expense.paymentStatus !== 'paid' ? (
                                <DropdownMenuItem onSelect={() => setMarkPaidTarget(expense)}>
                                  <CheckCircle2Icon className="size-4" />
                                  {t.markPaid}
                                </DropdownMenuItem>
                              ) : null}
                              {canManageExpenses ? (
                                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(expense)}>
                                  <Trash2Icon className="size-4" />
                                  {t.delete}
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.tableDate}</TableHead>
                    <TableHead>{t.tableSupplier}</TableHead>
                    <TableHead>{t.tableCategory}</TableHead>
                    <TableHead>{t.tableReference}</TableHead>
                    <TableHead>{t.tableAmount}</TableHead>
                    <TableHead>{t.tablePayment}</TableHead>
                    <TableHead>{t.tableState}</TableHead>
                    <TableHead>{t.tableAttachments}</TableHead>
                    <TableHead className="text-right">{t.tableAction}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => {
                    const rowLoading = actionLoadingId === expense._id;

                    return (
                      <TableRow key={expense._id}>
                        <TableCell>{formatDateDisplay(expense.expenseDate)}</TableCell>
                        <TableCell className="max-w-44 truncate">{getSupplierName(expense)}</TableCell>
                        <TableCell className="max-w-44 truncate">{getCategoryName(expense)}</TableCell>
                        <TableCell className="max-w-44 truncate">{expense.supplierRef || t.noReference}</TableCell>
                        <TableCell>
                          <ExpenseMoneyDisplay cents={expense.amountInclVatCents || 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} />
                        </TableCell>
                        <TableCell>{expense.paymentStatus}</TableCell>
                        <TableCell>
                          <ExpenseStatusBadge status={expense.status} paymentStatus={expense.paymentStatus} />
                        </TableCell>
                        <TableCell>{expense.attachmentsCount || 0}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1.5">
                            {rowLoading ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" /> : null}
                            <Button asChild type="button" variant="ghost" size="sm">
                              <Link href={`/expenses/${expense._id}`}>{t.open}</Link>
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" size="icon" className="size-8" disabled={rowLoading}>
                                  <MoreHorizontalIcon className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onSelect={() => router.push(`/expenses/${expense._id}`)}>
                                  {t.open}
                                </DropdownMenuItem>
                                {canManageExpenses ? (
                                  <DropdownMenuItem onSelect={() => void openEditExpense(expense._id)}>
                                    <PencilIcon className="size-4" />
                                    {t.edit}
                                  </DropdownMenuItem>
                                ) : null}
                                {canManageExpenses ? (
                                  <DropdownMenuItem onSelect={() => void runDuplicate(expense._id)}>
                                    <CopyIcon className="size-4" />
                                    {t.duplicate}
                                  </DropdownMenuItem>
                                ) : null}
                                {canManageExpenses && expense.status !== 'archived' ? (
                                  <DropdownMenuItem onSelect={() => void runArchive(expense._id)}>
                                    <ArchiveIcon className="size-4" />
                                    {t.archive}
                                  </DropdownMenuItem>
                                ) : null}
                                {canManageExpenses && expense.paymentStatus !== 'paid' ? (
                                  <DropdownMenuItem onSelect={() => setMarkPaidTarget(expense)}>
                                    <CheckCircle2Icon className="size-4" />
                                    {t.markPaid}
                                  </DropdownMenuItem>
                                ) : null}
                                {canManageExpenses ? (
                                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(expense)}>
                                    <Trash2Icon className="size-4" />
                                    {t.delete}
                                  </DropdownMenuItem>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {expenses.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2">
                <p className="text-xs text-muted-foreground">
                  {t.pageInfo(page, pagination.totalPages || 1, pagination.total || expenses.length)}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                    disabled={page <= 1 || loading}
                  >
                    {t.previous}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((previous) => previous + 1)}
                    disabled={loading || (pagination.totalPages > 0 && page >= pagination.totalPages)}
                  >
                    {t.next}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <ExpenseFormDialog
        open={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
        mode="create"
        categories={categories}
        suppliers={suppliers}
        clients={clients}
        invoices={invoices}
        locale={locale}
        onCreateSupplier={async (input) => {
          const created = await createInlineExpenseSupplier(input);
          await refetchLookups();
          return created;
        }}
        onSaved={async () => {
          await Promise.all([refetch(), refetchLookups()]);
          setFeedback('success', t.actionCreateSuccess);
        }}
      />

      {editDialogOpen && editingExpense ? (
        <ExpenseFormDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              setEditingExpense(null);
            }
          }}
          mode="edit"
          initialExpense={editingExpense}
          categories={categories}
          suppliers={suppliers}
          clients={clients}
          invoices={invoices}
          locale={locale}
          onCreateSupplier={async (input) => {
            const created = await createInlineExpenseSupplier(input);
            await refetchLookups();
            return created;
          }}
          onSaved={async () => {
            await Promise.all([refetch(), refetchLookups()]);
            setFeedback('success', t.actionUpdateSuccess);
          }}
        />
      ) : null}

      <MarkPaidDialog
        open={Boolean(markPaidTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setMarkPaidTarget(null);
          }
        }}
        expenseId={markPaidTarget?._id || null}
        amountInclVatCents={markPaidTarget?.amountInclVatCents || 0}
        amountPaidCents={markPaidTarget?.amountPaidCents || 0}
        locale={locale}
        onSaved={async () => {
          await refetch();
          setFeedback('success', t.markPaidSuccess);
        }}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? t.confirmDeleteDescription(deleteTarget.supplierRef || getSupplierName(deleteTarget)) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={Boolean(deleteTarget && actionLoadingId === deleteTarget._id)}>
                {t.confirmDeleteCancel}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={!deleteTarget || actionLoadingId === deleteTarget._id}
                onClick={() => {
                  if (!deleteTarget) {
                    return;
                  }

                  const targetId = deleteTarget._id;
                  setDeleteTarget(null);
                  void runDelete(targetId);
                }}
              >
                {deleteTarget && actionLoadingId === deleteTarget._id ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : null}
                {t.confirmDeleteAction}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CrmShell>
  );
}
