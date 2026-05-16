'use client';

import Link from 'next/link';
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  ArchiveIcon,
  CameraIcon,
  CheckCircle2Icon,
  CopyIcon,
  ExternalLinkIcon,
  FilePlus2Icon,
  Loader2Icon,
  MoreHorizontalIcon,
  PaperclipIcon,
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
import KpiCards, { type KpiCard } from '@/components/ui/KpiCards';
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
import { Badge } from '@/components/ui/badge';
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

function getPaymentPillClass(paymentStatus: string, status: string) {
  if (status === 'draft' || status === 'archived') return 'bg-muted text-muted-foreground';
  if (paymentStatus === 'paid') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800';
  if (paymentStatus === 'partial') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800';
  return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800';
}

function getCardAccentClass(status: string, paymentStatus: string) {
  if (status === 'archived') return 'border-l-slate-400';
  if (status === 'draft') return 'border-l-amber-500';
  if (paymentStatus === 'paid') return 'border-l-emerald-500';
  if (paymentStatus === 'partial') return 'border-l-amber-400';
  return 'border-l-rose-500';
}

function getRemainingCents(expense: ExpenseListItem) {
  if (typeof expense.remainingBalanceCents === 'number') {
    return Math.max(0, expense.remainingBalanceCents);
  }

  return Math.max(0, (expense.amountInclVatCents || 0) - (expense.amountPaidCents || 0));
}

function getExpenseSurfaceClass(status: string, paymentStatus: string) {
  if (status === 'draft') {
    return 'border-amber-200/80 bg-amber-50/55 dark:border-amber-900/40 dark:bg-amber-950/20';
  }

  if (status === 'archived') {
    return 'border-slate-200/80 bg-slate-50/70 dark:border-slate-800/70 dark:bg-slate-900/35';
  }

  if (paymentStatus === 'paid') {
    return 'border-emerald-200/75 bg-emerald-50/45 dark:border-emerald-900/35 dark:bg-emerald-950/18';
  }

  if (paymentStatus === 'partial') {
    return 'border-amber-200/70 bg-amber-50/35 dark:border-amber-900/30 dark:bg-amber-950/15';
  }

  return 'border-rose-200/70 bg-rose-50/35 dark:border-rose-900/30 dark:bg-rose-950/15';
}

function getTableRowToneClass(status: string, paymentStatus: string) {
  if (status === 'draft') {
    return 'bg-amber-50/35 hover:bg-amber-100/40 dark:bg-amber-950/12 dark:hover:bg-amber-950/22';
  }

  if (status === 'archived') {
    return 'bg-slate-50/55 hover:bg-slate-100/55 dark:bg-slate-900/20 dark:hover:bg-slate-900/35';
  }

  if (paymentStatus === 'paid') {
    return 'bg-emerald-50/30 hover:bg-emerald-100/35 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/20';
  }

  if (paymentStatus === 'partial') {
    return 'bg-amber-50/20 hover:bg-amber-100/35 dark:bg-amber-950/8 dark:hover:bg-amber-950/18';
  }

  return 'bg-rose-50/25 hover:bg-rose-100/35 dark:bg-rose-950/10 dark:hover:bg-rose-950/22';
}

function getSortByOptions(locale: 'en' | 'fr') {
  if (locale === 'fr') {
    return [
      { value: 'expenseDate', label: 'Date dépense' },
      { value: 'amountInclVatCents', label: 'Montant TTC' },
      { value: 'supplierRef', label: 'Référence' },
      { value: 'status', label: 'Statut' },
      { value: 'createdAt', label: 'Date création' },
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

  const draftExpenses = useMemo(
    () => expenses.filter((expense) => expense.status === 'draft'),
    [expenses]
  );

  const unpaidExpenses = useMemo(
    () => expenses.filter((expense) => expense.status !== 'draft' && expense.status !== 'archived' && expense.paymentStatus === 'unpaid'),
    [expenses]
  );

  const partialExpenses = useMemo(
    () => expenses.filter((expense) => expense.status !== 'draft' && expense.status !== 'archived' && expense.paymentStatus === 'partial'),
    [expenses]
  );

  const paidExpenses = useMemo(
    () => expenses.filter((expense) => expense.status !== 'draft' && expense.status !== 'archived' && expense.paymentStatus === 'paid'),
    [expenses]
  );

  const totalsInView = useMemo(
    () =>
      expenses.reduce(
        (accumulator, expense) => {
          accumulator.totalTtc += Math.max(0, Math.round(expense.amountInclVatCents || 0));
          accumulator.totalPaid += Math.max(0, Math.round(expense.amountPaidCents || 0));
          accumulator.totalRemaining += getRemainingCents(expense);

          return accumulator;
        },
        { totalTtc: 0, totalPaid: 0, totalRemaining: 0 }
      ),
    [expenses]
  );

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
      uploadQueueSubtitle: 'Track progress, processing stage, retry failures, and open created drafts.',
      retry: 'Retry',
      openDraft: 'Open draft',
      openAndValidate: 'Open and validate',
      validateExpense: 'Validate expense',
      ocrVisibilityHint: 'Draft processing stage is shown during draft creation.',
      ocrReviewHint: 'Draft creation completed. Review values in the draft.',
      uploadStatusLabels: {
        queued: 'Queued',
        presigning: 'Preparing upload URL',
        uploading: 'Uploading file',
        creating_draft: 'Processing file + creating draft',
        success: 'Draft ready',
        error: 'Failed',
      },
      uploadSourceLabels: {
        photo: 'camera',
        drop: 'drag/drop',
        import: 'import',
      },
      draftsSectionTitle: 'Drafts to validate',
      draftsSectionSubtitle: 'Quick access to draft expenses with direct validation CTA.',
      draftsCountLabel: (count: number) => `${count} Draft${count > 1 ? 's' : ''}`,
      noDraftsInView: 'No draft in the current page.',
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
      paymentStatusLabels: { paid: 'Paid', unpaid: 'Unpaid', partial: 'Partial' },
      statusLabels: { draft: 'Draft', active: 'Active', archived: 'Archived' },
      kpiDrafts: 'Drafts',
      kpiUnpaid: 'Unpaid',
      kpiPartial: 'Partially paid',
      kpiPaid: 'Paid',
      kpiTotalTtc: 'Total incl. VAT in view',
      kpiTotalPaid: 'Paid in view',
      kpiTotalRemaining: 'Remaining in view',
      kpiScopeFootnote: (count: number, total: number) => `${count} shown / ${total} total`,
      tableRemaining: 'Remaining',
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
      addAttachment: 'Add attachment',
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
      shellTitle: 'Dépenses',
      heading: 'Espace Dépenses',
      subtitle: 'Capturez des fichiers, créez des dépenses manuelles et gérez tout le cycle de vie.',
      forbiddenTitle: "Vous n'avez pas accès aux dépenses",
      forbiddenHelp: "Demandez à un administrateur d'activer les permissions dépenses.",
      takePhoto: 'Prendre une photo',
      takePhotoHint: 'Capture mobile pour les reçus.',
      importFile: 'Importer un fichier',
      importFileHint: "Upload PDF/JPEG/PNG/HEIC et création d'un brouillon par fichier.",
      forwardEmail: 'Transférer par email',
      forwardEmailHint: "Le point d'ingestion est prêt pour la phase suivante.",
      dragDrop: 'Glisser-déposer',
      dragDropHint: 'Déposez des fichiers ici sur desktop pour créer des brouillons.',
      dragDropMobileHint: "Point d'entrée desktop. Utilisez Importer ou Photo sur mobile.",
      createManual: 'Créer manuellement',
      createManualHint: 'Ouvre le formulaire complet de dépense.',
      copy: 'Copier',
      copied: 'Copié',
      pendingSetup: 'Configuration en attente',
      browseFiles: 'Parcourir',
      choosePhoto: 'Capturer',
      uploadQueueTitle: "File d'upload",
      uploadQueueSubtitle: 'Suivez la progression, le statut de traitement, relancez les échecs, et ouvrez les brouillons créés.',
      retry: 'Relancer',
      openDraft: 'Ouvrir brouillon',
      openAndValidate: 'Ouvrir et valider',
      validateExpense: 'Valider la dépense',
      ocrVisibilityHint: 'Le statut de traitement est visible pendant la création du brouillon.',
      ocrReviewHint: 'Création du brouillon terminée. Vérifiez les valeurs dans le brouillon.',
      uploadStatusLabels: {
        queued: 'En file',
        presigning: "Préparation URL d'upload",
        uploading: 'Upload en cours',
        creating_draft: 'Traitement du fichier + création brouillon',
        success: 'Brouillon prêt',
        error: 'Échec',
      },
      uploadSourceLabels: {
        photo: 'caméra',
        drop: 'glisser-déposer',
        import: 'import',
      },
      draftsSectionTitle: 'Brouillons à valider',
      draftsSectionSubtitle: 'Accès rapide aux brouillons avec action directe de validation.',
      draftsCountLabel: (count: number) => `${count} brouillon${count > 1 ? 's' : ''}`,
      noDraftsInView: 'Aucun brouillon sur la page courante.',
      filtersTitle: 'Filtres et tri',
      searchLabel: 'Recherche',
      searchPlaceholder: 'Fournisseur, référence, notes...',
      statusLabel: 'Statut',
      paymentStatusLabel: 'Paiement',
      categoryLabel: 'Catégorie',
      supplierLabel: 'Fournisseur',
      periodStartLabel: 'Début période',
      periodEndLabel: 'Fin période',
      sortByLabel: 'Trier par',
      sortOrderLabel: 'Ordre',
      rowsPerPage: 'Lignes',
      clearFilters: 'Effacer',
      asc: 'Croissant',
      desc: 'Décroissant',
      all: 'Tous',
      listTitle: 'Liste des dépenses',
      listSubtitle: 'Liste complète avec actions, détail et contrôle paiement.',
      paymentStatusLabels: { paid: 'Payée', unpaid: 'Impayée', partial: 'Partiel' },
      statusLabels: { draft: 'Brouillon', active: 'Active', archived: 'Archivée' },
      kpiDrafts: 'Brouillons',
      kpiUnpaid: 'Impayées',
      kpiPartial: 'Paiement partiel',
      kpiPaid: 'Payées',
      kpiTotalTtc: 'Total TTC affiché',
      kpiTotalPaid: 'Payé affiché',
      kpiTotalRemaining: 'Reste affiché',
      kpiScopeFootnote: (count: number, total: number) => `${count} affichées / ${total} total`,
      tableRemaining: 'Restant',
      refresh: 'Actualiser',
      noExpenses: 'Aucune dépense pour ces filtres.',
      tableDate: 'Date',
      tableSupplier: 'Fournisseur',
      tableCategory: 'Catégorie',
      tableReference: 'Référence',
      tableAmount: 'TTC',
      tablePayment: 'Paiement',
      tableState: 'État',
      tableAttachments: 'Fichiers',
      tableAction: 'Actions',
      open: 'Ouvrir',
      edit: 'Modifier',
      addAttachment: 'Ajouter pièce jointe',
      duplicate: 'Dupliquer',
      archive: 'Archiver',
      markPaid: 'Marquer payée',
      delete: 'Supprimer',
      noReference: '-',
      pageInfo: (current: number, total: number, count: number) => `Page ${current}/${total || 1} - ${count} éléments`,
      previous: 'Précédent',
      next: 'Suivant',
      fileTooLarge: `Fichier trop volumineux. Maximum ${formatFileSizeMb(EXPENSE_MAX_FILE_SIZE_BYTES)} MB`,
      unsupportedFile: 'Type non supporté. Autorisés : PDF, JPEG, PNG, HEIC.',
      failedPresign: "Impossible de générer l'URL d'upload",
      failedUpload: "Échec de l'upload",
      failedDraft: 'Impossible de créer le brouillon',
      copiedEmail: 'Adresse de transfert copiée',
      mobileCaptureNote: 'Si la capture caméra est non supportée, choisissez une image manuellement.',
      actionDuplicateSuccess: 'Dépense dupliquée',
      actionCreateSuccess: 'Dépense créée',
      actionUpdateSuccess: 'Dépense mise à jour',
      actionArchiveSuccess: 'Dépense archivée',
      actionDeleteSuccess: 'Dépense supprimée',
      markPaidSuccess: 'Dépense marquée payée',
      actionFailed: 'Échec action',
      editLoadFailed: 'Impossible de charger la dépense pour modification',
      confirmArchive: 'Archiver cette dépense ?',
      confirmDelete: 'Supprimer cette dépense ? Cette action est irréversible.',
      confirmDeleteTitle: 'Confirmer suppression dépense',
      confirmDeleteDescription: (label: string) =>
        `Vous allez supprimer définitivement cette dépense (${label}). Cette action est irréversible.`,
      confirmDeleteCancel: 'Annuler',
      confirmDeleteAction: 'Supprimer dépense',
      lookupsLoading: 'Chargement des référentiels...',
      lookupsErrorTitle: 'Référentiels indisponibles',
    },
  }[locale];

  const sortByOptions = useMemo(() => getSortByOptions(locale), [locale]);

  const activeFiltersCount = useMemo(
    () =>
      [
        debouncedSearch,
        statusFilter,
        paymentStatusFilter,
        categoryFilter,
        supplierFilter,
        periodStart,
        periodEnd,
        sortBy !== 'expenseDate' ? sortBy : '',
        sortOrder !== 'desc' ? sortOrder : '',
      ].filter(Boolean).length,
    [debouncedSearch, statusFilter, paymentStatusFilter, categoryFilter, supplierFilter, periodStart, periodEnd, sortBy, sortOrder]
  );

  const expensesKpiCards = useMemo<KpiCard[]>(
    () => [
      {
        key: 'drafts',
        label: t.kpiDrafts,
        count: draftExpenses.length,
        amount: draftExpenses.reduce((sum, expense) => sum + Math.max(0, Math.round(expense.amountInclVatCents || 0)), 0),
        variant: 'orange-bold',
        icon: 'clock',
        active: statusFilter === 'draft',
        onClick: () => {
          setStatusFilter('draft');
          setPaymentStatusFilter('');
        },
      },
      {
        key: 'unpaid',
        label: t.kpiUnpaid,
        count: unpaidExpenses.length,
        amount: unpaidExpenses.reduce((sum, expense) => sum + getRemainingCents(expense), 0),
        variant: 'red-bold',
        icon: 'alert-triangle',
        active: paymentStatusFilter === 'unpaid' && !statusFilter,
        onClick: () => {
          setPaymentStatusFilter('unpaid');
          setStatusFilter('');
        },
      },
      {
        key: 'partial',
        label: t.kpiPartial,
        count: partialExpenses.length,
        amount: partialExpenses.reduce((sum, expense) => sum + getRemainingCents(expense), 0),
        variant: 'orange',
        icon: 'clock',
        active: paymentStatusFilter === 'partial' && !statusFilter,
        onClick: () => {
          setPaymentStatusFilter('partial');
          setStatusFilter('');
        },
      },
      {
        key: 'paid',
        label: t.kpiPaid,
        count: paidExpenses.length,
        amount: paidExpenses.reduce((sum, expense) => sum + Math.max(0, Math.round(expense.amountPaidCents || 0)), 0),
        variant: 'green-bold',
        icon: 'check-circle',
        active: paymentStatusFilter === 'paid' && !statusFilter,
        onClick: () => {
          setPaymentStatusFilter('paid');
          setStatusFilter('');
        },
      },
    ],
    [
      draftExpenses,
      paidExpenses,
      partialExpenses,
      paymentStatusFilter,
      statusFilter,
      t.kpiDrafts,
      t.kpiPartial,
      t.kpiPaid,
      t.kpiUnpaid,
      unpaidExpenses,
    ]
  );

  const expensesTotalsCards = useMemo<KpiCard[]>(
    () => [
      {
        key: 'visible-total-ttc',
        label: t.kpiTotalTtc,
        amount: totalsInView.totalTtc,
        variant: 'slate',
        icon: 'receipt',
        footnote: t.kpiScopeFootnote(expenses.length, pagination.total || expenses.length),
      },
      {
        key: 'visible-total-paid',
        label: t.kpiTotalPaid,
        amount: totalsInView.totalPaid,
        variant: 'green',
        icon: 'check-circle',
      },
      {
        key: 'visible-total-remaining',
        label: t.kpiTotalRemaining,
        amount: totalsInView.totalRemaining,
        variant: 'red',
        icon: 'alert-triangle',
      },
    ],
    [
      expenses.length,
      pagination.total,
      t,
      totalsInView.totalPaid,
      totalsInView.totalRemaining,
      totalsInView.totalTtc,
    ]
  );

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
      toast.success(t.actionDeleteSuccess);
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
        <section
          className="space-y-3 rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-amber-50/40 p-4 shadow-sm dark:border-slate-800/70 dark:from-slate-950/45 dark:via-slate-950/25 dark:to-amber-950/15"
          data-tour-expenses-header
        >
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.heading}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          <p className="text-xs text-muted-foreground">{t.mobileCaptureNote}</p>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-amber-200 bg-amber-100/70 px-2.5 py-1 font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200">
              {t.draftsCountLabel(draftExpenses.length)}
            </span>
            <span className="rounded-full border border-rose-200 bg-rose-100/70 px-2.5 py-1 font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-200">
              {t.paymentStatusLabels.unpaid}: {unpaidExpenses.length}
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-100/70 px-2.5 py-1 font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200">
              {t.paymentStatusLabels.paid}: {paidExpenses.length}
            </span>
          </div>
        </section>

        <section className="space-y-3" data-tour-expenses-kpis>
          <KpiCards cards={expensesKpiCards} locale={locale as 'en' | 'fr'} loading={loading} />
          {!loading ? <KpiCards cards={expensesTotalsCards} locale={locale as 'en' | 'fr'} cols={3} /> : null}
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" data-tour-expenses-capture>
          <Card size="sm" className="border-sky-200/80 bg-sky-50/60 dark:border-sky-900/40 dark:bg-sky-950/20">
            <CardHeader className="flex-1 pb-2">
              <CardTitle>{t.takePhoto}</CardTitle>
              <CardDescription className="text-xs">{t.takePhotoHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={() => photoInputRef.current?.click()}
                disabled={!canManageExpenses}
              >
                <CameraIcon className="size-4 shrink-0" />
                <span className="truncate">{t.choosePhoto}</span>
              </Button>
            </CardContent>
          </Card>

          <Card size="sm" className="border-teal-200/80 bg-teal-50/60 dark:border-teal-900/40 dark:bg-teal-950/20">
            <CardHeader className="flex-1 pb-2">
              <CardTitle>{t.importFile}</CardTitle>
              <CardDescription className="text-xs">{t.importFileHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                size="sm"
                className="w-full"
                variant="outline"
                onClick={() => importInputRef.current?.click()}
                disabled={!canManageExpenses}
              >
                <UploadIcon className="size-4 shrink-0" />
                <span className="truncate">{t.browseFiles}</span>
              </Button>
            </CardContent>
          </Card>

          <Card size="sm" className="border-amber-200/80 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20">
            <CardHeader className="flex-1 pb-2">
              <CardTitle>{t.forwardEmail}</CardTitle>
              <CardDescription className="text-xs">{t.forwardEmailHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => void copyForwardAddress()}>
                <CopyIcon className="size-4 shrink-0" />
                <span className="truncate">{copyFeedback ? t.copied : t.copy}</span>
              </Button>
            </CardContent>
          </Card>

          <div className="hidden lg:block">
            <Card size="sm" className="h-full border-slate-200/80 bg-slate-50/70 dark:border-slate-800/70 dark:bg-slate-950/25">
              <CardHeader className="flex-1 pb-2">
                <CardTitle>{t.dragDrop}</CardTitle>
                <CardDescription className="text-xs">{t.dragDropHint}</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  role="presentation"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`flex min-h-10 items-center justify-center rounded-lg border border-dashed px-3 text-xs transition ${
                    isDragActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-slate-300 bg-slate-100/70 text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300'
                  }`}
                >
                  {t.dragDropHint}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card size="sm" className="border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <CardHeader className="flex-1 pb-2">
              <CardTitle>{t.createManual}</CardTitle>
              <CardDescription className="text-xs">{t.createManualHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                size="sm"
                className="w-full"
                variant="secondary"
                onClick={() => setManualDialogOpen(true)}
                disabled={!canManageExpenses}
              >
                <FilePlus2Icon className="size-4 shrink-0" />
                <span className="truncate">{t.createManual}</span>
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
          <Card className="border-sky-200/80 bg-sky-50/45 dark:border-sky-900/35 dark:bg-sky-950/14">
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
                        {t.uploadStatusLabels[item.status as keyof typeof t.uploadStatusLabels] || item.status}
                        {' - '}
                        {t.uploadSourceLabels[item.source]}
                      </p>
                      {item.status === 'creating_draft' ? (
                        <p className="text-[11px] text-muted-foreground">{t.ocrVisibilityHint}</p>
                      ) : null}
                      {item.status === 'success' ? (
                        <p className="text-[11px] text-muted-foreground">{t.ocrReviewHint}</p>
                      ) : null}
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
                          {t.openAndValidate}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-amber-200/80 bg-amber-50/45 dark:border-amber-900/35 dark:bg-amber-950/14" data-tour-expenses-drafts>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">{t.draftsSectionTitle}</CardTitle>
                <CardDescription>{t.draftsSectionSubtitle}</CardDescription>
              </div>
              <Badge variant="secondary">{t.draftsCountLabel(draftExpenses.length)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {draftExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noDraftsInView}</p>
            ) : (
              draftExpenses.slice(0, 5).map((expense) => {
                const rowLoading = actionLoadingId === expense._id;

                return (
                  <div
                    key={expense._id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 ${getExpenseSurfaceClass(expense.status, expense.paymentStatus)}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{getSupplierName(expense)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateDisplay(expense.expenseDate)} · {getCategoryName(expense)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ExpenseMoneyDisplay
                        cents={expense.amountInclVatCents || 0}
                        locale={locale === 'fr' ? 'fr-FR' : 'en-GB'}
                        className="text-sm font-medium"
                      />
                      <Button asChild type="button" size="sm" variant="outline">
                        <Link href={`/expenses/${expense._id}`}>{t.openDraft}</Link>
                      </Button>
                      {canManageExpenses ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void openEditExpense(expense._id)}
                          disabled={rowLoading}
                        >
                          {rowLoading ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                          {t.validateExpense}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-slate-50/45 dark:border-slate-800/70 dark:bg-slate-950/16" data-tour-expenses-filters>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.filtersTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <div className="space-y-1.5 sm:col-span-2 xl:col-span-2">
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
                      {t.statusLabels[status as keyof typeof t.statusLabels] ?? status}
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
                      {t.paymentStatusLabels[status as keyof typeof t.paymentStatusLabels] ?? status}
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
                <Input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="h-8 text-sm" />
              </div>

              <div className="space-y-1.5">
                <Label>{t.periodEndLabel}</Label>
                <Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="h-8 text-sm" />
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
                {activeFiltersCount > 0 ? (
                  <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {activeFiltersCount}
                  </span>
                ) : null}
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

        <Card className="border-slate-200/80 bg-white/80 dark:border-slate-800/70 dark:bg-slate-950/12" data-tour-expenses-list>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{t.listTitle}</CardTitle>
                  <Badge variant="outline">{t.draftsCountLabel(draftExpenses.length)}</Badge>
                </div>
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
                    <div
                      key={expense._id}
                      className={`rounded-xl border border-l-4 p-3 pl-3.5 ${getCardAccentClass(expense.status, expense.paymentStatus)} ${getExpenseSurfaceClass(expense.status, expense.paymentStatus)}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{getSupplierName(expense)}</p>
                          <p className="text-xs text-muted-foreground">{formatDateDisplay(expense.expenseDate)}</p>
                        </div>
                        <ExpenseStatusBadge status={expense.status} paymentStatus={expense.paymentStatus} locale={locale} />
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
                          <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getPaymentPillClass(expense.paymentStatus, expense.status)}`}>
                            {t.paymentStatusLabels[expense.paymentStatus as keyof typeof t.paymentStatusLabels] ?? expense.paymentStatus}
                          </span>
                          {expense.paymentStatus === 'partial' && (expense.remainingBalanceCents ?? 0) > 0 ? (
                            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                              {t.tableRemaining}:{' '}
                              <ExpenseMoneyDisplay
                                cents={expense.remainingBalanceCents ?? 0}
                                locale={locale === 'fr' ? 'fr-FR' : 'en-GB'}
                                className="inline font-medium"
                              />
                            </p>
                          ) : null}
                        </div>
                        <div className="rounded-md border border-border/60 p-2">
                          <p className="text-muted-foreground">{t.tableCategory}</p>
                          <p className="truncate text-sm font-medium">{getCategoryName(expense)}</p>
                        </div>
                        <div className="rounded-md border border-border/60 p-2">
                          <p className="text-muted-foreground">{t.tableAttachments}</p>
                          <span className="inline-flex items-center gap-1 text-sm font-medium">
                            <PaperclipIcon className="size-3.5 text-muted-foreground" />
                            {expense.attachmentsCount || 0}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Button asChild type="button" size="sm" variant="outline">
                          <Link href={`/expenses/${expense._id}`}>{t.open}</Link>
                        </Button>

                        <div className="flex items-center gap-1.5">
                          {rowLoading ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" /> : null}
                          {canManageExpenses ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-8"
                                title={t.edit}
                                aria-label={t.edit}
                                onClick={() => void openEditExpense(expense._id)}
                                disabled={rowLoading}
                              >
                                <PencilIcon className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-8"
                                title={t.markPaid}
                                aria-label={t.markPaid}
                                onClick={() => setMarkPaidTarget(expense)}
                                disabled={rowLoading || expense.paymentStatus === 'paid'}
                              >
                                <CheckCircle2Icon className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-8"
                                title={t.duplicate}
                                aria-label={t.duplicate}
                                onClick={() => void runDuplicate(expense._id)}
                                disabled={rowLoading}
                              >
                                <CopyIcon className="size-4" />
                              </Button>
                              <Button asChild type="button" variant="outline" size="icon" className="size-8">
                                <Link
                                  href={`/expenses/${expense._id}?tab=attachments`}
                                  title={t.addAttachment}
                                  aria-label={t.addAttachment}
                                >
                                  <PaperclipIcon className="size-4" />
                                </Link>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button type="button" variant="outline" size="icon" className="size-8" disabled={rowLoading}>
                                    <MoreHorizontalIcon className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  {expense.status !== 'archived' ? (
                                    <DropdownMenuItem onSelect={() => void runArchive(expense._id)}>
                                      <ArchiveIcon className="size-4" />
                                      {t.archive}
                                    </DropdownMenuItem>
                                  ) : null}
                                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(expense)}>
                                    <Trash2Icon className="size-4" />
                                    {t.delete}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </>
                          ) : null}
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
                    <TableHead className="text-right">{t.tableAmount}</TableHead>
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
                      <TableRow key={expense._id} className={`cursor-pointer ${getTableRowToneClass(expense.status, expense.paymentStatus)}`}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateDisplay(expense.expenseDate)}</TableCell>
                        <TableCell className="max-w-44 truncate font-medium">{getSupplierName(expense)}</TableCell>
                        <TableCell className="max-w-44 truncate">{getCategoryName(expense)}</TableCell>
                        <TableCell className="max-w-44 truncate">
                          {expense.supplierRef ? (
                            expense.supplierRef
                          ) : (
                            <span className="text-muted-foreground/40">{t.noReference}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <ExpenseMoneyDisplay cents={expense.amountInclVatCents || 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="font-medium" />
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getPaymentPillClass(expense.paymentStatus, expense.status)}`}>
                            {t.paymentStatusLabels[expense.paymentStatus as keyof typeof t.paymentStatusLabels] ?? expense.paymentStatus}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ExpenseStatusBadge status={expense.status} paymentStatus={expense.paymentStatus} locale={locale} />
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 tabular-nums text-sm">
                            <PaperclipIcon className="size-3.5 shrink-0 text-muted-foreground" />
                            {expense.attachmentsCount || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1.5">
                            {rowLoading ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" /> : null}
                            <Button asChild type="button" variant="ghost" size="sm">
                              <Link href={`/expenses/${expense._id}`}>{t.open}</Link>
                            </Button>

                            {canManageExpenses ? (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="size-8"
                                  title={t.edit}
                                  aria-label={t.edit}
                                  onClick={() => void openEditExpense(expense._id)}
                                  disabled={rowLoading}
                                >
                                  <PencilIcon className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="size-8"
                                  title={t.markPaid}
                                  aria-label={t.markPaid}
                                  onClick={() => setMarkPaidTarget(expense)}
                                  disabled={rowLoading || expense.paymentStatus === 'paid'}
                                >
                                  <CheckCircle2Icon className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="size-8"
                                  title={t.duplicate}
                                  aria-label={t.duplicate}
                                  onClick={() => void runDuplicate(expense._id)}
                                  disabled={rowLoading}
                                >
                                  <CopyIcon className="size-4" />
                                </Button>
                                <Button asChild type="button" variant="outline" size="icon" className="size-8">
                                  <Link
                                    href={`/expenses/${expense._id}?tab=attachments`}
                                    title={t.addAttachment}
                                    aria-label={t.addAttachment}
                                  >
                                    <PaperclipIcon className="size-4" />
                                  </Link>
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="outline" size="icon" className="size-8" disabled={rowLoading}>
                                      <MoreHorizontalIcon className="size-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    {expense.status !== 'archived' ? (
                                      <DropdownMenuItem onSelect={() => void runArchive(expense._id)}>
                                        <ArchiveIcon className="size-4" />
                                        {t.archive}
                                      </DropdownMenuItem>
                                    ) : null}
                                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(expense)}>
                                      <Trash2Icon className="size-4" />
                                      {t.delete}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </>
                            ) : null}
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
                className="bg-destructive text-white hover:bg-destructive/90 hover:text-white"
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
