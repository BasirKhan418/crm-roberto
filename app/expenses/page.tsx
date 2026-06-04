'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  ArchiveIcon,
  CameraIcon,
  ChevronDownIcon,
  CheckCircle2Icon,
  CopyIcon,
  ExternalLinkIcon,
  FilePlus2Icon,
  Loader2Icon,
  MailIcon,
  MessageSquarePlusIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  PencilIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react';

import CrmShell from '@/components/crm-shell';
import { ExpensePaymentDialog } from '@/components/expenses/expense-payment-dialog';
import { ExpensePaymentStatusBadge } from '@/components/expenses/expense-payment-status-badge';
import { ExpenseFormDialog } from '@/components/expenses/expense-form-dialog';
import { ExpenseMoneyDisplay } from '@/components/expenses/expense-money-display';
import { ExpenseStatusBadge } from '@/components/expenses/expense-status-badge';
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
import FinancialTotalsBar from '@/components/ui/FinancialTotalsBar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { CreateTicketDialog } from '@/components/tickets/create-ticket-dialog';
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
import { useExpensesActionCount } from '@/hooks/useExpensesActionCount';
import { createInlineExpenseCategory, createInlineExpenseSupplier, useExpenseLookups } from '@/hooks/useExpenseLookups';
import { ExpenseListItem, useExpenses } from '@/hooks/useExpenses';
import { useIsMobile } from '@/hooks/use-mobile';
import { getDefaultCrmLandingPath, hasModuleActionAccess } from '@/lib/route-access';
import { resolveExpenseCategoryNameByLocale } from '@/lib/expenses/category-i18n';
import { EXPENSE_PAYMENT_STATUS, EXPENSE_STATUS } from '@/lib/expenses/constants';
import { canPermanentlyDeleteExpense, canRestoreArchivedExpense } from '@/lib/expenses/access';
import { isExpenseReadyForPayment } from '@/lib/expenses/payment-readiness';
import {
  EXPENSE_ALLOWED_MIME_TYPES,
  EXPENSE_MAX_FILE_SIZE_BYTES,
  formatFileSizeMb,
  getExpenseFileExtension,
  isExpenseMimeTypeAllowed,
} from '@/lib/expenses/upload';

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

type SavedExpenseSnapshot = {
  id: string;
  status: string | null;
  paymentStatus: string | null;
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

type ExpenseQuickFilterKey = 'all' | 'drafts' | 'unpaid' | 'partial' | 'paid' | 'archived';

const extensionToMime: Record<string, (typeof EXPENSE_ALLOWED_MIME_TYPES)[number]> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};

const ACCEPTED_FILES = '.pdf,.jpg,.jpeg,.png,.heic';
const MIN_DELETE_REASON_LENGTH = 10;
const NEW_BADGE_DURATION_MS = 60 * 60 * 1000;
const NEW_BADGE_REFRESH_MS = 60 * 1000;
const EXPENSE_SORT_BY_VALUES = ['expenseDate', 'dueDate', 'amountInclVatCents', 'supplierRef', 'status', 'createdAt'] as const;

function getAllowedSearchParam<T extends readonly string[]>(params: URLSearchParams, key: string, allowedValues: T) {
  const value = params.get(key);
  return value && allowedValues.includes(value) ? value : '';
}

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

function getSupplierName(expense: ExpenseListItem, supplierNameById?: Record<string, string>) {
  if (typeof expense.supplierId === 'object' && expense.supplierId) {
    return expense.supplierId.fullName || expense.supplierId.companyName || '-';
  }

  if (typeof expense.supplierId === 'string' && expense.supplierId) {
    return supplierNameById?.[expense.supplierId] || '-';
  }

  return '-';
}

function isDuplicatedExpense(expense: Pick<ExpenseListItem, 'isDuplicate' | 'duplicatedFromExpenseId'>) {
  return Boolean(expense.isDuplicate || expense.duplicatedFromExpenseId);
}

function getDuplicateBadgeLabel(locale: 'en' | 'fr') {
  return locale === 'fr' ? 'COPIE' : 'COPY';
}

function formatDuplicatedSupplierLabel(baseLabel: string, status: string, locale: 'en' | 'fr') {
  const suffix =
    locale === 'fr'
      ? status === 'draft'
        ? ' — Copie brouillon'
        : ' (Copie)'
      : status === 'draft'
        ? ' — Draft Copy'
        : ' (Copy)';

  return `${baseLabel}${suffix}`;
}

function getCategoryName(expense: ExpenseListItem, locale: 'en' | 'fr') {
  if (typeof expense.categoryId === 'object' && expense.categoryId) {
    return resolveExpenseCategoryNameByLocale(
      {
        name: expense.categoryId.name,
        nameEn: expense.categoryId.nameEn,
        nameFr: expense.categoryId.nameFr,
        canonicalKey: expense.categoryId.canonicalKey,
      },
      locale
    );
  }

  return '-';
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
      { value: 'dueDate', label: 'Date échéance' },
      { value: 'amountInclVatCents', label: 'Montant TTC' },
      { value: 'supplierRef', label: 'Référence' },
      { value: 'status', label: 'Statut' },
      { value: 'createdAt', label: 'Date création' },
    ];
  }

  return [
    { value: 'expenseDate', label: 'Expense date' },
    { value: 'dueDate', label: 'Due date' },
    { value: 'amountInclVatCents', label: 'Amount incl. VAT' },
    { value: 'supplierRef', label: 'Reference' },
    { value: 'status', label: 'Status' },
    { value: 'createdAt', label: 'Created at' },
  ];
}

function resolveExpenseIdFromActionPayload(payload: GenericApiResponse | null) {
  if (!payload?.expense || typeof payload.expense !== 'object') {
    return null;
  }

  const candidateId = (payload.expense as { _id?: unknown })._id;
  return typeof candidateId === 'string' && candidateId.trim() ? candidateId : null;
}

function resolveSavedExpenseSnapshot(payload: Record<string, unknown> | null | undefined): SavedExpenseSnapshot | null {
  if (!payload) {
    return null;
  }

  const candidateId = payload._id;
  if (typeof candidateId !== 'string' || !candidateId.trim()) {
    return null;
  }

  return {
    id: candidateId,
    status: typeof payload.status === 'string' ? payload.status : null,
    paymentStatus: typeof payload.paymentStatus === 'string' ? payload.paymentStatus : null,
  };
}

function isRecentlyCreated(createdAt: string | null | undefined, nowMs: number) {
  if (!createdAt) return false;

  const createdAtMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdAtMs)) return false;

  const ageMs = nowMs - createdAtMs;
  return ageMs >= 0 && ageMs < NEW_BADGE_DURATION_MS;
}

export default function ExpensesPage() {
  const { locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuthMe();
  const isMobile = useIsMobile();

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('');
  const [paymentStatusGroupFilter, setPaymentStatusGroupFilter] = useState<'open' | ''>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [dueStart, setDueStart] = useState('');
  const [dueEnd, setDueEnd] = useState('');
  const [dueBefore, setDueBefore] = useState('');
  const [sortBy, setSortBy] = useState('expenseDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [capturedReceiptFile, setCapturedReceiptFile] = useState<File | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseDetail | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [settleExpenseTarget, setSettleExpenseTarget] = useState<ExpenseListItem | null>(null);
  const [addPaymentTarget, setAddPaymentTarget] = useState<ExpenseListItem | null>(null);
  const [paymentExpenseDetail, setPaymentExpenseDetail] = useState<ExpenseDetail | null>(null);
  const [paymentLoadingId, setPaymentLoadingId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ExpenseListItem | null>(null);
  const [draftDeleteTarget, setDraftDeleteTarget] = useState<ExpenseListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseListItem | null>(null);
  const [ticketTarget, setTicketTarget] = useState<ExpenseListItem | null>(null);
  const [queueEditingExpenseId, setQueueEditingExpenseId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteValidationError, setDeleteValidationError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [mobileDraftsExpanded, setMobileDraftsExpanded] = useState(false);
  const [countsRefreshNonce, setCountsRefreshNonce] = useState(0);
  const [badgeNowMs, setBadgeNowMs] = useState(() => Date.now());

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const quickFiltersTouchStartRef = useRef<{ x: number; y: number; scrollLeft: number } | null>(null);
  const pendingQuickFilterScrollYRef = useRef<number | null>(null);

  function handleQuickFiltersWheel(event: React.WheelEvent<HTMLDivElement>) {
    // Keep wheel/trackpad interaction horizontal-only on this rail.
    const horizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    event.currentTarget.scrollLeft += horizontalDelta;
    event.preventDefault();
  }

  function handleQuickFiltersTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 1) {
      quickFiltersTouchStartRef.current = null;
      return;
    }

    const touch = event.touches.item(0);
    if (!touch) {
      quickFiltersTouchStartRef.current = null;
      return;
    }
    quickFiltersTouchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
    };
  }

  function handleQuickFiltersTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 1 || !quickFiltersTouchStartRef.current) {
      return;
    }

    const touch = event.touches.item(0);
    if (!touch) {
      return;
    }
    const deltaX = touch.clientX - quickFiltersTouchStartRef.current.x;

    // Force horizontal drag behavior and suppress vertical page movement.
    event.currentTarget.scrollLeft = quickFiltersTouchStartRef.current.scrollLeft - deltaX;
    event.preventDefault();
  }

  function handleQuickFiltersTouchEnd() {
    quickFiltersTouchStartRef.current = null;
  }

  function handleQuickFiltersMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (target.closest('[role="tab"]')) {
      // Prevent browser focus-scroll behavior while switching quick filters.
      event.preventDefault();
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBadgeNowMs(Date.now());
    }, NEW_BADGE_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const nextSearch = searchParams.get('search') || '';
    const nextStatus = getAllowedSearchParam(searchParams, 'status', EXPENSE_STATUS);
    const nextPaymentStatus = getAllowedSearchParam(searchParams, 'paymentStatus', EXPENSE_PAYMENT_STATUS);
    const nextPaymentStatusGroup = searchParams.get('paymentStatusGroup') === 'open' ? 'open' : '';
    const nextSortBy = getAllowedSearchParam(searchParams, 'sortBy', EXPENSE_SORT_BY_VALUES) || 'expenseDate';
    const nextSortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    setSearchInput(nextSearch);
    setDebouncedSearch(nextSearch.trim());
    setStatusFilter(nextStatus);
    setPaymentStatusFilter(nextPaymentStatus);
    setPaymentStatusGroupFilter(nextPaymentStatusGroup);
    setCategoryFilter(searchParams.get('categoryId') || '');
    setSupplierFilter(searchParams.get('supplierId') || '');
    setPeriodStart(searchParams.get('periodStart') || '');
    setPeriodEnd(searchParams.get('periodEnd') || '');
    setDueStart(searchParams.get('dueStart') || '');
    setDueEnd(searchParams.get('dueEnd') || '');
    setDueBefore(searchParams.get('dueBefore') || '');
    setSortBy(nextSortBy);
    setSortOrder(nextSortOrder);
    setPage(1);
  }, [searchParams]);

  // Open create dialog via URL param (?newExpense=1) or custom event (expenses:new)
  useEffect(() => {
    if (searchParams.get('newExpense') === '1') {
      setCapturedReceiptFile(null);
      setManualDialogOpen(true);
      router.replace('/expenses', { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    function handleNewExpenseEvent() {
      setCapturedReceiptFile(null);
      setManualDialogOpen(true);
    }
    window.addEventListener('expenses:new', handleNewExpenseEvent);
    return () => window.removeEventListener('expenses:new', handleNewExpenseEvent);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, paymentStatusFilter, paymentStatusGroupFilter, categoryFilter, supplierFilter, periodStart, periodEnd, dueStart, dueEnd, dueBefore, sortBy, sortOrder, limit]);

  const canViewExpenses = hasModuleActionAccess({ role: user?.role, modulePermissions: user?.modulePermissions, moduleKey: 'expenses', action: 'view' });
  const canManageExpenses = hasModuleActionAccess({ role: user?.role, modulePermissions: user?.modulePermissions, moduleKey: 'expenses', action: 'manage' });
  const canManageTickets = hasModuleActionAccess({ role: user?.role, modulePermissions: user?.modulePermissions, moduleKey: 'tickets', action: 'manage' });
  const canDeleteExpenses = hasModuleActionAccess({ role: user?.role, modulePermissions: user?.modulePermissions, moduleKey: 'expenses', action: 'delete' });
  const canPermanentlyDelete = canDeleteExpenses && canPermanentlyDeleteExpense(user?.role);
  const canRestoreArchived = canManageExpenses && canRestoreArchivedExpense(user?.role);

  useEffect(() => {
    if (authLoading || canViewExpenses) {
      return;
    }

    router.replace(getDefaultCrmLandingPath(user?.role, user?.modulePermissions, user?.featureFlags));
  }, [authLoading, canViewExpenses, router, user?.featureFlags, user?.modulePermissions, user?.role]);

  const {
    categories,
    suppliers,
    clients,
    invoices,
    loading: lookupsLoading,
    error: lookupsError,
    refetch: refetchLookups,
  } = useExpenseLookups(undefined, 80);

  const supplierNameById = useMemo<Record<string, string>>(
    () =>
      suppliers.reduce((accumulator, supplier) => {
        accumulator[supplier._id] = supplier.fullName || supplier.companyName || '-';
        return accumulator;
      }, {} as Record<string, string>),
    [suppliers]
  );

  const getExpenseSupplierLabel = (expense: ExpenseListItem) => {
    const baseLabel = getSupplierName(expense, supplierNameById);
    if (!isDuplicatedExpense(expense)) {
      return baseLabel;
    }

    return formatDuplicatedSupplierLabel(baseLabel, expense.status, locale);
  };

  function openTicketDialogForExpense(expense: ExpenseListItem) {
    setTicketTarget(expense);
  }

  const { expenses, pagination, totals, loading, error, refetch } = useExpenses({
    page,
    limit,
    status: statusFilter ? (statusFilter as (typeof EXPENSE_STATUS)[number]) : undefined,
    paymentStatus: paymentStatusFilter ? (paymentStatusFilter as (typeof EXPENSE_PAYMENT_STATUS)[number]) : undefined,
    paymentStatusGroup: paymentStatusGroupFilter || undefined,
    categoryId: categoryFilter || undefined,
    supplierId: supplierFilter || undefined,
    periodStart: periodStart || undefined,
    periodEnd: periodEnd || undefined,
    dueStart: dueStart || undefined,
    dueEnd: dueEnd || undefined,
    dueBefore: dueBefore || undefined,
    search: debouncedSearch || undefined,
    sortBy,
    sortOrder,
    includeTotals: true,
  });

  const {
    expenses: draftPanelExpenses,
    pagination: draftPanelPagination,
    refetch: refetchDraftPanel,
  } = useExpenses({
    page: 1,
    limit: 5000,
    status: 'draft',
    categoryId: categoryFilter || undefined,
    supplierId: supplierFilter || undefined,
    periodStart: periodStart || undefined,
    periodEnd: periodEnd || undefined,
    search: debouncedSearch || undefined,
    sortBy: 'expenseDate',
    sortOrder: 'desc',
  });

  useEffect(() => {
    if (pagination.totalPages > 0 && page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [page, pagination.totalPages]);

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

  const filteredTotals = useMemo(
    () => ({
      totalTtc: totals?.totalTtcCents ?? totalsInView.totalTtc,
      totalPaid: totals?.totalPaidCents ?? totalsInView.totalPaid,
      totalRemaining: totals?.totalRemainingCents ?? totalsInView.totalRemaining,
    }),
    [totals, totalsInView.totalPaid, totalsInView.totalRemaining, totalsInView.totalTtc]
  );

  const t = {
    en: {
      shellTitle: 'Expenses',
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
      openAndValidate: 'Open and complete',
      completeExpense: 'Complete expense',
      completeExpenseFirst: 'Please complete the expense first.',
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
      draftsSectionTitle: 'Drafts to complete',
      draftsSectionSubtitle: 'Quick access to draft expenses that still need review and completion.',
      newBadge: 'NEW',
      draftsCountLabel: (count: number) => `${count} Draft${count > 1 ? 's' : ''}`,
      filtersTitle: 'Filters and sorting',
      quickFiltersLabel: 'Quick filters',
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
      tablePaid: 'Paid amount',
      tablePayment: 'Payment',
      tableState: 'State',
      tableAttachments: 'Files',
      tableAction: 'Actions',
      open: 'Open',
      edit: 'Edit',
      addAttachment: 'Add attachment',
      duplicate: 'Duplicate',
      archive: 'Archive',
      settleExpense: 'Settle expense',
      addPayment: 'Add payment',
      createTicket: 'Create ticket',
      delete: 'Delete',
      deleteDraft: 'Delete draft',
      noReference: '-',
      totalsFooterTitle: 'Footer totals',
      totalsFooterScope: (shown: number, total: number) => `${shown} shown on this page / ${total} in filtered results`,
      totalsMetricDocuments: 'Documents',
      totalsMetricTtc: 'Total TTC',
      totalsMetricPaid: 'Total Paid',
      totalsMetricRemaining: 'Total Remaining',
      pageInfo: (current: number, total: number, count: number) => `Page ${current}/${total || 1} - ${count} items`,
      previous: 'Previous',
      next: 'Next',
      fileTooLarge: `File too large. Maximum ${formatFileSizeMb(EXPENSE_MAX_FILE_SIZE_BYTES)} MB`,
      unsupportedFile: 'Unsupported file type. Allowed: PDF, JPEG, PNG, HEIC.',
      failedPresign: 'Unable to create upload URL',
      failedUpload: 'File upload failed',
      failedDraft: 'Unable to create draft expense',
      copiedEmail: 'Forward address copied',
      mobileQuickActionsTitle: 'Quick capture',
      mobileQuickActionsSubtitle: 'Use the fastest entry points while you are outside.',
      quickPhoto: 'Photo',
      quickImport: 'Import',
      quickEmail: 'Email',
      quickManual: 'Manual',
      draftsCompactTitle: (count: number) => `Drafts (${count})`,
      mobileShowDrafts: 'Show drafts',
      mobileHideDrafts: 'Hide drafts',
      viewDraftsOnly: 'View drafts list',
      mobileShowFilters: 'Advanced filters',
      mobileHideFilters: 'Hide filters',
      mobileFiltersActive: (count: number) => `${count} advanced filter${count === 1 ? '' : 's'} active`,
      actionDuplicateSuccess: 'Expense duplicated',
      actionCreateSuccess: 'Expense created',
      actionUpdateSuccess: 'Expense updated',
      actionArchiveSuccess: 'Expense archived',
      actionRestoreSuccess: 'Expense restored',
      actionDeleteSuccess: 'Expense deleted',
      actionDeleteDraftSuccess: 'Draft deleted',
      ticketCreated: 'Ticket created',
      settleExpenseSuccess: 'Expense settled',
      addPaymentSuccess: 'Payment added',
      actionFailed: 'Action failed',
      editLoadFailed: 'Failed to load expense detail for editing',
      paymentContextLoadFailed: 'Failed to load expense receipt and payment context',
      restore: 'Restore',
      archivedHiddenHint: 'Archived expenses are hidden by default. Select Status = Archived to view them.',
      archivedReadOnlyHint: 'Archived expenses are read-only. Restore first to edit, pay, attach files, or duplicate.',
      confirmArchive: 'Archive this expense?',
      confirmArchiveTitle: 'Archive expense',
      confirmArchiveDescription: 'Archive this expense? It will remain stored and can be restored later.',
      confirmArchiveCancel: 'Cancel',
      confirmArchiveAction: 'Archive expense',
      confirmDeleteDraftTitle: 'Delete draft?',
      confirmDeleteDraftDescription: 'Delete draft? This action cannot be undone.',
      confirmDeleteDraftCancel: 'Cancel',
      confirmDeleteDraftAction: 'Delete draft',
      confirmDelete: 'Delete this expense? This cannot be undone.',
      confirmDeleteTitle: 'Confirm expense deletion',
      confirmDeleteDescription: (label: string) =>
        `You are about to permanently remove this expense (${label}). This action cannot be undone.`,
      confirmDeletePasswordLabel: 'Confirm with your password',
      confirmDeletePasswordPlaceholder: 'Enter your account password',
      confirmDeleteReasonLabel: 'Deletion reason',
      confirmDeleteReasonPlaceholder: 'Explain why this accounting record must be permanently deleted',
      confirmDeleteReasonHint: `Minimum ${MIN_DELETE_REASON_LENGTH} characters`,
      confirmDeletePasswordRequired: 'Password confirmation is required',
      confirmDeleteReasonRequired: `Deletion reason must contain at least ${MIN_DELETE_REASON_LENGTH} characters`,
      confirmDeleteCancel: 'Cancel',
      confirmDeleteAction: 'Delete expense',
      lookupsLoading: 'Loading lookups...',
      lookupsErrorTitle: 'Lookup data unavailable',
    },
    fr: {
      shellTitle: 'Dépenses',
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
      openAndValidate: 'Ouvrir et compléter',
      completeExpense: 'Compléter la dépense',
      completeExpenseFirst: "Veuillez compléter la dépense d'abord.",
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
      draftsSectionTitle: 'Brouillons à compléter',
      draftsSectionSubtitle: 'Accès rapide aux brouillons qui doivent encore être vérifiés et complétés.',
      newBadge: 'NOUVEAU',
      draftsCountLabel: (count: number) => `${count} brouillon${count > 1 ? 's' : ''}`,
      filtersTitle: 'Filtres et tri',
      quickFiltersLabel: 'Filtres rapides',
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
      tablePaid: 'Montant payé',
      tablePayment: 'Paiement',
      tableState: 'État',
      tableAttachments: 'Fichiers',
      tableAction: 'Actions',
      open: 'Ouvrir',
      edit: 'Modifier',
      addAttachment: 'Ajouter pièce jointe',
      duplicate: 'Dupliquer',
      archive: 'Archiver',
      settleExpense: 'Solder la dépense',
      addPayment: 'Ajouter un paiement',
      createTicket: 'Creer un ticket',
      delete: 'Supprimer',
      deleteDraft: 'Supprimer brouillon',
      noReference: '-',
      totalsFooterTitle: 'Totaux de pied de page',
      totalsFooterScope: (shown: number, total: number) => `${shown} affichées sur cette page / ${total} dans les résultats filtrés`,
      totalsMetricDocuments: 'Documents',
      totalsMetricTtc: 'Total TTC',
      totalsMetricPaid: 'Total payé',
      totalsMetricRemaining: 'Total restant',
      pageInfo: (current: number, total: number, count: number) => `Page ${current}/${total || 1} - ${count} éléments`,
      previous: 'Précédent',
      next: 'Suivant',
      fileTooLarge: `Fichier trop volumineux. Maximum ${formatFileSizeMb(EXPENSE_MAX_FILE_SIZE_BYTES)} MB`,
      unsupportedFile: 'Type non supporté. Autorisés : PDF, JPEG, PNG, HEIC.',
      failedPresign: "Impossible de générer l'URL d'upload",
      failedUpload: "Échec de l'upload",
      failedDraft: 'Impossible de créer le brouillon',
      copiedEmail: 'Adresse de transfert copiée',
      mobileQuickActionsTitle: 'Capture rapide',
      mobileQuickActionsSubtitle: 'Utilisez les entrées les plus rapides quand vous êtes dehors.',
      quickPhoto: 'Photo',
      quickImport: 'Import',
      quickEmail: 'Email',
      quickManual: 'Manuel',
      draftsCompactTitle: (count: number) => `Brouillons (${count})`,
      mobileShowDrafts: 'Afficher brouillons',
      mobileHideDrafts: 'Masquer brouillons',
      viewDraftsOnly: 'Voir les brouillons',
      mobileShowFilters: 'Filtres avancés',
      mobileHideFilters: 'Masquer filtres',
      mobileFiltersActive: (count: number) => `${count} filtre${count > 1 ? 's' : ''} avancé${count > 1 ? 's' : ''} actif${count > 1 ? 's' : ''}`,
      actionDuplicateSuccess: 'Dépense dupliquée',
      actionCreateSuccess: 'Dépense créée',
      actionUpdateSuccess: 'Dépense mise à jour',
      actionArchiveSuccess: 'Dépense archivée',
      actionRestoreSuccess: 'Dépense restaurée',
      actionDeleteSuccess: 'Dépense supprimée',
      actionDeleteDraftSuccess: 'Brouillon supprimé',
      ticketCreated: 'Ticket cree',
      settleExpenseSuccess: 'Dépense soldée',
      addPaymentSuccess: 'Paiement ajouté',
      actionFailed: 'Échec action',
      editLoadFailed: 'Impossible de charger la dépense pour modification',
      paymentContextLoadFailed: 'Impossible de charger le reçu et le contexte paiement',
      restore: 'Restaurer',
      archivedHiddenHint: "Les dépenses archivées sont masquées par défaut. Choisissez Statut = Archivée pour les afficher.",
      archivedReadOnlyHint: "Les dépenses archivées sont en lecture seule. Restaurez d'abord pour modifier, payer, ajouter des pièces ou dupliquer.",
      confirmArchive: 'Archiver cette dépense ?',
      confirmArchiveTitle: 'Archiver la dépense',
      confirmArchiveDescription: 'Archiver cette dépense ? Elle restera stockée et pourra être restaurée plus tard.',
      confirmArchiveCancel: 'Annuler',
      confirmArchiveAction: 'Archiver dépense',
      confirmDeleteDraftTitle: 'Supprimer le brouillon ?',
      confirmDeleteDraftDescription: 'Supprimer le brouillon ? Cette action est irréversible.',
      confirmDeleteDraftCancel: 'Annuler',
      confirmDeleteDraftAction: 'Supprimer brouillon',
      confirmDelete: 'Supprimer cette dépense ? Cette action est irréversible.',
      confirmDeleteTitle: 'Confirmer suppression dépense',
      confirmDeleteDescription: (label: string) =>
        `Vous allez supprimer définitivement cette dépense (${label}). Cette action est irréversible.`,
      confirmDeletePasswordLabel: 'Confirmez avec votre mot de passe',
      confirmDeletePasswordPlaceholder: 'Saisissez le mot de passe du compte',
      confirmDeleteReasonLabel: 'Motif de suppression',
      confirmDeleteReasonPlaceholder: 'Expliquez pourquoi cet enregistrement comptable doit être supprimé définitivement',
      confirmDeleteReasonHint: `Minimum ${MIN_DELETE_REASON_LENGTH} caractères`,
      confirmDeletePasswordRequired: 'La confirmation par mot de passe est obligatoire',
      confirmDeleteReasonRequired: `Le motif doit contenir au moins ${MIN_DELETE_REASON_LENGTH} caractères`,
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
        paymentStatusGroupFilter,
        categoryFilter,
        supplierFilter,
        periodStart,
        periodEnd,
        dueStart,
        dueEnd,
        dueBefore,
        sortBy !== 'expenseDate' ? sortBy : '',
        sortOrder !== 'desc' ? sortOrder : '',
      ].filter(Boolean).length,
    [debouncedSearch, statusFilter, paymentStatusFilter, paymentStatusGroupFilter, categoryFilter, supplierFilter, periodStart, periodEnd, dueStart, dueEnd, dueBefore, sortBy, sortOrder]
  );

  const expenseCountsRefreshKey = countsRefreshNonce;
  const { allCount, draftsCount: actionDraftsCount, unpaidCount, partialCount, paidCount, archivedCount } = useExpensesActionCount(expenseCountsRefreshKey);
  const draftsCount = draftPanelPagination.total || actionDraftsCount;

  const activeQuickFilter = useMemo<ExpenseQuickFilterKey>(() => {
    if (statusFilter === 'draft') return 'drafts';
    if (statusFilter === 'archived') return 'archived';
    if ((statusFilter === 'active' || !statusFilter) && paymentStatusFilter === 'unpaid') return 'unpaid';
    if ((statusFilter === 'active' || !statusFilter) && paymentStatusFilter === 'partial') return 'partial';
    if ((statusFilter === 'active' || !statusFilter) && paymentStatusFilter === 'paid') return 'paid';
    return 'all';
  }, [paymentStatusFilter, statusFilter]);

  const listDraftCount = activeQuickFilter === 'drafts' ? (pagination.total || expenses.length) : draftsCount;

  useEffect(() => {
    if (!isMobile) {
      setMobileDraftsExpanded(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (draftPanelExpenses.length === 0) {
      setMobileDraftsExpanded(false);
    }
  }, [draftPanelExpenses.length]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (pendingQuickFilterScrollYRef.current === null) {
      return;
    }

    const targetY = pendingQuickFilterScrollYRef.current;
    const restoreScrollPosition = () => {
      window.scrollTo({
        top: targetY,
        left: window.scrollX,
        behavior: 'auto',
      });
    };

    // Run multiple restoration passes because filter changes can cause consecutive layout shifts.
    const rafIdOne = window.requestAnimationFrame(() => {
      restoreScrollPosition();

      window.requestAnimationFrame(() => {
        restoreScrollPosition();
      });
    });

    const timeoutId = window.setTimeout(() => {
      restoreScrollPosition();
      pendingQuickFilterScrollYRef.current = null;
    }, 120);

    return () => {
      window.cancelAnimationFrame(rafIdOne);
      window.clearTimeout(timeoutId);
    };
  }, [activeQuickFilter, draftPanelExpenses.length, expenses.length, loading]);

  const applyQuickFilter = useCallback((filter: ExpenseQuickFilterKey, options?: { forceRefresh?: boolean }) => {
    if (typeof window !== 'undefined') {
      pendingQuickFilterScrollYRef.current = window.scrollY;
    }

    const isSameFilter = filter === activeQuickFilter;

    setPage(1);
    setPaymentStatusGroupFilter('');
    setDueStart('');
    setDueEnd('');
    setDueBefore('');

    if (filter === 'all') {
      setStatusFilter('');
      setPaymentStatusFilter('');
      if (isSameFilter || options?.forceRefresh) {
        void Promise.all([refetch(), refetchDraftPanel()]);
        bumpCountsRefresh();
      }
      return;
    }

    if (filter === 'drafts') {
      setStatusFilter('draft');
      setPaymentStatusFilter('');
      setMobileDraftsExpanded(false);
      if (isSameFilter || options?.forceRefresh) {
        void Promise.all([refetch(), refetchDraftPanel()]);
        bumpCountsRefresh();
      }
      return;
    }

    if (filter === 'archived') {
      setStatusFilter('archived');
      setPaymentStatusFilter('');
      if (isSameFilter || options?.forceRefresh) {
        void Promise.all([refetch(), refetchDraftPanel()]);
        bumpCountsRefresh();
      }
      return;
    }

    if (filter === 'unpaid') {
      setStatusFilter('active');
      setPaymentStatusFilter('unpaid');
      if (isSameFilter || options?.forceRefresh) {
        void Promise.all([refetch(), refetchDraftPanel()]);
        bumpCountsRefresh();
      }
      return;
    }

    if (filter === 'partial') {
      setStatusFilter('active');
      setPaymentStatusFilter('partial');
      if (isSameFilter || options?.forceRefresh) {
        void Promise.all([refetch(), refetchDraftPanel()]);
        bumpCountsRefresh();
      }
      return;
    }

    setStatusFilter('active');
    setPaymentStatusFilter('paid');
    if (isSameFilter || options?.forceRefresh) {
      void Promise.all([refetch(), refetchDraftPanel()]);
      bumpCountsRefresh();
    }
  }, [activeQuickFilter, refetch, refetchDraftPanel]);

  const expensesKpiCards = useMemo<KpiCard[]>(
    () => [
      {
        key: 'drafts',
        label: t.kpiDrafts,
        count: draftsCount,
        amount: draftPanelExpenses.reduce((sum, expense) => sum + Math.max(0, Math.round(expense.amountInclVatCents || 0)), 0),
        variant: 'orange-bold',
        icon: 'clock',
        active: statusFilter === 'draft',
        onClick: () => {
          applyQuickFilter('drafts', { forceRefresh: true });
        },
        onMouseDown: (event) => event.preventDefault(),
      },
      {
        key: 'unpaid',
        label: t.kpiUnpaid,
        count: unpaidCount,
        amount: unpaidExpenses.reduce((sum, expense) => sum + getRemainingCents(expense), 0),
        variant: 'red-bold',
        icon: 'alert-triangle',
        active: paymentStatusFilter === 'unpaid' && (statusFilter === 'active' || !statusFilter),
        onClick: () => {
          applyQuickFilter('unpaid', { forceRefresh: true });
        },
        onMouseDown: (event) => event.preventDefault(),
      },
      {
        key: 'partial',
        label: t.kpiPartial,
        count: partialCount,
        amount: partialExpenses.reduce((sum, expense) => sum + getRemainingCents(expense), 0),
        variant: 'orange',
        icon: 'clock',
        active: paymentStatusFilter === 'partial' && (statusFilter === 'active' || !statusFilter),
        onClick: () => {
          applyQuickFilter('partial', { forceRefresh: true });
        },
        onMouseDown: (event) => event.preventDefault(),
      },
      {
        key: 'paid',
        label: t.kpiPaid,
        count: paidCount,
        amount: paidExpenses.reduce((sum, expense) => sum + Math.max(0, Math.round(expense.amountPaidCents || 0)), 0),
        variant: 'green-bold',
        icon: 'check-circle',
        active: paymentStatusFilter === 'paid' && (statusFilter === 'active' || !statusFilter),
        onClick: () => {
          applyQuickFilter('paid', { forceRefresh: true });
        },
        onMouseDown: (event) => event.preventDefault(),
      },
    ],
    [
      draftPanelExpenses,
      draftsCount,
      paidCount,
      paidExpenses,
      partialCount,
      partialExpenses,
      paymentStatusFilter,
      applyQuickFilter,
      statusFilter,
      t.kpiDrafts,
      t.kpiPartial,
      t.kpiPaid,
      t.kpiUnpaid,
      unpaidCount,
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

  const expenseFooterMetrics = useMemo(
    () => [
      { key: 'documents', label: t.totalsMetricDocuments, value: expenses.length, kind: 'count' as const },
      { key: 'ttc', label: t.totalsMetricTtc, value: filteredTotals.totalTtc, kind: 'currency' as const },
      { key: 'paid', label: t.totalsMetricPaid, value: filteredTotals.totalPaid, kind: 'currency' as const, tone: 'success' as const },
      { key: 'remaining', label: t.totalsMetricRemaining, value: filteredTotals.totalRemaining, kind: 'currency' as const, tone: 'danger' as const },
    ],
    [
      expenses.length,
      filteredTotals.totalPaid,
      filteredTotals.totalRemaining,
      filteredTotals.totalTtc,
      t.totalsMetricDocuments,
      t.totalsMetricPaid,
      t.totalsMetricRemaining,
      t.totalsMetricTtc,
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

      // Keep imported drafts discoverable immediately by switching to Drafts view.
      setStatusFilter('draft');
      setPaymentStatusFilter('');
      setPage(1);

      await Promise.all([refetch(), refetchDraftPanel()]);
      bumpCountsRefresh();
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

  function openManualExpenseDialog() {
    setCapturedReceiptFile(null);
    setManualDialogOpen(true);
  }

  function onPhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    resetInputValue(event);

    if (!selectedFile || !canManageExpenses) {
      return;
    }

    const validation = validateFile(selectedFile);
    if (validation.error) {
      setFeedback('error', validation.error);
      toast.error(validation.error);
      return;
    }

    setCapturedReceiptFile(selectedFile);
    setManualDialogOpen(true);
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

  function bumpCountsRefresh() {
    setCountsRefreshNonce((previous) => previous + 1);
  }

  async function openEditExpense(expenseId: string, source: 'list' | 'queue' = 'list') {
    setActionLoadingId(expenseId);
    setQueueEditingExpenseId(source === 'queue' ? expenseId : null);

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
      setQueueEditingExpenseId(null);
      setFeedback('error', openError instanceof Error ? openError.message : t.editLoadFailed);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function openPaymentExpense(expense: ExpenseListItem, mode: 'settle' | 'add') {
    if (!isExpenseReadyForPayment(expense)) {
      setFeedback('error', t.completeExpenseFirst);
      await openEditExpense(expense._id);
      return;
    }

    setPaymentLoadingId(expense._id);
    setPaymentExpenseDetail(null);

    try {
      const response = await fetch(`/api/expenses/${expense._id}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as
        | {
            success: boolean;
            message?: string;
            expense?: ExpenseDetail;
          }
        | null;

      if (!response.ok || !payload?.success || !payload.expense) {
        throw new Error(payload?.message || t.paymentContextLoadFailed);
      }

      if (!isExpenseReadyForPayment(payload.expense)) {
        setFeedback('error', t.completeExpenseFirst);
        setEditingExpense(payload.expense);
        setEditDialogOpen(true);
        return;
      }

      setPaymentExpenseDetail(payload.expense);
      if (mode === 'settle') {
        setSettleExpenseTarget(expense);
      } else {
        setAddPaymentTarget(expense);
      }
    } catch (openError) {
      setFeedback('error', openError instanceof Error ? openError.message : t.paymentContextLoadFailed);
    } finally {
      setPaymentLoadingId(null);
    }
  }

  async function runDuplicate(expense: ExpenseListItem) {
    setActionLoadingId(expense._id);

    try {
      const response = await fetch(`/api/expenses/${expense._id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', copyAttachments: true }),
      });

      const payload = (await response.json().catch(() => null)) as GenericApiResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.actionFailed);
      }

      const duplicatedExpenseId = resolveExpenseIdFromActionPayload(payload);
      const copyLabel = expense.supplierRef?.trim() || getExpenseSupplierLabel(expense) || expense._id;
      toast.success(t.actionDuplicateSuccess);
      setFeedback('success', t.actionDuplicateSuccess);

      if (!duplicatedExpenseId) {
        await Promise.all([refetch(), refetchDraftPanel()]);
        bumpCountsRefresh();
        return;
      }

      void refetchDraftPanel();
      bumpCountsRefresh();

      const query = new URLSearchParams({
        fromDuplicate: '1',
        copiedFrom: expense._id,
        copiedLabel: copyLabel,
      });
      router.push(`/expenses/${duplicatedExpenseId}?${query.toString()}`);
    } catch (duplicateError) {
      setFeedback('error', duplicateError instanceof Error ? duplicateError.message : t.actionFailed);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function runArchive(expenseId: string) {
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

      setArchiveTarget(null);
      await Promise.all([refetch(), refetchDraftPanel()]);
      bumpCountsRefresh();
      setFeedback('success', t.actionArchiveSuccess);
    } catch (archiveError) {
      setFeedback('error', archiveError instanceof Error ? archiveError.message : t.actionFailed);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function runRestore(expenseId: string) {
    setActionLoadingId(expenseId);

    try {
      const response = await fetch(`/api/expenses/${expenseId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      });

      const payload = (await response.json().catch(() => null)) as GenericApiResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.actionFailed);
      }

      await Promise.all([refetch(), refetchDraftPanel()]);
      bumpCountsRefresh();
      setFeedback('success', t.actionRestoreSuccess);
    } catch (restoreError) {
      setFeedback('error', restoreError instanceof Error ? restoreError.message : t.actionFailed);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function runDeleteDraft(expenseId: string) {
    setActionLoadingId(expenseId);

    try {
      const response = await fetch(`/api/expenses/${expenseId}?mode=draft-delete`, {
        method: 'DELETE',
      });

      const payload = (await response.json().catch(() => null)) as GenericApiResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.actionFailed);
      }

      await Promise.all([refetch(), refetchDraftPanel()]);
      bumpCountsRefresh();
      setFeedback('success', t.actionDeleteDraftSuccess);
      toast.success(t.actionDeleteDraftSuccess);
      setDraftDeleteTarget(null);
    } catch (draftDeleteError) {
      setFeedback('error', draftDeleteError instanceof Error ? draftDeleteError.message : t.actionFailed);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function runDelete(expenseId: string, password: string, deleteReason: string) {
    setActionLoadingId(expenseId);

    try {
      const response = await fetch(`/api/expenses/${expenseId}?mode=delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          deleteReason,
        }),
      });

      const payload = (await response.json().catch(() => null)) as GenericApiResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.actionFailed);
      }

      await Promise.all([refetch(), refetchDraftPanel()]);
      bumpCountsRefresh();
      setFeedback('success', t.actionDeleteSuccess);
      toast.success(t.actionDeleteSuccess);
      setDeleteTarget(null);
      setDeletePassword('');
      setDeleteReason('');
      setDeleteValidationError(null);
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
    setPaymentStatusGroupFilter('');
    setCategoryFilter('');
    setSupplierFilter('');
    setPeriodStart('');
    setPeriodEnd('');
    setDueStart('');
    setDueEnd('');
    setDueBefore('');
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
      <div className="space-y-4 sm:space-y-5 [overflow-anchor:none]">
        {isMobile ? (
          <section
            className="mx-auto grid w-full max-w-md grid-cols-3 gap-2.5 justify-items-center"
            data-tour-expenses-header
          >
            <div className="flex w-full min-h-13 flex-col items-center justify-center rounded-lg border border-amber-200/90 bg-amber-100/80 px-2 py-2.5 text-center text-sm font-semibold leading-tight text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
              <span className="text-xs font-medium opacity-90">{t.kpiDrafts}</span>
              <span>{draftsCount}</span>
            </div>
            <div className="flex w-full min-h-13 flex-col items-center justify-center rounded-lg border border-rose-200/90 bg-rose-100/80 px-2 py-2.5 text-center text-sm font-semibold leading-tight text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
              <span className="text-xs font-medium opacity-90">{t.paymentStatusLabels.unpaid}</span>
              <span>{unpaidExpenses.length}</span>
            </div>
            <div className="flex w-full min-h-13 flex-col items-center justify-center rounded-lg border border-emerald-200/90 bg-emerald-100/80 px-2 py-2.5 text-center text-sm font-semibold leading-tight text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
              <span className="text-xs font-medium opacity-90">{t.paymentStatusLabels.paid}</span>
              <span>{paidExpenses.length}</span>
            </div>
          </section>
        ) : null}

        {!isMobile ? (
          <>
            <section className="space-y-2" data-tour-expenses-kpis data-tour-expenses-header>
              <KpiCards
                cards={expensesKpiCards}
                locale={locale as 'en' | 'fr'}
                loading={loading && expenses.length === 0}
                compact
              />
              <KpiCards cards={expensesTotalsCards} locale={locale as 'en' | 'fr'} cols={3} compact />
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
                    className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-7 sm:whitespace-nowrap"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={!canManageExpenses}
                  >
                    <CameraIcon className="size-4 shrink-0" />
                    <span>{t.choosePhoto}</span>
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
                    className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-7 sm:whitespace-nowrap"
                    variant="outline"
                    onClick={() => importInputRef.current?.click()}
                    disabled={!canManageExpenses}
                  >
                    <UploadIcon className="size-4 shrink-0" />
                    <span>{t.browseFiles}</span>
                  </Button>
                </CardContent>
              </Card>

              <Card size="sm" className="border-amber-200/80 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20">
                <CardHeader className="flex-1 pb-2">
                  <CardTitle>{t.forwardEmail}</CardTitle>
                  <CardDescription className="text-xs">{t.forwardEmailHint}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-7 sm:whitespace-nowrap"
                    onClick={() => void copyForwardAddress()}
                  >
                    <CopyIcon className="size-4 shrink-0" />
                    <span>{copyFeedback ? t.copied : t.copy}</span>
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
                    className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-7 sm:whitespace-nowrap"
                    variant="secondary"
                    onClick={openManualExpenseDialog}
                    disabled={!canManageExpenses}
                  >
                    <FilePlus2Icon className="size-4 shrink-0" />
                    <span>{t.createManual}</span>
                  </Button>
                </CardContent>
              </Card>
            </section>
          </>
        ) : (
          <section data-tour-expenses-capture>
            <Card className="border-sky-200/80 bg-sky-50/55 dark:border-sky-900/35 dark:bg-sky-950/16">
              <CardContent className="p-2.5">
                <div className="grid grid-cols-4 gap-1.5">
                  <Button
                    type="button"
                    className="h-14 min-w-0 flex-col gap-1 whitespace-normal px-1.5 py-2 text-[11px] leading-tight"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={!canManageExpenses}
                    title={t.takePhoto}
                    aria-label={t.takePhoto}
                  >
                    <CameraIcon className="size-4 shrink-0" />
                    <span className="w-full truncate">{t.quickPhoto}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 min-w-0 flex-col gap-1 whitespace-normal px-1.5 py-2 text-[11px] leading-tight"
                    onClick={() => importInputRef.current?.click()}
                    disabled={!canManageExpenses}
                    title={t.importFile}
                    aria-label={t.importFile}
                  >
                    <UploadIcon className="size-4 shrink-0" />
                    <span className="w-full truncate">{t.quickImport}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-14 min-w-0 flex-col gap-1 whitespace-normal px-1.5 py-2 text-[11px] leading-tight"
                    onClick={() => void copyForwardAddress()}
                    title={forwardAddress}
                    aria-label={t.forwardEmail}
                  >
                    <MailIcon className="size-4 shrink-0" />
                    <span className="w-full truncate">{copyFeedback ? t.copied : t.quickEmail}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 min-w-0 flex-col gap-1 whitespace-normal px-1.5 py-2 text-[11px] leading-tight"
                    onClick={openManualExpenseDialog}
                    disabled={!canManageExpenses}
                    title={t.createManual}
                    aria-label={t.createManual}
                  >
                    <FilePlus2Icon className="size-4 shrink-0" />
                    <span className="w-full truncate">{t.quickManual}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        <input
          ref={photoInputRef}
          type="file"
          className="hidden"
          accept="image/*,.jpg,.jpeg,.png,.heic"
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

                  <div className="mt-2 flex flex-wrap items-center gap-2">
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
                      canManageExpenses ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-auto min-h-7 w-full whitespace-normal px-3 py-2 text-center sm:w-auto sm:whitespace-nowrap"
                          onClick={() => {
                            if (item.expenseId) {
                              void openEditExpense(item.expenseId, 'queue');
                            }
                          }}
                          disabled={actionLoadingId === item.expenseId}
                        >
                          {actionLoadingId === item.expenseId ? (
                            <Loader2Icon className="size-3.5 animate-spin" />
                          ) : (
                            <PencilIcon className="size-3.5" />
                          )}
                          {t.openAndValidate}
                        </Button>
                      ) : (
                        <Button
                          asChild
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-auto min-h-7 w-full whitespace-normal px-3 py-2 text-center sm:w-auto sm:whitespace-nowrap"
                        >
                          <Link href={`/expenses/${item.expenseId}`}>
                            <ExternalLinkIcon className="size-3.5" />
                            {t.openAndValidate}
                          </Link>
                        </Button>
                      )
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {draftPanelExpenses.length > 0 && (!isMobile || activeQuickFilter !== 'drafts') ? (
          <Card className="border-amber-200/80 bg-amber-50/45 dark:border-amber-900/35 dark:bg-amber-950/14" data-tour-expenses-drafts>
            <CardHeader className="pb-2">
              {isMobile ? (
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => setMobileDraftsExpanded((previous) => !previous)}
                  aria-expanded={mobileDraftsExpanded}
                >
                  <CardTitle className="text-base">{t.draftsCompactTitle(draftsCount)}</CardTitle>
                  <ChevronDownIcon
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${mobileDraftsExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
              ) : (
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">{t.draftsSectionTitle}</CardTitle>
                    <CardDescription>{t.draftsSectionSubtitle}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="self-start sm:self-auto">{t.draftsCountLabel(draftsCount)}</Badge>
                </div>
              )}
            </CardHeader>
            {!isMobile || mobileDraftsExpanded ? (
              <CardContent className="space-y-2.5">
                {(isMobile ? draftPanelExpenses.slice(0, 2) : draftPanelExpenses).map((expense) => {
                    const rowLoading = actionLoadingId === expense._id;
                    const isNewExpense = isRecentlyCreated(expense.createdAt, badgeNowMs);

                    return (
                      <div
                        key={expense._id}
                        className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:p-2.5 ${getExpenseSurfaceClass(expense.status, expense.paymentStatus)}`}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate text-sm font-medium">{getExpenseSupplierLabel(expense)}</p>
                            {isDuplicatedExpense(expense) ? (
                              <span className="inline-flex shrink-0 items-center rounded-full border border-sky-300/70 bg-linear-to-r from-sky-500 to-cyan-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-xs">
                                {getDuplicateBadgeLabel(locale)}
                              </span>
                            ) : null}
                            {isNewExpense ? (
                              <Badge
                                variant="secondary"
                                className="h-5 shrink-0 rounded-full border border-emerald-300/80 bg-emerald-50 px-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/35 dark:text-emerald-200"
                              >
                                {t.newBadge}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDateDisplay(expense.expenseDate)} · {getCategoryName(expense, locale)}
                          </p>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                          <ExpenseMoneyDisplay
                            cents={expense.amountInclVatCents || 0}
                            locale={locale === 'fr' ? 'fr-FR' : 'en-GB'}
                            className="text-sm font-medium"
                          />
                          {!isExpenseReadyForPayment(expense) ? (
                            <p className="text-xs text-amber-700 dark:text-amber-300">{t.completeExpenseFirst}</p>
                          ) : null}
                          <div className="flex flex-col gap-2 sm:flex-row">
                            {!isMobile || !canManageExpenses ? (
                              <Button
                                asChild
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-auto min-h-7 w-full whitespace-normal px-3 py-2 text-center sm:w-auto sm:whitespace-nowrap"
                              >
                                <Link href={`/expenses/${expense._id}`}>{t.openDraft}</Link>
                              </Button>
                            ) : null}
                            {canManageExpenses ? (
                              <Button
                                type="button"
                                size="sm"
                                className="h-auto min-h-7 w-full whitespace-normal px-3 py-2 text-center sm:w-auto sm:whitespace-nowrap"
                                onClick={() => void openEditExpense(expense._id)}
                                disabled={rowLoading}
                              >
                                {rowLoading ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                                {t.completeExpense}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {isMobile && draftPanelExpenses.length > 2 ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                    <p className="text-xs text-muted-foreground">{t.draftsCountLabel(draftsCount)}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => {
                        applyQuickFilter('drafts');
                        setAdvancedFiltersOpen(false);
                      }}
                    >
                      {t.viewDraftsOnly}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            ) : null}
          </Card>
        ) : null}

        <Card className="border-slate-200/80 bg-slate-50/45 dark:border-slate-800/70 dark:bg-slate-950/16" data-tour-expenses-filters>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.filtersTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs value={activeQuickFilter} onValueChange={(value) => applyQuickFilter(value as ExpenseQuickFilterKey)}>
              <div className="space-y-1.5">
                <Label>{t.quickFiltersLabel}</Label>
                <div
                  className="overflow-x-auto overflow-y-hidden touch-none overscroll-y-none overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  onMouseDown={handleQuickFiltersMouseDown}
                  onWheel={handleQuickFiltersWheel}
                  onTouchStart={handleQuickFiltersTouchStart}
                  onTouchMove={handleQuickFiltersTouchMove}
                  onTouchEnd={handleQuickFiltersTouchEnd}
                  onTouchCancel={handleQuickFiltersTouchEnd}
                >
                  <TabsList className="inline-flex h-auto min-w-max items-center gap-1 rounded-lg border border-border/80 bg-muted/10 p-1 shadow-xs">
                    <TabsTrigger value="all" className="min-h-9 rounded-md border border-transparent px-3 py-2.5 sm:py-1.5 text-sm font-medium text-foreground/85 hover:bg-muted/60 hover:text-foreground data-active:border-primary/10 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm">
                      <span>{t.all}</span>
                      <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-600 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                        {allCount > 99 ? '99+' : allCount}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="drafts" className="min-h-9 rounded-md border border-border/80 px-3 py-2.5 sm:py-1.5 text-sm font-medium text-foreground/85 hover:bg-muted/60 hover:text-foreground data-active:border-primary/10 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm">
                      <span>{t.kpiDrafts}</span>
                      <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                        {draftsCount > 99 ? '99+' : draftsCount}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="unpaid" className="min-h-9 rounded-md border border-border/80 px-3 py-2.5 sm:py-1.5 text-sm font-medium text-foreground/85 hover:bg-muted/60 hover:text-foreground data-active:border-primary/10 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm">
                      <span>{t.kpiUnpaid}</span>
                      <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                        {unpaidCount > 99 ? '99+' : unpaidCount}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="partial" className="min-h-9 rounded-md border border-border/80 px-3 py-2.5 sm:py-1.5 text-sm font-medium text-foreground/85 hover:bg-muted/60 hover:text-foreground data-active:border-primary/10 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm">
                      <span>{t.kpiPartial}</span>
                      <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                        {partialCount > 99 ? '99+' : partialCount}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="paid" className="min-h-9 rounded-md border border-border/80 px-3 py-2.5 sm:py-1.5 text-sm font-medium text-foreground/85 hover:bg-muted/60 hover:text-foreground data-active:border-primary/10 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm">
                      <span>{t.kpiPaid}</span>
                      <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                        {paidCount > 99 ? '99+' : paidCount}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="archived" className="min-h-9 rounded-md border border-border/80 px-3 py-2.5 sm:py-1.5 text-sm font-medium text-foreground/85 hover:bg-muted/60 hover:text-foreground data-active:border-primary/10 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm">
                      <span>{t.statusLabels.archived}</span>
                      <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-600 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                        {archivedCount > 99 ? '99+' : archivedCount}
                      </span>
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>
            </Tabs>

            <div className="space-y-1.5">
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

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={advancedFiltersOpen ? 'secondary' : 'outline'}
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={() => setAdvancedFiltersOpen((previous) => !previous)}
                aria-expanded={advancedFiltersOpen}
              >
                {advancedFiltersOpen ? t.mobileHideFilters : t.mobileShowFilters}
                <ChevronDownIcon
                  className={`size-3.5 shrink-0 transition-transform ${advancedFiltersOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </Button>
              {!advancedFiltersOpen && activeFiltersCount > 0 ? (
                <>
                  <p className="text-xs text-muted-foreground">{t.mobileFiltersActive(activeFiltersCount)}</p>
                  <Button type="button" variant="ghost" size="sm" className="ml-auto h-8 px-2 text-xs" onClick={resetFilters}>
                    {t.clearFilters}
                  </Button>
                </>
              ) : null}
            </div>

            {advancedFiltersOpen ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
                  <div className="space-y-1.5">
                    <Label>{t.statusLabel}</Label>
                    <select
                      className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
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
                      className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
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
                      className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                      value={categoryFilter}
                      onChange={(event) => setCategoryFilter(event.target.value)}
                    >
                      <option value="">{t.all}</option>
                      {categories.map((category) => (
                        <option key={category._id} value={category._id}>
                          {resolveExpenseCategoryNameByLocale(category, locale)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t.supplierLabel}</Label>
                    <select
                      className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
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
                    <Input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="h-10 text-sm" />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t.periodEndLabel}</Label>
                    <Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="h-10 text-sm" />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t.sortByLabel}</Label>
                    <select
                      className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
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
                      className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
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
                      className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm"
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
              </>
            ) : null}

            {lookupsLoading ? <p className="text-xs text-muted-foreground">{t.lookupsLoading}</p> : null}
            {lookupsError ? (
              <p className="text-xs text-destructive">
                {t.lookupsErrorTitle}: {lookupsError}
              </p>
            ) : null}
            {advancedFiltersOpen ? <p className="text-xs text-muted-foreground">{t.archivedHiddenHint}</p> : null}
            {statusFilter === 'archived' ? <p className="text-xs text-muted-foreground">{t.archivedReadOnlyHint}</p> : null}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/80 dark:border-slate-800/70 dark:bg-slate-950/12" data-tour-expenses-list>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{t.listTitle}</CardTitle>
                  <Badge variant="outline">{t.draftsCountLabel(listDraftCount)}</Badge>
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
                  const rowLoading = actionLoadingId === expense._id || paymentLoadingId === expense._id;
                  const isArchived = expense.status === 'archived';
                  const paymentReady = isExpenseReadyForPayment(expense);
                  const canRecordPayment = paymentReady && expense.paymentStatus !== 'paid' && !isArchived;
                  const isDraftAction = canManageExpenses && expense.status === 'draft' && !isArchived;
                  const isNewExpense = isRecentlyCreated(expense.createdAt, badgeNowMs);

                  return (
                    <div
                      key={expense._id}
                      className={`rounded-xl border border-l-4 p-3 pl-3.5 ${getCardAccentClass(expense.status, expense.paymentStatus)} ${getExpenseSurfaceClass(expense.status, expense.paymentStatus)}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate text-sm font-semibold">{getExpenseSupplierLabel(expense)}</p>
                            {isDuplicatedExpense(expense) ? (
                              <span className="inline-flex shrink-0 items-center rounded-full border border-sky-300/70 bg-linear-to-r from-sky-500 to-cyan-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-xs">
                                {getDuplicateBadgeLabel(locale)}
                              </span>
                            ) : null}
                            {isNewExpense ? (
                              <Badge
                                variant="secondary"
                                className="h-5 shrink-0 rounded-full border border-emerald-300/80 bg-emerald-50 px-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/35 dark:text-emerald-200"
                              >
                                {t.newBadge}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{formatDateDisplay(expense.expenseDate)}</span>
                            <span>•</span>
                            <span className="max-w-32 truncate">{getCategoryName(expense, locale)}</span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-1.5 py-0.5 text-[11px]">
                              <PaperclipIcon className="size-3 text-muted-foreground" />
                              {expense.attachmentsCount || 0}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <ExpenseStatusBadge status={expense.status} locale={locale} />
                          <ExpensePaymentStatusBadge
                            paymentStatus={expense.paymentStatus}
                            lifecycleStatus={expense.status}
                            locale={locale}
                          />
                        </div>
                      </div>

                      {expense.supplierRef ? (
                        <p className="mt-2 truncate text-xs text-muted-foreground">
                          {t.tableReference}: {expense.supplierRef}
                        </p>
                      ) : null}

                      {!paymentReady && !isArchived && expense.paymentStatus !== 'paid' ? (
                        <p className="mt-2 rounded-md border border-amber-200/70 bg-amber-50/70 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-900/45 dark:bg-amber-950/25 dark:text-amber-300">
                          {t.completeExpenseFirst}
                        </p>
                      ) : null}

                      <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
                        <div className="rounded-md border border-border/60 bg-background/75 px-2 py-1.5">
                          <p className="text-muted-foreground">{t.tableAmount}</p>
                          <ExpenseMoneyDisplay
                            cents={expense.amountInclVatCents || 0}
                            locale={locale === 'fr' ? 'fr-FR' : 'en-GB'}
                            className="text-sm font-medium"
                          />
                        </div>
                        <div className="rounded-md border border-border/60 bg-background/75 px-2 py-1.5">
                          <p className="text-muted-foreground">{t.tablePaid}</p>
                          <ExpenseMoneyDisplay
                            cents={expense.amountPaidCents || 0}
                            locale={locale === 'fr' ? 'fr-FR' : 'en-GB'}
                            className="text-sm font-medium"
                          />
                        </div>
                        <div className="rounded-md border border-border/60 bg-background/75 px-2 py-1.5">
                          <p className="text-muted-foreground">{t.tableRemaining}</p>
                          <ExpenseMoneyDisplay
                            cents={getRemainingCents(expense)}
                            locale={locale === 'fr' ? 'fr-FR' : 'en-GB'}
                            className="text-sm font-medium"
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        {isDraftAction ? (
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-9 flex-1"
                            onClick={() => void openEditExpense(expense._id)}
                            disabled={rowLoading}
                          >
                            {rowLoading ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                            {t.completeExpense}
                          </Button>
                        ) : (
                          <Button asChild type="button" size="sm" variant="outline" className="min-h-9 flex-1">
                            <Link href={`/expenses/${expense._id}`}>{t.open}</Link>
                          </Button>
                        )}

                        {canManageTickets ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-9"
                            disabled={rowLoading}
                            title={t.createTicket}
                            aria-label={t.createTicket}
                            onClick={() => openTicketDialogForExpense(expense)}
                          >
                            <MessageSquarePlusIcon className="size-4" />
                          </Button>
                        ) : null}

                        {canManageExpenses ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-9"
                                disabled={rowLoading}
                                title={t.tableAction}
                                aria-label={t.tableAction}
                              >
                                <MoreHorizontalIcon className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {isDraftAction ? (
                                <DropdownMenuItem asChild>
                                  <Link href={`/expenses/${expense._id}`}>
                                    <ExternalLinkIcon className="size-4" />
                                    {t.open}
                                  </Link>
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onSelect={() => void openEditExpense(expense._id)}
                                  disabled={isArchived}
                                >
                                  <PencilIcon className="size-4" />
                                  {t.edit}
                                </DropdownMenuItem>
                              )}
                              {canRecordPayment ? (
                                <DropdownMenuItem onSelect={() => void openPaymentExpense(expense, 'settle')}>
                                  <CheckCircle2Icon className="size-4" />
                                  {t.settleExpense}
                                </DropdownMenuItem>
                              ) : null}
                              {canRecordPayment ? (
                                <DropdownMenuItem onSelect={() => void openPaymentExpense(expense, 'add')}>
                                  <FilePlus2Icon className="size-4" />
                                  {t.addPayment}
                                </DropdownMenuItem>
                              ) : null}
                              {canManageTickets ? (
                                <DropdownMenuItem onSelect={() => openTicketDialogForExpense(expense)}>
                                  <MessageSquarePlusIcon className="size-4" />
                                  {t.createTicket}
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem
                                onSelect={() => void runDuplicate(expense)}
                                disabled={isArchived}
                              >
                                <CopyIcon className="size-4" />
                                {t.duplicate}
                              </DropdownMenuItem>
                              {!isArchived ? (
                                <DropdownMenuItem asChild>
                                  <Link href={`/expenses/${expense._id}?tab=attachments`}>
                                    <PaperclipIcon className="size-4" />
                                    {t.addAttachment}
                                  </Link>
                                </DropdownMenuItem>
                              ) : null}
                              {!isArchived ? (
                                <DropdownMenuItem onSelect={() => setArchiveTarget(expense)}>
                                  <ArchiveIcon className="size-4" />
                                  {t.archive}
                                </DropdownMenuItem>
                              ) : null}
                              {expense.status === 'draft' ? (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => setDraftDeleteTarget(expense)}
                                >
                                  <Trash2Icon className="size-4" />
                                  {t.deleteDraft}
                                </DropdownMenuItem>
                              ) : null}
                              {isArchived && canRestoreArchived ? (
                                <DropdownMenuItem onSelect={() => void runRestore(expense._id)}>
                                  <RefreshCwIcon className="size-4" />
                                  {t.restore}
                                </DropdownMenuItem>
                              ) : null}
                              {canPermanentlyDelete && expense.status !== 'draft' ? (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => {
                                    setDeletePassword('');
                                    setDeleteReason('');
                                    setDeleteValidationError(null);
                                    setDeleteTarget(expense);
                                  }}
                                >
                                  <Trash2Icon className="size-4" />
                                  {t.delete}
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
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
                    <TableHead className="text-right">{t.tablePaid}</TableHead>
                    <TableHead className="text-right">{t.tableRemaining}</TableHead>
                    <TableHead>{t.tablePayment}</TableHead>
                    <TableHead>{t.tableState}</TableHead>
                    <TableHead>{t.tableAttachments}</TableHead>
                    <TableHead className="text-right">{t.tableAction}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => {
                    const rowLoading = actionLoadingId === expense._id || paymentLoadingId === expense._id;
                    const isArchived = expense.status === 'archived';
                    const paymentReady = isExpenseReadyForPayment(expense);
                    const canRecordPayment = paymentReady && expense.paymentStatus !== 'paid' && !isArchived;
                    const isNewExpense = isRecentlyCreated(expense.createdAt, badgeNowMs);

                    return (
                      <TableRow key={expense._id} className={`cursor-pointer ${getTableRowToneClass(expense.status, expense.paymentStatus)}`}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateDisplay(expense.expenseDate)}</TableCell>
                        <TableCell className="max-w-52">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate font-medium">{getExpenseSupplierLabel(expense)}</span>
                            {isDuplicatedExpense(expense) ? (
                              <span className="inline-flex shrink-0 items-center rounded-full border border-sky-300/70 bg-linear-to-r from-sky-500 to-cyan-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-xs">
                                {getDuplicateBadgeLabel(locale)}
                              </span>
                            ) : null}
                            {isNewExpense ? (
                              <Badge
                                variant="secondary"
                                className="h-5 shrink-0 rounded-full border border-emerald-300/80 bg-emerald-50 px-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/35 dark:text-emerald-200"
                              >
                                {t.newBadge}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-44 truncate">{getCategoryName(expense, locale)}</TableCell>
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
                        <TableCell className="text-right tabular-nums">
                          <ExpenseMoneyDisplay cents={expense.amountPaidCents || 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="font-medium" />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <ExpenseMoneyDisplay cents={getRemainingCents(expense)} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="font-medium" />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <ExpensePaymentStatusBadge
                              paymentStatus={expense.paymentStatus}
                              lifecycleStatus={expense.status}
                              locale={locale}
                            />
                            {!paymentReady && !isArchived && expense.paymentStatus !== 'paid' ? (
                              <p className="text-[11px] leading-tight text-amber-700 dark:text-amber-300">{t.completeExpenseFirst}</p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ExpenseStatusBadge status={expense.status} locale={locale} />
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

                            {canManageTickets ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-8"
                                title={t.createTicket}
                                aria-label={t.createTicket}
                                onClick={() => openTicketDialogForExpense(expense)}
                                disabled={rowLoading}
                              >
                                <MessageSquarePlusIcon className="size-4" />
                              </Button>
                            ) : null}

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
                                  disabled={rowLoading || isArchived}
                                >
                                  <PencilIcon className="size-4" />
                                </Button>
                                {canRecordPayment ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="size-8"
                                    title={t.settleExpense}
                                    aria-label={t.settleExpense}
                                    onClick={() => void openPaymentExpense(expense, 'settle')}
                                    disabled={rowLoading}
                                  >
                                    <CheckCircle2Icon className="size-4" />
                                  </Button>
                                ) : null}
                                {canRecordPayment ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="size-8"
                                    title={t.addPayment}
                                    aria-label={t.addPayment}
                                    onClick={() => void openPaymentExpense(expense, 'add')}
                                    disabled={rowLoading}
                                  >
                                    <FilePlus2Icon className="size-4" />
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="size-8"
                                  title={t.duplicate}
                                  aria-label={t.duplicate}
                                  onClick={() => void runDuplicate(expense)}
                                  disabled={rowLoading || isArchived}
                                >
                                  <CopyIcon className="size-4" />
                                </Button>
                                {isArchived ? (
                                  <Button type="button" variant="outline" size="icon" className="size-8" disabled>
                                    <PaperclipIcon className="size-4" />
                                  </Button>
                                ) : (
                                  <Button asChild type="button" variant="outline" size="icon" className="size-8">
                                    <Link
                                      href={`/expenses/${expense._id}?tab=attachments`}
                                      title={t.addAttachment}
                                      aria-label={t.addAttachment}
                                    >
                                      <PaperclipIcon className="size-4" />
                                    </Link>
                                  </Button>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="outline" size="icon" className="size-8" disabled={rowLoading}>
                                      <MoreHorizontalIcon className="size-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    {canManageTickets ? (
                                      <DropdownMenuItem onSelect={() => openTicketDialogForExpense(expense)}>
                                        <MessageSquarePlusIcon className="size-4" />
                                        {t.createTicket}
                                      </DropdownMenuItem>
                                    ) : null}
                                    {!isArchived ? (
                                      <DropdownMenuItem onSelect={() => setArchiveTarget(expense)}>
                                        <ArchiveIcon className="size-4" />
                                        {t.archive}
                                      </DropdownMenuItem>
                                    ) : null}
                                    {expense.status === 'draft' ? (
                                      <DropdownMenuItem
                                        variant="destructive"
                                        onSelect={() => setDraftDeleteTarget(expense)}
                                      >
                                        <Trash2Icon className="size-4" />
                                        {t.deleteDraft}
                                      </DropdownMenuItem>
                                    ) : null}
                                    {isArchived && canRestoreArchived ? (
                                      <DropdownMenuItem onSelect={() => void runRestore(expense._id)}>
                                        <RefreshCwIcon className="size-4" />
                                        {t.restore}
                                      </DropdownMenuItem>
                                    ) : null}
                                    {canPermanentlyDelete && expense.status !== 'draft' ? (
                                      <DropdownMenuItem
                                        variant="destructive"
                                        onSelect={() => {
                                          setDeletePassword('');
                                          setDeleteReason('');
                                          setDeleteValidationError(null);
                                          setDeleteTarget(expense);
                                        }}
                                      >
                                        <Trash2Icon className="size-4" />
                                        {t.delete}
                                      </DropdownMenuItem>
                                    ) : null}
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
              <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-2.5" data-tour-expenses-totals>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground/85">{t.totalsFooterTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.totalsFooterScope(expenses.length, pagination.total || expenses.length)}
                  </p>
                </div>
                <FinancialTotalsBar metrics={expenseFooterMetrics} locale={locale as 'en' | 'fr'} />
              </div>
            ) : null}

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
        onOpenChange={(open) => {
          setManualDialogOpen(open);
          if (!open) {
            setCapturedReceiptFile(null);
          }
        }}
        mode="create"
        initialReceiptFile={capturedReceiptFile}
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
        onCreateCategory={async (input) => {
          const created = await createInlineExpenseCategory(input);
          await refetchLookups();
          return created;
        }}
        onSaved={async () => {
          await Promise.all([refetch(), refetchDraftPanel(), refetchLookups()]);
          bumpCountsRefresh();
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
              setQueueEditingExpenseId(null);
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
          onCreateCategory={async (input) => {
            const created = await createInlineExpenseCategory(input);
            await refetchLookups();
            return created;
          }}
          onSaved={async (savedExpense) => {
            const snapshot = resolveSavedExpenseSnapshot(savedExpense);

            await Promise.all([refetch(), refetchDraftPanel(), refetchLookups()]);
            bumpCountsRefresh();

            if (snapshot && queueEditingExpenseId && snapshot.id === queueEditingExpenseId) {
              if (snapshot.status === 'draft') {
                setStatusFilter('draft');
                setPaymentStatusFilter('');
                setPage(1);
                setMobileDraftsExpanded(true);
              } else if (snapshot.status === 'active') {
                setStatusFilter('active');
                setPaymentStatusFilter(snapshot.paymentStatus === 'partial' || snapshot.paymentStatus === 'paid' ? snapshot.paymentStatus : 'unpaid');
                setPage(1);
                setUploads((previous) => previous.filter((item) => item.expenseId !== snapshot.id));
              }
            }

            setQueueEditingExpenseId(null);
            setFeedback('success', t.actionUpdateSuccess);
          }}
        />
      ) : null}

      <ExpensePaymentDialog
        open={Boolean(settleExpenseTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setSettleExpenseTarget(null);
            setPaymentExpenseDetail(null);
          }
        }}
        expenseId={settleExpenseTarget?._id || null}
        amountInclVatCents={paymentExpenseDetail?.amountInclVatCents ?? settleExpenseTarget?.amountInclVatCents ?? 0}
        amountPaidCents={paymentExpenseDetail?.amountPaidCents ?? settleExpenseTarget?.amountPaidCents ?? 0}
        mode="settle"
        locale={locale}
        expenseLabel={settleExpenseTarget ? getExpenseSupplierLabel(settleExpenseTarget) : null}
        expenseDate={paymentExpenseDetail?.expenseDate ?? settleExpenseTarget?.expenseDate ?? null}
        supplierRef={paymentExpenseDetail?.supplierRef ?? settleExpenseTarget?.supplierRef ?? null}
        receiptAttachment={paymentExpenseDetail?.attachments?.[0] ?? null}
        blockedReason={
          settleExpenseTarget && !isExpenseReadyForPayment(paymentExpenseDetail ?? settleExpenseTarget)
            ? t.completeExpenseFirst
            : null
        }
        onCompleteExpense={() => {
          const targetId = settleExpenseTarget?._id;
          setSettleExpenseTarget(null);
          setPaymentExpenseDetail(null);
          if (targetId) {
            void openEditExpense(targetId);
          }
        }}
        onSaved={async () => {
          await Promise.all([refetch(), refetchDraftPanel()]);
          bumpCountsRefresh();
          setFeedback('success', t.settleExpenseSuccess);
        }}
      />

      <ExpensePaymentDialog
        open={Boolean(addPaymentTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setAddPaymentTarget(null);
            setPaymentExpenseDetail(null);
          }
        }}
        expenseId={addPaymentTarget?._id || null}
        amountInclVatCents={paymentExpenseDetail?.amountInclVatCents ?? addPaymentTarget?.amountInclVatCents ?? 0}
        amountPaidCents={paymentExpenseDetail?.amountPaidCents ?? addPaymentTarget?.amountPaidCents ?? 0}
        mode="add"
        locale={locale}
        expenseLabel={addPaymentTarget ? getExpenseSupplierLabel(addPaymentTarget) : null}
        expenseDate={paymentExpenseDetail?.expenseDate ?? addPaymentTarget?.expenseDate ?? null}
        supplierRef={paymentExpenseDetail?.supplierRef ?? addPaymentTarget?.supplierRef ?? null}
        receiptAttachment={paymentExpenseDetail?.attachments?.[0] ?? null}
        blockedReason={
          addPaymentTarget && !isExpenseReadyForPayment(paymentExpenseDetail ?? addPaymentTarget)
            ? t.completeExpenseFirst
            : null
        }
        onCompleteExpense={() => {
          const targetId = addPaymentTarget?._id;
          setAddPaymentTarget(null);
          setPaymentExpenseDetail(null);
          if (targetId) {
            void openEditExpense(targetId);
          }
        }}
        onSaved={async () => {
          await Promise.all([refetch(), refetchDraftPanel()]);
          bumpCountsRefresh();
          setFeedback('success', t.addPaymentSuccess);
        }}
      />

      {ticketTarget ? (
        <CreateTicketDialog
          open={Boolean(ticketTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setTicketTarget(null);
            }
          }}
          locale={locale as 'en' | 'fr'}
          prefill={{
            linkedType: 'expense',
            linkedId: ticketTarget._id,
            linkedLabel: `${getExpenseSupplierLabel(ticketTarget)}${ticketTarget.supplierRef ? ` - ${ticketTarget.supplierRef}` : ''}`,
            title: `${getExpenseSupplierLabel(ticketTarget)}${ticketTarget.supplierRef ? ` - ${ticketTarget.supplierRef}` : ''}`,
            type: 'accounting',
          }}
          onCreated={async (ticketId) => {
            setTicketTarget(null);
            if (ticketId) {
              router.push(`/tickets/${ticketId}`);
            }
            toast.success(t.ticketCreated);
          }}
        />
      ) : null}

      <AlertDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmArchiveTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget ? t.confirmArchiveDescription : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                disabled={Boolean(archiveTarget && actionLoadingId === archiveTarget._id)}
              >
                {t.confirmArchiveCancel}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="secondary"
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap bg-orange-500 text-white hover:bg-orange-600 hover:text-white"
                disabled={!archiveTarget || actionLoadingId === archiveTarget._id}
                onClick={() => {
                  if (!archiveTarget) {
                    return;
                  }

                  void runArchive(archiveTarget._id);
                }}
              >
                {archiveTarget && actionLoadingId === archiveTarget._id ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : null}
                {t.confirmArchiveAction}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(draftDeleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDraftDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmDeleteDraftTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmDeleteDraftDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                disabled={Boolean(draftDeleteTarget && actionLoadingId === draftDeleteTarget._id)}
              >
                {t.confirmDeleteDraftCancel}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap bg-destructive text-white hover:bg-destructive/90 hover:text-white"
                disabled={!draftDeleteTarget || actionLoadingId === draftDeleteTarget._id}
                onClick={() => {
                  if (!draftDeleteTarget) {
                    return;
                  }

                  void runDeleteDraft(draftDeleteTarget._id);
                }}
              >
                {draftDeleteTarget && actionLoadingId === draftDeleteTarget._id ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : null}
                {t.confirmDeleteDraftAction}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeletePassword('');
            setDeleteReason('');
            setDeleteValidationError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? t.confirmDeleteDescription(deleteTarget.supplierRef || getExpenseSupplierLabel(deleteTarget)) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="expense-delete-password">{t.confirmDeletePasswordLabel}</Label>
              <Input
                id="expense-delete-password"
                type="password"
                value={deletePassword}
                onChange={(event) => {
                  setDeletePassword(event.target.value);
                  setDeleteValidationError(null);
                }}
                placeholder={t.confirmDeletePasswordPlaceholder}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-delete-reason">{t.confirmDeleteReasonLabel}</Label>
              <Textarea
                id="expense-delete-reason"
                value={deleteReason}
                onChange={(event) => {
                  setDeleteReason(event.target.value);
                  setDeleteValidationError(null);
                }}
                placeholder={t.confirmDeleteReasonPlaceholder}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{t.confirmDeleteReasonHint}</p>
            </div>
            {deleteValidationError ? (
              <p className="text-xs font-medium text-destructive">{deleteValidationError}</p>
            ) : null}
          </div>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                disabled={Boolean(deleteTarget && actionLoadingId === deleteTarget._id)}
              >
                {t.confirmDeleteCancel}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap bg-destructive text-white hover:bg-destructive/90 hover:text-white"
                disabled={!deleteTarget || actionLoadingId === deleteTarget._id}
                onClick={() => {
                  if (!deleteTarget) {
                    return;
                  }

                  const normalizedPassword = deletePassword.trim();
                  const normalizedReason = deleteReason.trim();

                  if (!normalizedPassword) {
                    setDeleteValidationError(t.confirmDeletePasswordRequired);
                    return;
                  }

                  if (normalizedReason.length < MIN_DELETE_REASON_LENGTH) {
                    setDeleteValidationError(t.confirmDeleteReasonRequired);
                    return;
                  }

                  setDeleteValidationError(null);
                  const targetId = deleteTarget._id;
                  void runDelete(targetId, normalizedPassword, normalizedReason);
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
