'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  ArchiveIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  CopyIcon,
  ExternalLinkIcon,
  FileUpIcon,
  Loader2Icon,
  MessageSquarePlusIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
} from 'lucide-react';

import CrmShell from '@/components/crm-shell';
import { AttachmentPreviewDialog } from '@/components/expenses/attachment-preview-dialog';
import { ExpensePaymentDialog } from '@/components/expenses/expense-payment-dialog';
import { ExpensePaymentStatusBadge } from '@/components/expenses/expense-payment-status-badge';
import { ExpenseFormDialog } from '@/components/expenses/expense-form-dialog';
import { ExpenseMoneyDisplay } from '@/components/expenses/expense-money-display';
import { ExpenseStatusBadge } from '@/components/expenses/expense-status-badge';
import { useLocale } from '@/components/providers/locale-provider';
import { CreateTicketDialog } from '@/components/tickets/create-ticket-dialog';
import { TicketStatusBadge } from '@/components/tickets/ticket-status-badge';
import { TicketUnreadIndicator } from '@/components/tickets/ticket-unread-indicator';
import { InvoiceStatusBadge } from '@/components/ui/InvoiceStatusBadge';
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
import { useAuthMe } from '@/hooks/useAuthMe';
import { useExpenseDetail } from '@/hooks/useExpenseDetail';
import { createInlineExpenseSupplier, useExpenseLookups } from '@/hooks/useExpenseLookups';
import { useTickets } from '@/hooks/useTickets';
import { canPermanentlyDeleteExpense, canRestoreArchivedExpense } from '@/lib/expenses/access';
import {
  EXPENSE_MAX_FILE_SIZE_BYTES,
  formatFileSizeMb,
  getExpenseFileExtension,
  isExpenseMimeTypeAllowed,
} from '@/lib/expenses/upload';
import { EXPENSE_ATTACHMENT_DELETE_REASONS } from '@/lib/expenses/constants';
import {
  getExpenseAttachmentDeleteReasonLabel,
  getExpenseEnumLabel,
  getExpensePaidByLabel,
  getExpensePaymentMethodLabel,
  getExpenseTypeLabel,
} from '@/lib/expenses/labels';
import { formatInvoiceDisplayNumber, getInvoiceStatusLabel } from '@/lib/i18n/messages';
import { hasPermission } from '@/lib/permissions';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type GenericApiResponse = {
  success: boolean;
  message?: string;
  expense?: Record<string, unknown>;
};

type ExpenseAttachment = {
  _id: string;
  originalName: string;
  displayName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  url: string;
};

type ExpenseAttachmentMutationResponse = {
  success: boolean;
  message?: string;
  attachment?: ExpenseAttachment;
};

type ExpenseAttachmentsListResponse = {
  success: boolean;
  message?: string;
  attachments?: ExpenseAttachment[];
};

type AuditLogEntry = {
  action: string;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
};

type AttachmentAuditPayload = {
  displayName: string | null;
  deletionReason: string | null;
  deletionReasonDetails: string | null;
};

type PaymentAuditPayload = {
  amountPaidCents: number | null;
  paidAt: string | null;
  paymentMethod: string | null;
  paidBy: string | null;
};

const TECHNICAL_AUDIT_FIELDS = new Set([
  '_id',
  'companyId',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'deletedAt',
  'archivedAt',
  '__v',
]);

const MONEY_AUDIT_FIELDS = new Set([
  'amountExclVatCents',
  'vatAmountCents',
  'amountInclVatCents',
  'amountPaidCents',
  'remainingBalanceCents',
]);

const DATE_AUDIT_FIELDS = new Set(['expenseDate', 'dueDate', 'paidAt']);

const AUDIT_FIELD_LABELS = {
  en: {
    amountExclVatCents: 'Amount excl. VAT',
    vatAmountCents: 'VAT amount',
    amountInclVatCents: 'Amount incl. VAT',
    amountPaidCents: 'Paid amount',
    expenseDate: 'Expense date',
    dueDate: 'Due date',
    paidAt: 'Paid at',
    paymentMethod: 'Payment method',
    paidBy: 'Paid by',
    paymentStatus: 'Payment status',
    status: 'Lifecycle status',
    supplierRef: 'Reference',
    expenseType: 'Type',
    supplierId: 'Supplier',
    categoryId: 'Category',
    clientId: 'Client',
    invoiceId: 'Invoice',
    projectId: 'Project',
    notes: 'Notes',
    attachments: 'Attachment',
    payments: 'Payment',
  },
  fr: {
    amountExclVatCents: 'Montant HT',
    vatAmountCents: 'Montant TVA',
    amountInclVatCents: 'Montant TTC',
    amountPaidCents: 'Montant payé',
    expenseDate: 'Date dépense',
    dueDate: 'Date limite',
    paidAt: 'Date paiement',
    paymentMethod: 'Mode de paiement',
    paidBy: 'Payé par',
    paymentStatus: 'Statut paiement',
    status: 'Statut cycle',
    supplierRef: 'Référence',
    expenseType: 'Type',
    supplierId: 'Fournisseur',
    categoryId: 'Catégorie',
    clientId: 'Client',
    invoiceId: 'Facture',
    projectId: 'Projet',
    notes: 'Notes',
    attachments: 'Pièce jointe',
    payments: 'Paiement',
  },
} as const;

const AUDIT_ACTION_LABELS = {
  en: {
    created: 'Creation',
    updated: 'Modification',
    deleted: 'Deletion',
    archived: 'Archived',
    duplicated: 'Duplicated',
    status_changed: 'Status changed',
    marked_paid: 'Expense settled',
    payment_added: 'Payment added',
  },
  fr: {
    created: 'Création',
    updated: 'Modification',
    deleted: 'Suppression',
    archived: 'Archivage',
    duplicated: 'Duplication',
    status_changed: 'Statut modifié',
    marked_paid: 'Dépense soldée',
    payment_added: 'Paiement ajouté',
  },
} as const;

const ATTACHMENT_OTHER_REASON_MIN_CHARS = 10;
const EXPENSE_DELETE_REASON_MIN_CHARS = 10;

type LinkedInvoiceStatus = 'unpaid' | 'partial_paid' | 'paid' | 'overdue';
type ExpenseDetailTab = 'summary' | 'attachments' | 'audit' | 'tickets';

function toLocaleString(locale: 'en' | 'fr') {
  return locale === 'fr' ? 'fr-FR' : 'en-GB';
}

function formatDate(value?: string | Date | null, locale: 'en' | 'fr' = 'fr') {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(toLocaleString(locale));
}

function formatDateTime(value?: string | Date | null, locale: 'en' | 'fr' = 'fr') {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(toLocaleString(locale));
}

function formatMoneyFromCents(cents: number, locale: 'en' | 'fr' = 'fr') {
  return new Intl.NumberFormat(toLocaleString(locale), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function isLinkedInvoiceStatus(value: unknown): value is LinkedInvoiceStatus {
  return value === 'unpaid' || value === 'partial_paid' || value === 'paid' || value === 'overdue';
}

function resolveEntityLabel(
  value:
    | string
    | {
        _id: string;
        fullName?: string;
        companyName?: string;
        invoiceNumber?: string;
        name?: string;
      }
    | null
    | undefined
) {
  if (!value) return '-';
  if (typeof value === 'string') return value;
  return value.fullName || value.companyName || value.invoiceNumber || value.name || value._id;
}

function resolveUserLabel(
  value:
    | string
    | {
        _id: string;
        name?: string;
        email?: string;
      }
    | null
    | undefined
) {
  if (!value) return '-';
  if (typeof value === 'string') return value;
  return value.name || value.email || value._id;
}

function resolveAssignedUsersLabel(
  assignedTo?: Array<
    | string
    | {
        _id: string;
        name?: string;
        email?: string;
      }
  >
) {
  if (!assignedTo || assignedTo.length === 0) return '-';

  const labels = assignedTo
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') return entry;
      return entry.name || entry.email || entry._id;
    })
    .filter(Boolean) as string[];

  return labels.length > 0 ? labels.join(', ') : '-';
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 KB';
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function formatAuditCurrency(cents: number, locale: 'en' | 'fr') {
  return new Intl.NumberFormat(toLocaleString(locale), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function normalizeAuditValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  if (
    !trimmed.startsWith('{') &&
    !trimmed.startsWith('[') &&
    !trimmed.startsWith('"')
  ) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function toAttachmentAuditPayload(value: unknown): AttachmentAuditPayload | null {
  const normalized = normalizeAuditValue(value);
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
    return null;
  }

  const payload = normalized as Record<string, unknown>;
  return {
    displayName: typeof payload.displayName === 'string' ? payload.displayName : null,
    deletionReason: typeof payload.deletionReason === 'string' ? payload.deletionReason : null,
    deletionReasonDetails:
      typeof payload.deletionReasonDetails === 'string' ? payload.deletionReasonDetails : null,
  };
}

function toPaymentAuditPayload(value: unknown): PaymentAuditPayload | null {
  const normalized = normalizeAuditValue(value);
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
    return null;
  }

  const payload = normalized as Record<string, unknown>;
  const amountRaw = payload.amountPaidCents;
  const amountPaidCents = typeof amountRaw === 'number' && Number.isFinite(amountRaw)
    ? Math.round(amountRaw)
    : null;

  return {
    amountPaidCents,
    paidAt: typeof payload.paidAt === 'string' ? payload.paidAt : null,
    paymentMethod: typeof payload.paymentMethod === 'string' ? payload.paymentMethod : null,
    paidBy: typeof payload.paidBy === 'string' ? payload.paidBy : null,
  };
}

function formatAuditField(fieldName: string | null | undefined, locale: 'en' | 'fr') {
  if (!fieldName) return '-';
  const labels = AUDIT_FIELD_LABELS[locale] as Record<string, string>;
  return labels[fieldName] || fieldName;
}

function formatAuditAction(log: AuditLogEntry, locale: 'en' | 'fr') {
  const oldAttachment = toAttachmentAuditPayload(log.oldValue);
  const newAttachment = toAttachmentAuditPayload(log.newValue);

  if (log.fieldName === 'attachments' || oldAttachment || newAttachment) {
    if (oldAttachment?.displayName && !newAttachment?.displayName) {
      return locale === 'fr'
        ? `Pièce jointe supprimée: ${oldAttachment.displayName}`
        : `Attachment removed: ${oldAttachment.displayName}`;
    }

    if (newAttachment?.displayName && !oldAttachment?.displayName) {
      return locale === 'fr'
        ? `Pièce jointe ajoutée: ${newAttachment.displayName}`
        : `Attachment added: ${newAttachment.displayName}`;
    }
  }

  if (log.action === 'payment_added' || log.action === 'marked_paid') {
    const payment = toPaymentAuditPayload(log.newValue);
    const amountPart =
      payment?.amountPaidCents != null ? `: ${formatAuditCurrency(payment.amountPaidCents, locale)}` : '';
    const base = AUDIT_ACTION_LABELS[locale][log.action] || log.action;
    return `${base}${amountPart}`;
  }

  return AUDIT_ACTION_LABELS[locale][log.action as keyof (typeof AUDIT_ACTION_LABELS)['en']] || getExpenseEnumLabel(log.action, locale);
}

function formatAttachmentAuditValue(value: unknown, locale: 'en' | 'fr') {
  const attachment = toAttachmentAuditPayload(value);
  if (!attachment?.displayName) return '-';

  if (!attachment.deletionReason) {
    return attachment.displayName;
  }

  const reasonLabel = getExpenseAttachmentDeleteReasonLabel(attachment.deletionReason, locale);
  const details = (attachment.deletionReasonDetails || '').trim();

  if (!details) {
    return `${attachment.displayName} (${reasonLabel})`;
  }

  return `${attachment.displayName} (${reasonLabel}: ${details})`;
}

function formatPaymentAuditValue(value: unknown, locale: 'en' | 'fr') {
  const payment = toPaymentAuditPayload(value);
  if (!payment) return '-';

  const parts: string[] = [];
  if (payment.amountPaidCents != null) {
    parts.push(formatAuditCurrency(payment.amountPaidCents, locale));
  }
  if (payment.paidAt) {
    parts.push(formatDate(payment.paidAt, locale));
  }
  if (payment.paymentMethod) {
    parts.push(getExpensePaymentMethodLabel(payment.paymentMethod, locale));
  }
  if (payment.paidBy) {
    parts.push(getExpensePaidByLabel(payment.paidBy, locale));
  }

  return parts.length > 0 ? parts.join(' · ') : '-';
}

function formatAuditValue(value: unknown, locale: 'en' | 'fr', fieldName?: string | null) {
  const normalizedValue = normalizeAuditValue(value);

  if (fieldName === 'attachments') {
    return formatAttachmentAuditValue(normalizedValue, locale);
  }

  if (fieldName === 'payments') {
    return formatPaymentAuditValue(normalizedValue, locale);
  }

  if (normalizedValue == null) return '-';

  if (normalizedValue instanceof Date) {
    return DATE_AUDIT_FIELDS.has(fieldName || '')
      ? formatDate(normalizedValue, locale)
      : formatDateTime(normalizedValue, locale);
  }

  if (typeof normalizedValue === 'number') {
    if (MONEY_AUDIT_FIELDS.has(fieldName || '')) {
      return formatAuditCurrency(normalizedValue, locale);
    }
    return String(normalizedValue);
  }

  if (typeof normalizedValue === 'boolean') {
    return normalizedValue ? (locale === 'fr' ? 'Oui' : 'Yes') : locale === 'fr' ? 'Non' : 'No';
  }

  if (typeof normalizedValue === 'string') {
    if (MONEY_AUDIT_FIELDS.has(fieldName || '')) {
      const cents = Number(normalizedValue);
      if (Number.isFinite(cents)) {
        return formatAuditCurrency(Math.round(cents), locale);
      }
    }

    if (DATE_AUDIT_FIELDS.has(fieldName || '')) {
      return formatDate(normalizedValue, locale);
    }

    if (fieldName === 'createdAt' || fieldName === 'updatedAt') {
      return formatDateTime(normalizedValue, locale);
    }

    return getExpenseEnumLabel(normalizedValue, locale);
  }

  try {
    return JSON.stringify(normalizedValue);
  } catch {
    return String(normalizedValue);
  }
}

function shouldHideAuditLog(log: AuditLogEntry) {
  if (!log.fieldName) return false;
  if (log.fieldName === 'attachments' || log.fieldName === 'payments') {
    return false;
  }

  return log.action === 'updated' && TECHNICAL_AUDIT_FIELDS.has(log.fieldName);
}

function inferMimeFromFile(file: File) {
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

function isImageMimeType(mimeType?: string) {
  return typeof mimeType === 'string' && mimeType.startsWith('image/');
}

function isPdfMimeType(mimeType?: string) {
  return mimeType === 'application/pdf';
}

function getExpenseDetailHeroClass(status: string, paymentStatus: string) {
  if (status === 'draft') {
    return 'border-amber-200/80 bg-amber-50/55 dark:border-amber-900/45 dark:bg-amber-950/20';
  }

  if (status === 'archived') {
    return 'border-slate-200/80 bg-slate-50/70 dark:border-slate-800/70 dark:bg-slate-900/30';
  }

  if (paymentStatus === 'paid') {
    return 'border-emerald-200/80 bg-emerald-50/55 dark:border-emerald-900/45 dark:bg-emerald-950/20';
  }

  if (paymentStatus === 'partial') {
    return 'border-amber-200/75 bg-amber-50/45 dark:border-amber-900/40 dark:bg-amber-950/18';
  }

  return 'border-rose-200/75 bg-rose-50/45 dark:border-rose-900/40 dark:bg-rose-950/18';
}

function getRemainingAmountClass(paymentStatus: string, remainingBalanceCents: number) {
  if (remainingBalanceCents <= 0 || paymentStatus === 'paid') {
    return 'border-emerald-200/75 bg-emerald-50/65 dark:border-emerald-900/45 dark:bg-emerald-950/30';
  }

  if (paymentStatus === 'partial') {
    return 'border-amber-200/75 bg-amber-50/65 dark:border-amber-900/45 dark:bg-amber-950/30';
  }

  return 'border-rose-200/75 bg-rose-50/65 dark:border-rose-900/45 dark:bg-rose-950/30';
}

function resolveExpenseIdFromActionPayload(payload: GenericApiResponse | null) {
  if (!payload?.expense || typeof payload.expense !== 'object') {
    return null;
  }

  const candidateId = (payload.expense as { _id?: unknown })._id;
  return typeof candidateId === 'string' && candidateId.trim() ? candidateId : null;
}

function parseExpenseDetailTab(value: string | null): ExpenseDetailTab {
  if (value === 'attachments' || value === 'audit' || value === 'tickets') {
    return value;
  }

  return 'summary';
}

export default function ExpenseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const expenseId = typeof params?.id === 'string' ? params.id : '';
  const { locale } = useLocale();
  const { user, loading: authLoading } = useAuthMe();
  const { expense, loading, error, refetch } = useExpenseDetail(expenseId);
  const { categories, suppliers, clients, invoices, refetch: refetchLookups } = useExpenseLookups(undefined, 80);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const requestedTab = parseExpenseDetailTab(searchParams.get('tab'));
  const previousRequestedTabRef = useRef<ExpenseDetailTab>(requestedTab);

  const [activeTab, setActiveTab] = useState<ExpenseDetailTab>(requestedTab);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [attachmentsBusy, setAttachmentsBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [settleExpenseOpen, setSettleExpenseOpen] = useState(false);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteValidationError, setDeleteValidationError] = useState<string | null>(null);
  const [deleteAttachmentDialogOpen, setDeleteAttachmentDialogOpen] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<ExpenseAttachment | null>(null);
  const [attachmentDeleteReason, setAttachmentDeleteReason] = useState('');
  const [attachmentDeleteReasonDetails, setAttachmentDeleteReasonDetails] = useState('');
  const [attachmentDeleteReasonError, setAttachmentDeleteReasonError] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<ExpenseAttachment | null>(null);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [attachments, setAttachments] = useState<ExpenseAttachment[]>([]);

  const openedFromDuplicate = searchParams.get('fromDuplicate') === '1';
  const copiedFromExpenseId = (searchParams.get('copiedFrom') || '').trim();
  const copiedSourceLabel = (searchParams.get('copiedLabel') || '').trim();
  const duplicateContextLabel = copiedSourceLabel || copiedFromExpenseId;

  useEffect(() => {
    if (requestedTab !== previousRequestedTabRef.current) {
      previousRequestedTabRef.current = requestedTab;
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const t = useMemo(
    () =>
      ({
        en: {
          shellTitle: 'Expense detail',
          forbiddenTitle: 'You do not have access to expenses',
          forbiddenHelp: 'Ask an administrator to grant expenses permissions.',
          back: 'Back to Expenses',
          refresh: 'Refresh',
          notFound: 'Expense not found or you do not have access to it.',
          summaryTab: 'Summary',
          attachmentsTab: 'Attachments',
          auditTab: 'Audit trail',
          ticketsTab: 'Linked tickets',
          summary: 'Summary',
          financial: 'Financials',
          links: 'Relations',
          lifecycle: 'Lifecycle',
          amountExclVat: 'Amount excl. VAT',
          vatAmount: 'VAT amount',
          amountInclVat: 'Amount incl. VAT',
          amountPaid: 'Amount paid',
          remaining: 'Remaining',
          date: 'Expense date',
          dueDate: 'Due date',
          paidAt: 'Paid at',
          paidBy: 'Paid by',
          reference: 'Reference',
          supplier: 'Supplier',
          category: 'Category',
          client: 'Client',
          invoice: 'Invoice',
          openInvoice: 'Open invoice',
          project: 'Project',
          type: 'Type',
          paymentMethod: 'Payment method',
          paymentStatus: 'Payment status',
          lifecycleStatus: 'Lifecycle status',
          paymentHistory: 'Payment history',
          paymentHistoryHint: 'Each payment is recorded as a separate line for accounting traceability.',
          paymentRecordedBy: 'Recorded by',
          paymentRecordedAt: 'Recorded at',
          noPaymentHistory: 'No payment lines recorded yet.',
          notes: 'Notes',
          status: 'Status',
          createdBy: 'Created by',
          updatedBy: 'Updated by',
          createdAt: 'Created at',
          updatedAt: 'Updated at',
          noNotes: 'No notes',
          openFile: 'Open file',
          preview: 'Preview',
          uploadAttachment: 'Upload attachment',
          addAttachment: 'Add attachment',
          replaceFileHint: `Allowed: PDF/JPEG/PNG/HEIC. Max ${formatFileSizeMb(EXPENSE_MAX_FILE_SIZE_BYTES)} MB`,
          deleteAttachment: 'Delete',
          deleteAttachmentDialogTitle: 'Delete attachment',
          deleteAttachmentDialogDescription: 'Select a reason before deleting this attachment.',
          deleteAttachmentReasonLabel: 'Deletion reason',
          deleteAttachmentReasonPlaceholder: 'Select a reason',
          deleteAttachmentReasonRequired: 'A deletion reason is required',
          deleteAttachmentReasonDetailsLabel: 'Reason details',
          deleteAttachmentReasonDetailsPlaceholder: 'Provide details (minimum 10 characters)',
          deleteAttachmentReasonDetailsMin: 'Please enter at least 10 characters for Other',
          deleteAttachmentConfirmAction: 'Delete attachment',
          noAttachments: 'No attachments linked to this expense yet.',
          uploadFailed: 'Attachment upload failed',
          uploadAssociationFailed: 'Attachment uploaded but could not be linked to this expense.',
          uploadSuccess: 'Attachment uploaded',
          deleteSuccess: 'Attachment deleted',
          duplicate: 'Duplicate',
          archive: 'Archive',
          edit: 'Edit',
          settleExpense: 'Settle expense',
          settleExpenseSuccess: 'Expense settled',
          addPayment: 'Add payment',
          addPaymentSuccess: 'Payment added',
          restore: 'Restore',
          restoreSuccess: 'Expense restored',
          delete: 'Delete',
          actionFailed: 'Action failed',
          archivedReadOnlyHint: 'Archived expenses are read-only. Restore first to edit, pay, or add attachments.',
          duplicateSuccess: 'Expense duplicated',
          duplicateContextTitle: 'Copy created successfully',
          duplicateContextDescription: (label: string) =>
            label
              ? `This expense is a copy of ${label}.`
              : 'This expense was created from a duplicate action.',
          openSourceExpense: 'Open source expense',
          archiveSuccess: 'Expense archived',
          deleteSuccessExpense: 'Expense deleted',
          confirmArchive: 'Archive this expense?',
          confirmArchiveTitle: 'Archive expense',
          confirmArchiveDescription: (label: string) =>
            `This expense (${label}) will be moved to archived records and become read-only until restored.`,
          confirmArchiveCancel: 'Cancel',
          confirmArchiveAction: 'Archive expense',
          confirmDelete: 'Delete this expense? This cannot be undone.',
          confirmDeleteTitle: 'Confirm expense deletion',
          confirmDeletePasswordLabel: 'Confirm with your password',
          confirmDeletePasswordPlaceholder: 'Enter your account password',
          confirmDeleteReasonLabel: 'Deletion reason',
          confirmDeleteReasonPlaceholder: 'Explain why this accounting record must be permanently deleted',
          confirmDeleteReasonHint: `Minimum ${EXPENSE_DELETE_REASON_MIN_CHARS} characters`,
          confirmDeletePasswordRequired: 'Password confirmation is required',
          confirmDeleteReasonRequired: `Deletion reason must contain at least ${EXPENSE_DELETE_REASON_MIN_CHARS} characters`,
          confirmDeleteCancel: 'Cancel',
          confirmDeleteAction: 'Delete expense',
          confirmDeleteAttachment: 'Delete this attachment?',
          noAudit: 'No audit events recorded yet.',
          auditAction: 'Action',
          auditField: 'Field',
          auditFrom: 'From',
          auditTo: 'To',
          auditBy: 'By',
          auditAt: 'At',
          noTickets: 'No linked tickets yet.',
          linkedTicketsLoading: 'Loading linked tickets...',
          linkedTicketsError: 'Unable to load linked tickets',
          createLinkedTicket: 'Create linked ticket',
          ticketCreated: 'Ticket created',
          ticketAssignedTo: 'Assigned to',
          ticketUpdatedAt: 'Updated at',
          statusDraftHint: 'This expense is still draft. Complete fields and validate it from the edit dialog.',
          draftAttachmentPreview: 'Imported file preview',
          draftAttachmentPreviewHint: 'Visual preview of the first file linked to this draft.',
          openAttachmentsTab: 'Open attachments tab',
          heroAmountInclVat: 'Total incl. VAT',
          heroAmountPaid: 'Paid to date',
          heroRemaining: 'Outstanding balance',
          heroAttachments: 'Attached files',
        },
        fr: {
          shellTitle: 'Détail dépense',
          forbiddenTitle: "Vous n'avez pas accès aux dépenses",
          forbiddenHelp: "Demandez à un administrateur d'activer les permissions dépenses.",
          back: 'Retour aux dépenses',
          refresh: 'Actualiser',
          notFound: "Dépense introuvable ou accès refusé.",
          summaryTab: 'Résumé',
          attachmentsTab: 'Pièces jointes',
          auditTab: 'Journal audit',
          ticketsTab: 'Tickets liés',
          summary: 'Résumé',
          financial: 'Financier',
          links: 'Relations',
          lifecycle: 'Cycle de vie',
          amountExclVat: 'Montant HT',
          vatAmount: 'Montant TVA',
          amountInclVat: 'Montant TTC',
          amountPaid: 'Montant payé',
          remaining: 'Reste',
          date: 'Date dépense',
          dueDate: 'Date limite',
          paidAt: 'Date paiement',
          paidBy: 'Payé par',
          reference: 'Référence',
          supplier: 'Fournisseur',
          category: 'Catégorie',
          client: 'Client',
          invoice: 'Facture',
          openInvoice: 'Ouvrir facture',
          project: 'Projet',
          type: 'Type',
          paymentMethod: 'Mode de paiement',
          paymentStatus: 'Statut paiement',
          lifecycleStatus: 'Statut cycle',
          paymentHistory: 'Historique des paiements',
          paymentHistoryHint: 'Chaque paiement est enregistré en ligne distincte pour une traçabilité comptable.',
          paymentRecordedBy: 'Saisi par',
          paymentRecordedAt: 'Saisi le',
          noPaymentHistory: 'Aucune ligne de paiement enregistrée.',
          notes: 'Notes',
          status: 'Statut',
          createdBy: 'Créé par',
          updatedBy: 'Modifié par',
          createdAt: 'Créé le',
          updatedAt: 'Modifié le',
          noNotes: 'Aucune note',
          openFile: 'Ouvrir fichier',
          preview: 'Aperçu',
          uploadAttachment: 'Ajouter pièce jointe',
          addAttachment: 'Ajouter pièce jointe',
          replaceFileHint: `Autorisés : PDF/JPEG/PNG/HEIC. Max ${formatFileSizeMb(EXPENSE_MAX_FILE_SIZE_BYTES)} MB`,
          deleteAttachment: 'Supprimer',
          deleteAttachmentDialogTitle: 'Supprimer la pièce jointe',
          deleteAttachmentDialogDescription: 'Sélectionnez un motif avant de supprimer cette pièce jointe.',
          deleteAttachmentReasonLabel: 'Motif de suppression',
          deleteAttachmentReasonPlaceholder: 'Sélectionner un motif',
          deleteAttachmentReasonRequired: 'Le motif de suppression est obligatoire',
          deleteAttachmentReasonDetailsLabel: 'Détails du motif',
          deleteAttachmentReasonDetailsPlaceholder: 'Précisez le motif (minimum 10 caractères)',
          deleteAttachmentReasonDetailsMin: 'Veuillez saisir au moins 10 caractères pour Autre',
          deleteAttachmentConfirmAction: 'Supprimer la pièce jointe',
          noAttachments: 'Aucune pièce jointe sur cette dépense.',
          uploadFailed: 'Échec upload pièce jointe',
          uploadAssociationFailed: 'La pièce jointe a été envoyée mais elle ne peut pas être liée à cette dépense.',
          uploadSuccess: 'Pièce jointe ajoutée',
          deleteSuccess: 'Pièce jointe supprimée',
          duplicate: 'Dupliquer',
          archive: 'Archiver',
          edit: 'Modifier',
          settleExpense: 'Solder la dépense',
          settleExpenseSuccess: 'Dépense soldée',
          addPayment: 'Ajouter un paiement',
          addPaymentSuccess: 'Paiement ajouté',
          restore: 'Restaurer',
          restoreSuccess: 'Dépense restaurée',
          delete: 'Supprimer',
          actionFailed: 'Échec action',
          archivedReadOnlyHint: "Les dépenses archivées sont en lecture seule. Restaurez d'abord pour modifier, payer ou ajouter des pièces.",
          duplicateSuccess: 'Dépense dupliquée',
          duplicateContextTitle: 'Copie créée avec succès',
          duplicateContextDescription: (label: string) =>
            label
              ? `Cette dépense est une copie de ${label}.`
              : 'Cette dépense provient d\'une action de duplication.',
          openSourceExpense: 'Ouvrir la dépense source',
          archiveSuccess: 'Dépense archivée',
          deleteSuccessExpense: 'Dépense supprimée',
          confirmArchive: 'Archiver cette dépense ?',
          confirmArchiveTitle: 'Archiver la dépense',
          confirmArchiveDescription: (label: string) =>
            `Cette dépense (${label}) sera déplacée dans les archives et restera en lecture seule jusqu'à restauration.`,
          confirmArchiveCancel: 'Annuler',
          confirmArchiveAction: 'Archiver dépense',
          confirmDelete: 'Supprimer cette dépense ? Action irréversible.',
          confirmDeleteTitle: 'Confirmer suppression dépense',
          confirmDeletePasswordLabel: 'Confirmez avec votre mot de passe',
          confirmDeletePasswordPlaceholder: 'Saisissez le mot de passe du compte',
          confirmDeleteReasonLabel: 'Motif de suppression',
          confirmDeleteReasonPlaceholder: 'Expliquez pourquoi cet enregistrement comptable doit être supprimé définitivement',
          confirmDeleteReasonHint: `Minimum ${EXPENSE_DELETE_REASON_MIN_CHARS} caractères`,
          confirmDeletePasswordRequired: 'La confirmation par mot de passe est obligatoire',
          confirmDeleteReasonRequired: `Le motif doit contenir au moins ${EXPENSE_DELETE_REASON_MIN_CHARS} caractères`,
          confirmDeleteCancel: 'Annuler',
          confirmDeleteAction: 'Supprimer dépense',
          confirmDeleteAttachment: 'Supprimer cette pièce jointe ?',
          noAudit: 'Aucun événement audit enregistré.',
          auditAction: 'Action',
          auditField: 'Champ',
          auditFrom: 'Avant',
          auditTo: 'Après',
          auditBy: 'Par',
          auditAt: 'Date',
          noTickets: 'Aucun ticket lié.',
          linkedTicketsLoading: 'Chargement des tickets liés...',
          linkedTicketsError: 'Impossible de charger les tickets liés',
          createLinkedTicket: 'Créer un ticket lié',
          ticketCreated: 'Ticket créé',
          ticketAssignedTo: 'Assigné à',
          ticketUpdatedAt: 'Mis à jour le',
          statusDraftHint: 'Cette dépense est brouillon. Complétez et validez depuis le formulaire de modification.',
          draftAttachmentPreview: 'Aperçu du fichier importé',
          draftAttachmentPreviewHint: 'Aperçu visuel du premier fichier lié à ce brouillon.',
          openAttachmentsTab: 'Ouvrir les pièces jointes',
          heroAmountInclVat: 'Total TTC',
          heroAmountPaid: 'Déjà payé',
          heroRemaining: 'Solde restant',
          heroAttachments: 'Fichiers joints',
        },
      })[locale],
    [locale]
  );

  const canManageExpenses = hasPermission(user?.role, 'expenses.manage');
  const canPermanentlyDelete = canPermanentlyDeleteExpense(user?.role);
  const canRestoreArchived = canRestoreArchivedExpense(user?.role);
  const canViewTickets = hasPermission(user?.role, 'tickets.view');
  const canManageTickets = hasPermission(user?.role, 'tickets.manage');

  const {
    tickets: linkedTickets,
    loading: linkedTicketsLoading,
    error: linkedTicketsError,
    refetch: refetchLinkedTickets,
  } = useTickets(
    {
      linkedType: 'expense',
      linkedId: expenseId,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      page: 1,
      limit: 20,
    },
    Boolean(expenseId) && canViewTickets
  );

  const visibleAuditLogs = useMemo(
    () => (expense?.auditLogs || []).filter((log) => !shouldHideAuditLog(log as AuditLogEntry)),
    [expense?.auditLogs]
  );

  const isExpenseArchived = expense?.status === 'archived';

  const linkedInvoiceSummary = useMemo(() => {
    const invoiceValue = expense?.invoiceId;
    if (!invoiceValue || typeof invoiceValue === 'string') {
      return null;
    }

    const hasDisplayInvoiceNumber = typeof invoiceValue.invoiceNumber === 'string' && invoiceValue.invoiceNumber.trim();
    const displayNumber = hasDisplayInvoiceNumber
      ? formatInvoiceDisplayNumber(locale, invoiceValue.invoiceNumber as string)
      : invoiceValue._id;

    const clientName =
      invoiceValue.clientSnapshot?.fullName ||
      invoiceValue.clientSnapshot?.companyName ||
      invoiceValue.companyName ||
      '-';

    const amountCents =
      typeof invoiceValue.totalIncludingTax === 'number'
        ? Math.max(0, Math.round(invoiceValue.totalIncludingTax))
        : null;

    const status = isLinkedInvoiceStatus(invoiceValue.status) ? invoiceValue.status : null;
    const statusLabel = status ? getInvoiceStatusLabel(locale, status) : '-';

    return {
      id: invoiceValue._id,
      displayNumber,
      clientName,
      amountLabel: amountCents === null ? '-' : formatMoneyFromCents(amountCents, locale),
      status,
      statusLabel,
    };
  }, [expense?.invoiceId, locale]);

  function mergeAttachmentsById(
    incoming: ExpenseAttachment[],
    existing: ExpenseAttachment[]
  ): ExpenseAttachment[] {
    const merged = new Map<string, ExpenseAttachment>();

    for (const attachment of incoming) {
      merged.set(attachment._id, attachment);
    }

    for (const attachment of existing) {
      if (!merged.has(attachment._id)) {
        merged.set(attachment._id, attachment);
      }
    }

    return Array.from(merged.values());
  }

  const refreshAttachmentList = useCallback(async () => {
    if (!expenseId) {
      setAttachments([]);
      return [] as ExpenseAttachment[];
    }

    const response = await fetch(`/api/expenses/${expenseId}/attachments`, { cache: 'no-store' });
    const payload = (await response.json().catch(() => null)) as ExpenseAttachmentsListResponse | null;

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message || t.actionFailed);
    }

    const nextAttachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    setAttachments(nextAttachments);
    return nextAttachments;
  }, [expenseId, t.actionFailed]);

  useEffect(() => {
    if (!expense) {
      setAttachments([]);
      return;
    }

    const incomingAttachments = Array.isArray(expense.attachments) ? expense.attachments : [];
    setAttachments((existing) => mergeAttachmentsById(incomingAttachments, existing));
  }, [expense]);

  useEffect(() => {
    if (!expense || activeTab !== 'attachments') {
      return;
    }

    void refreshAttachmentList().catch(() => {
      // Keep the already loaded expense payload if the attachments endpoint temporarily fails.
    });
  }, [activeTab, expense, refreshAttachmentList]);

  function pushFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message });
    window.setTimeout(() => {
      setFeedback((previous) => {
        if (!previous || previous.message !== message) return previous;
        return null;
      });
    }, 3000);
  }

  function openAttachmentUpload() {
    setActiveTab('attachments');

    if (fileInputRef.current) {
      fileInputRef.current.click();
      return;
    }

    window.requestAnimationFrame(() => {
      fileInputRef.current?.click();
    });
  }

  async function handleRefresh() {
    const [detailResult, attachmentsResult] = await Promise.allSettled([refetch(), refreshAttachmentList()]);

    if (detailResult.status === 'fulfilled' || attachmentsResult.status === 'fulfilled') {
      setAttachmentError(null);
      return;
    }

    const detailMessage = detailResult.reason instanceof Error ? detailResult.reason.message : null;
    const attachmentMessage =
      attachmentsResult.reason instanceof Error ? attachmentsResult.reason.message : null;
    const message = detailMessage || attachmentMessage || t.actionFailed;

    setAttachmentError(message);
    pushFeedback('error', message);
  }

  async function runAction(action: 'duplicate' | 'archive' | 'restore') {
    if (!expense) return;

    if (isExpenseArchived && action !== 'restore') {
      pushFeedback('error', t.archivedReadOnlyHint);
      return;
    }

    if (!isExpenseArchived && action === 'restore') {
      return;
    }

    setActionLoading(action);

    try {
      const response = await fetch(`/api/expenses/${expense._id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'duplicate'
            ? { action: 'duplicate', copyAttachments: true }
            : action === 'restore'
              ? { action: 'restore' }
              : { action: 'archive' }
        ),
      });

      const payload = (await response.json().catch(() => null)) as GenericApiResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.actionFailed);
      }

      if (action === 'duplicate') {
        const duplicatedExpenseId = resolveExpenseIdFromActionPayload(payload);
        const copyLabel = expense.supplierRef?.trim() || resolveEntityLabel(expense.supplierId) || expense._id;

        toast.success(t.duplicateSuccess);
        pushFeedback('success', t.duplicateSuccess);

        if (!duplicatedExpenseId) {
          await refetch();
          return;
        }

        const query = new URLSearchParams({
          fromDuplicate: '1',
          copiedFrom: expense._id,
          copiedLabel: copyLabel,
        });
        router.push(`/expenses/${duplicatedExpenseId}?${query.toString()}`);
        return;
      }

      await refetch();
      if (action === 'archive') {
        setArchiveConfirmOpen(false);
      }
      pushFeedback(
        'success',
        action === 'restore'
            ? t.restoreSuccess
            : t.archiveSuccess
      );
    } catch (actionError) {
      pushFeedback('error', actionError instanceof Error ? actionError.message : t.actionFailed);
    } finally {
      setActionLoading(null);
    }
  }

  async function runDelete() {
    if (!expense) return;

    const normalizedPassword = deletePassword.trim();
    const normalizedReason = deleteReason.trim();

    if (!normalizedPassword) {
      setDeleteValidationError(t.confirmDeletePasswordRequired);
      return;
    }

    if (normalizedReason.length < EXPENSE_DELETE_REASON_MIN_CHARS) {
      setDeleteValidationError(t.confirmDeleteReasonRequired);
      return;
    }

    setDeleteValidationError(null);

    setActionLoading('delete');

    try {
      const response = await fetch(`/api/expenses/${expense._id}?mode=delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: normalizedPassword,
          deleteReason: normalizedReason,
        }),
      });

      const payload = (await response.json().catch(() => null)) as GenericApiResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.actionFailed);
      }

      setDeleteConfirmOpen(false);
      pushFeedback('success', t.deleteSuccessExpense);
      toast.success(t.deleteSuccessExpense);
      setDeletePassword('');
      setDeleteReason('');
      setDeleteValidationError(null);
      window.setTimeout(() => {
        window.location.href = '/expenses';
      }, 500);
    } catch (deleteError) {
      pushFeedback('error', deleteError instanceof Error ? deleteError.message : t.actionFailed);
    } finally {
      setActionLoading(null);
    }
  }

  async function uploadAttachment(file: File): Promise<ExpenseAttachment> {
    if (!expense) {
      throw new Error(t.actionFailed);
    }

    if (expense.status === 'archived') {
      throw new Error(t.archivedReadOnlyHint);
    }

    const mimeType = inferMimeFromFile(file);
    if (!mimeType) {
      throw new Error(t.uploadFailed);
    }

    if (file.size > EXPENSE_MAX_FILE_SIZE_BYTES) {
      throw new Error(t.replaceFileHint);
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
      | {
          success: boolean;
          message?: string;
          uploadUrl?: string;
          fileUrl?: string;
          key?: string;
        }
      | null;

    if (
      !presignResponse.ok ||
      !presignPayload?.success ||
      !presignPayload.uploadUrl ||
      !presignPayload.fileUrl ||
      !presignPayload.key
    ) {
      throw new Error(presignPayload?.message || t.uploadFailed);
    }

    const uploadResponse = await fetch(presignPayload.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': mimeType,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(t.uploadFailed);
    }

    const extension = getExpenseFileExtension(file.name, mimeType);

    const attachmentResponse = await fetch(`/api/expenses/${expense._id}/attachments`, {
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

    const attachmentPayload = (await attachmentResponse.json().catch(() => null)) as
      | ExpenseAttachmentMutationResponse
      | null;

    if (!attachmentResponse.ok || !attachmentPayload?.success || !attachmentPayload.attachment?._id) {
      throw new Error(attachmentPayload?.message || t.uploadFailed);
    }

    return attachmentPayload.attachment;
  }

  async function handleAttachmentUpload(files: File[] | null) {
    if (!files || files.length === 0 || !expense || !canManageExpenses) {
      return;
    }

    if (expense.status === 'archived') {
      setAttachmentError(t.archivedReadOnlyHint);
      return;
    }

    setAttachmentsBusy(true);
    setAttachmentError(null);

    try {
      const uploadedAttachments: ExpenseAttachment[] = [];

      for (const file of files) {
        const createdAttachment = await uploadAttachment(file);
        uploadedAttachments.push(createdAttachment);
      }

      if (uploadedAttachments.length > 0) {
        setAttachments((previous) => mergeAttachmentsById(uploadedAttachments, previous));
      }

      const [attachmentsRefreshResult] = await Promise.allSettled([
        refreshAttachmentList(),
        refetch(),
      ]);

      if (attachmentsRefreshResult.status === 'fulfilled' && uploadedAttachments.length > 0) {
        const refreshedAttachmentIds = new Set(
          attachmentsRefreshResult.value.map((attachment) => attachment._id)
        );
        const hasMissingAssociation = uploadedAttachments.some(
          (attachment) => !refreshedAttachmentIds.has(attachment._id)
        );

        if (hasMissingAssociation) {
          setAttachments((previous) => mergeAttachmentsById(uploadedAttachments, previous));
        }
      }

      setAttachmentError(null);
      pushFeedback('success', t.uploadSuccess);
      toast.success(t.uploadSuccess);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : t.uploadFailed;
      setAttachmentError(message);
      pushFeedback('error', message);
      toast.error(message);
    } finally {
      setAttachmentsBusy(false);
    }
  }

  function openDeleteAttachmentDialog(attachment: ExpenseAttachment) {
    if (expense?.status === 'archived') {
      setAttachmentError(t.archivedReadOnlyHint);
      return;
    }

    setAttachmentToDelete(attachment);
    setAttachmentDeleteReason('');
    setAttachmentDeleteReasonDetails('');
    setAttachmentDeleteReasonError(null);
    setDeleteAttachmentDialogOpen(true);
  }

  function closeDeleteAttachmentDialog() {
    setDeleteAttachmentDialogOpen(false);
    setAttachmentToDelete(null);
    setAttachmentDeleteReason('');
    setAttachmentDeleteReasonDetails('');
    setAttachmentDeleteReasonError(null);
  }

  async function handleDeleteAttachment(params: {
    attachmentId: string;
    reason: string;
    reasonDetails?: string;
  }) {
    if (!expense || !canManageExpenses) return;

    setAttachmentsBusy(true);
    setAttachmentError(null);

    try {
      const response = await fetch(`/api/expenses/${expense._id}/attachments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const payload = (await response.json().catch(() => null)) as GenericApiResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.actionFailed);
      }

      await Promise.allSettled([refetch(), refreshAttachmentList()]);
      setAttachmentError(null);
      pushFeedback('success', t.deleteSuccess);
      closeDeleteAttachmentDialog();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : t.actionFailed;
      setAttachmentError(message);
      pushFeedback('error', message);
    } finally {
      setAttachmentsBusy(false);
    }
  }

  async function confirmAttachmentDeletion() {
    if (!attachmentToDelete) {
      return;
    }

    const normalizedReason = attachmentDeleteReason.trim();
    if (!normalizedReason) {
      setAttachmentDeleteReasonError(t.deleteAttachmentReasonRequired);
      return;
    }

    if (!EXPENSE_ATTACHMENT_DELETE_REASONS.includes(normalizedReason as (typeof EXPENSE_ATTACHMENT_DELETE_REASONS)[number])) {
      setAttachmentDeleteReasonError(t.deleteAttachmentReasonRequired);
      return;
    }

    const normalizedDetails = attachmentDeleteReasonDetails.trim();
    if (normalizedReason === 'other' && normalizedDetails.length < ATTACHMENT_OTHER_REASON_MIN_CHARS) {
      setAttachmentDeleteReasonError(t.deleteAttachmentReasonDetailsMin);
      return;
    }

    setAttachmentDeleteReasonError(null);

    await handleDeleteAttachment({
      attachmentId: attachmentToDelete._id,
      reason: normalizedReason,
      reasonDetails: normalizedReason === 'other' ? normalizedDetails : undefined,
    });
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

  if (!hasPermission(user?.role, 'expenses.view')) {
    return (
      <CrmShell title={t.shellTitle}>
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>{t.forbiddenTitle}</CardTitle>
            <CardDescription>{t.forbiddenHelp}</CardDescription>
          </CardHeader>
        </Card>
      </CrmShell>
    );
  }

  return (
    <CrmShell title={t.shellTitle}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild type="button" variant="outline" size="sm">
              <Link href="/expenses">
                <ArrowLeftIcon className="size-3.5" />
                {t.back}
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void handleRefresh()}>
              <RefreshCwIcon className="size-3.5" />
              {t.refresh}
            </Button>
          </div>

          {feedback ? (
            <p className={`text-xs font-medium ${feedback.type === 'success' ? 'text-emerald-600' : 'text-destructive'}`}>
              {feedback.message}
            </p>
          ) : null}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.heic"
          className="hidden"
          multiple
          onChange={(event) => {
            const selectedFiles = event.target.files ? Array.from(event.target.files) : null;
            event.target.value = '';
            void handleAttachmentUpload(selectedFiles);
          }}
        />

        {openedFromDuplicate ? (
          <Card className="border-sky-200/80 bg-sky-50/55 dark:border-sky-900/45 dark:bg-sky-950/20">
            <CardContent className="flex flex-col items-start gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">{t.duplicateContextTitle}</p>
                <p className="text-xs text-sky-800/85 dark:text-sky-200/85">{t.duplicateContextDescription(duplicateContextLabel)}</p>
              </div>
              {copiedFromExpenseId ? (
                <Button
                  asChild
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:w-auto sm:whitespace-nowrap"
                >
                  <Link href={`/expenses/${copiedFromExpenseId}`}>
                    {t.openSourceExpense}
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {loading ? (
          <div className="flex min-h-52 items-center justify-center">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <ErrorMessage message={error} />
        ) : !expense ? (
          <EmptyState message={t.notFound} />
        ) : (
          <>
            <Card className={getExpenseDetailHeroClass(expense.status, expense.paymentStatus)}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{resolveEntityLabel(expense.supplierId)}</CardTitle>
                    <CardDescription>
                      {formatDate(expense.expenseDate)} - {expense.supplierRef || '-'}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ExpenseStatusBadge status={expense.status} locale={locale} />
                    <ExpensePaymentStatusBadge
                      paymentStatus={expense.paymentStatus}
                      lifecycleStatus={expense.status}
                      locale={locale}
                    />
                    {canManageExpenses ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditDialogOpen(true)}
                          disabled={Boolean(actionLoading) || isExpenseArchived}
                          title={t.edit}
                          aria-label={t.edit}
                        >
                          <PencilIcon className="size-4" />
                          <span className="hidden sm:inline">{t.edit}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSettleExpenseOpen(true)}
                          disabled={Boolean(actionLoading) || expense.paymentStatus === 'paid' || isExpenseArchived}
                          title={t.settleExpense}
                          aria-label={t.settleExpense}
                        >
                          <CheckCircle2Icon className="size-4" />
                          <span className="hidden sm:inline">{t.settleExpense}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAddPaymentOpen(true)}
                          disabled={Boolean(actionLoading) || expense.paymentStatus === 'paid' || isExpenseArchived}
                          title={t.addPayment}
                          aria-label={t.addPayment}
                        >
                          <MessageSquarePlusIcon className="size-4" />
                          <span className="hidden sm:inline">{t.addPayment}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void runAction('duplicate')}
                          disabled={Boolean(actionLoading) || isExpenseArchived}
                          title={t.duplicate}
                          aria-label={t.duplicate}
                        >
                          <CopyIcon className="size-4" />
                          <span className="hidden sm:inline">{t.duplicate}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={openAttachmentUpload}
                          disabled={attachmentsBusy || Boolean(actionLoading) || isExpenseArchived}
                          title={t.addAttachment}
                          aria-label={t.addAttachment}
                        >
                          {attachmentsBusy ? <Loader2Icon className="size-4 animate-spin" /> : <PaperclipIcon className="size-4" />}
                          <span className="hidden sm:inline">{t.addAttachment}</span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="icon" className="size-8" disabled={Boolean(actionLoading)}>
                              {actionLoading ? <Loader2Icon className="size-4 animate-spin" /> : <MoreHorizontalIcon className="size-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {!isExpenseArchived ? (
                              <DropdownMenuItem onSelect={() => setArchiveConfirmOpen(true)}>
                                <ArchiveIcon className="size-4" />
                                {t.archive}
                              </DropdownMenuItem>
                            ) : null}
                            {isExpenseArchived && canRestoreArchived ? (
                              <DropdownMenuItem onSelect={() => void runAction('restore')}>
                                <RefreshCwIcon className="size-4" />
                                {t.restore}
                              </DropdownMenuItem>
                            ) : null}
                            {canPermanentlyDelete ? (
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => {
                                  setDeletePassword('');
                                  setDeleteReason('');
                                  setDeleteValidationError(null);
                                  setDeleteConfirmOpen(true);
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
                </div>
                {expense.status === 'draft' ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">{t.statusDraftHint}</p>
                ) : null}
                {expense.status === 'archived' ? (
                  <p className="text-xs text-slate-700 dark:text-slate-300">{t.archivedReadOnlyHint}</p>
                ) : null}
              </CardHeader>

              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-sky-200/75 bg-sky-50/70 p-2.5 dark:border-sky-900/45 dark:bg-sky-950/30">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-sky-700/80 dark:text-sky-300/80">{t.heroAmountInclVat}</p>
                  <ExpenseMoneyDisplay
                    cents={expense.amountInclVatCents || 0}
                    locale={locale === 'fr' ? 'fr-FR' : 'en-GB'}
                    className="mt-1 text-sm font-semibold"
                  />
                </div>

                <div className="rounded-lg border border-emerald-200/75 bg-emerald-50/70 p-2.5 dark:border-emerald-900/45 dark:bg-emerald-950/30">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">{t.heroAmountPaid}</p>
                  <ExpenseMoneyDisplay
                    cents={expense.amountPaidCents || 0}
                    locale={locale === 'fr' ? 'fr-FR' : 'en-GB'}
                    className="mt-1 text-sm font-semibold"
                  />
                </div>

                <div className={`rounded-lg border p-2.5 ${getRemainingAmountClass(expense.paymentStatus, expense.remainingBalanceCents || 0)}`}>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/70">{t.heroRemaining}</p>
                  <ExpenseMoneyDisplay
                    cents={expense.remainingBalanceCents || 0}
                    locale={locale === 'fr' ? 'fr-FR' : 'en-GB'}
                    className="mt-1 text-sm font-semibold"
                  />
                </div>

                <div className="rounded-lg border border-teal-200/75 bg-teal-50/70 p-2.5 dark:border-teal-900/45 dark:bg-teal-950/25">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-teal-700/80 dark:text-teal-300/80">{t.heroAttachments}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">{attachments.length}</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-1.5 sm:flex sm:flex-wrap sm:gap-2 dark:border-slate-800/70 dark:bg-slate-950/25">
              <Button type="button" size="sm" variant={activeTab === 'summary' ? 'default' : 'outline'} onClick={() => setActiveTab('summary')} className="w-full sm:w-auto">
                {t.summaryTab}
              </Button>
              <Button type="button" size="sm" variant={activeTab === 'attachments' ? 'default' : 'outline'} onClick={() => setActiveTab('attachments')} className="w-full sm:w-auto">
                {t.attachmentsTab}
              </Button>
              <Button type="button" size="sm" variant={activeTab === 'audit' ? 'default' : 'outline'} onClick={() => setActiveTab('audit')} className="w-full sm:w-auto">
                {t.auditTab}
              </Button>
              <Button type="button" size="sm" variant={activeTab === 'tickets' ? 'default' : 'outline'} onClick={() => setActiveTab('tickets')} className="w-full sm:w-auto">
                {t.ticketsTab}
              </Button>
            </div>

            {activeTab === 'summary' ? (
              <div className="grid gap-4 lg:grid-cols-3">
                {expense.status === 'draft' && attachments.length > 0 ? (
                  <Card className="border-amber-200/80 bg-amber-50/45 dark:border-amber-900/35 dark:bg-amber-950/14 lg:col-span-3">
                    <CardHeader className="pb-2">
                      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <CardTitle className="text-base">{t.draftAttachmentPreview}</CardTitle>
                          <CardDescription>{t.draftAttachmentPreviewHint}</CardDescription>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:w-auto sm:whitespace-nowrap"
                          onClick={() => setActiveTab('attachments')}
                        >
                          {t.openAttachmentsTab}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isImageMimeType(attachments[0]?.mimeType) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={attachments[0]?.url}
                          alt={attachments[0]?.displayName || 'Draft attachment'}
                          className="max-h-90 w-full rounded-lg border border-border/60 object-contain"
                        />
                      ) : isPdfMimeType(attachments[0]?.mimeType) ? (
                        <iframe
                          src={attachments[0]?.url}
                          title={attachments[0]?.displayName || 'Draft attachment'}
                          className="h-90 w-full rounded-lg border border-border/60"
                        />
                      ) : (
                        <div className="rounded-lg border border-border/60 p-3">
                          <p className="text-sm font-medium">{attachments[0]?.displayName || '-'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{attachments[0]?.mimeType || '-'}</p>
                          <div className="mt-3">
                            <Button asChild type="button" variant="outline" size="sm">
                              <a href={attachments[0]?.url || '#'} target="_blank" rel="noopener noreferrer">
                                <ExternalLinkIcon className="size-3.5" />
                                {t.openFile}
                              </a>
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : null}

                <Card className="border-sky-200/80 bg-sky-50/40 dark:border-sky-900/35 dark:bg-sky-950/14 lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">{t.financial}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200/70 bg-slate-50/70 p-3 dark:border-slate-800/65 dark:bg-slate-900/35">
                      <p className="text-xs text-muted-foreground">{t.amountExclVat}</p>
                      <ExpenseMoneyDisplay cents={expense.amountExclVatCents || 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-sm font-medium" />
                    </div>
                    <div className="rounded-lg border border-amber-200/70 bg-amber-50/70 p-3 dark:border-amber-900/65 dark:bg-amber-950/30">
                      <p className="text-xs text-muted-foreground">{t.vatAmount}</p>
                      <ExpenseMoneyDisplay cents={expense.vatAmountCents || 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-sm font-medium" />
                    </div>
                    <div className="rounded-lg border border-sky-200/70 bg-sky-50/70 p-3 dark:border-sky-900/65 dark:bg-sky-950/30">
                      <p className="text-xs text-muted-foreground">{t.amountInclVat}</p>
                      <ExpenseMoneyDisplay cents={expense.amountInclVatCents || 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-sm font-medium" />
                    </div>
                    <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/70 p-3 dark:border-emerald-900/65 dark:bg-emerald-950/30">
                      <p className="text-xs text-muted-foreground">{t.amountPaid}</p>
                      <ExpenseMoneyDisplay cents={expense.amountPaidCents || 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-sm font-medium" />
                    </div>
                    <div className={`rounded-lg border p-3 sm:col-span-2 ${getRemainingAmountClass(expense.paymentStatus, expense.remainingBalanceCents || 0)}`}>
                      <p className="text-xs text-muted-foreground">{t.remaining}</p>
                      <ExpenseMoneyDisplay cents={expense.remainingBalanceCents || 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-sm font-medium" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200/80 bg-slate-50/45 dark:border-slate-800/70 dark:bg-slate-950/16">
                  <CardHeader>
                    <CardTitle className="text-base">{t.summary}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.date}</p>
                      <p className="font-medium">{formatDate(expense.expenseDate)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.dueDate}</p>
                      <p className="font-medium">{formatDate(expense.dueDate)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.paidAt}</p>
                      <p className="font-medium">{formatDate(expense.paidAt)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.paymentMethod}</p>
                      <p className="font-medium">
                        {expense.paymentMethod ? getExpensePaymentMethodLabel(expense.paymentMethod, locale) : '-'}
                      </p>
                    </div>
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.paidBy}</p>
                      <p className="font-medium">
                        {expense.paidBy ? getExpensePaidByLabel(expense.paidBy, locale) : '-'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-emerald-200/80 bg-emerald-50/35 dark:border-emerald-900/35 dark:bg-emerald-950/12 lg:col-span-3">
                  <CardHeader>
                    <CardTitle className="text-base">{t.paymentHistory}</CardTitle>
                    <CardDescription>{t.paymentHistoryHint}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {!expense.payments || expense.payments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t.noPaymentHistory}</p>
                    ) : (
                      expense.payments.map((payment) => (
                        <div key={payment._id} className="rounded-lg border border-emerald-200/70 bg-emerald-50/65 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                          <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-6">
                            <div>
                              <p className="text-muted-foreground">{t.amountPaid}</p>
                              <ExpenseMoneyDisplay
                                cents={payment.amountPaidCents || 0}
                                locale={locale === 'fr' ? 'fr-FR' : 'en-GB'}
                                className="text-sm font-semibold"
                              />
                            </div>
                            <div>
                              <p className="text-muted-foreground">{t.paidAt}</p>
                              <p className="font-medium">{formatDate(payment.paidAt)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">{t.paymentMethod}</p>
                              <p className="font-medium">
                                {payment.paymentMethod
                                  ? getExpensePaymentMethodLabel(payment.paymentMethod, locale)
                                  : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">{t.paidBy}</p>
                              <p className="font-medium">
                                {payment.paidBy ? getExpensePaidByLabel(payment.paidBy, locale) : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">{t.paymentRecordedBy}</p>
                              <p className="font-medium">{resolveUserLabel(payment.createdBy || null)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">{t.paymentRecordedAt}</p>
                              <p className="font-medium">{formatDateTime(payment.createdAt)}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="border-sky-200/80 bg-sky-50/38 dark:border-sky-900/35 dark:bg-sky-950/12 lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">{t.links}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.supplier}</p>
                      <p className="font-medium">{resolveEntityLabel(expense.supplierId)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.category}</p>
                      <p className="font-medium">{resolveEntityLabel(expense.categoryId)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.client}</p>
                      <p className="font-medium">{resolveEntityLabel(expense.clientId)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 p-2 sm:col-span-2">
                      <p className="text-xs text-muted-foreground">{t.invoice}</p>
                      {linkedInvoiceSummary ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">
                            {`${linkedInvoiceSummary.displayNumber} - ${linkedInvoiceSummary.clientName} - ${linkedInvoiceSummary.amountLabel} - ${linkedInvoiceSummary.statusLabel}`}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {linkedInvoiceSummary.status ? (
                              <InvoiceStatusBadge status={linkedInvoiceSummary.status} locale={locale} />
                            ) : null}
                            <Button asChild type="button" variant="outline" size="sm">
                              <Link href={`/invoices/${linkedInvoiceSummary.id}`}>{t.openInvoice}</Link>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="font-medium">{resolveEntityLabel(expense.invoiceId)}</p>
                          {typeof expense.invoiceId === 'string' ? (
                            <Button asChild type="button" variant="outline" size="sm">
                              <Link href={`/invoices/${expense.invoiceId}`}>{t.openInvoice}</Link>
                            </Button>
                          ) : null}
                        </div>
                      )}
                    </div>
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.reference}</p>
                      <p className="font-medium">{expense.supplierRef || '-'}</p>
                    </div>
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.project}</p>
                      <p className="font-medium">{expense.projectId || '-'}</p>
                    </div>
                    <div className="rounded-md border border-border/60 p-2 sm:col-span-2">
                      <p className="text-xs text-muted-foreground">{t.type}</p>
                      <p className="font-medium">
                        {expense.expenseType ? getExpenseTypeLabel(expense.expenseType, locale) : '-'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200/80 bg-slate-50/45 dark:border-slate-800/70 dark:bg-slate-950/16">
                  <CardHeader>
                    <CardTitle className="text-base">{t.lifecycle}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.lifecycleStatus}</p>
                      <div className="mt-1">
                        <ExpenseStatusBadge status={expense.status} locale={locale} />
                      </div>
                    </div>
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.paymentStatus}</p>
                      <div className="mt-1">
                        <ExpensePaymentStatusBadge
                          paymentStatus={expense.paymentStatus}
                          lifecycleStatus={expense.status}
                          locale={locale}
                        />
                      </div>
                    </div>
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.createdBy}</p>
                      <p className="font-medium">{resolveUserLabel(expense.createdBy)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.updatedBy}</p>
                      <p className="font-medium">{resolveUserLabel(expense.updatedBy)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.createdAt}</p>
                      <p className="font-medium">{formatDateTime(expense.createdAt)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.updatedAt}</p>
                      <p className="font-medium">{formatDateTime(expense.updatedAt)}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-amber-200/80 bg-amber-50/32 dark:border-amber-900/35 dark:bg-amber-950/12 lg:col-span-3">
                  <CardHeader>
                    <CardTitle className="text-base">{t.notes}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{expense.notes || t.noNotes}</p>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {activeTab === 'attachments' ? (
              <Card className="border-sky-200/80 bg-sky-50/38 dark:border-sky-900/35 dark:bg-sky-950/12">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{t.attachmentsTab}</CardTitle>
                      <CardDescription>{t.replaceFileHint}</CardDescription>
                    </div>
                    {canManageExpenses ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:w-auto sm:whitespace-nowrap"
                        onClick={openAttachmentUpload}
                        disabled={attachmentsBusy || isExpenseArchived}
                      >
                        {attachmentsBusy ? <Loader2Icon className="size-4 animate-spin" /> : <FileUpIcon className="size-4" />}
                        {t.uploadAttachment}
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {attachmentError ? <p className="text-sm text-destructive">{attachmentError}</p> : null}

                  {attachments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t.noAttachments}</p>
                  ) : (
                    attachments.map((attachment) => (
                      <div key={attachment._id} className="rounded-lg border border-sky-200/65 bg-sky-50/55 p-3 dark:border-sky-900/40 dark:bg-sky-950/20">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            {isImageMimeType(attachment.mimeType) ? (
                              <button
                                type="button"
                                onClick={() => setPreviewAttachment(attachment)}
                                className="shrink-0 overflow-hidden rounded-md border border-sky-200/75 bg-white/90 transition hover:border-sky-300 dark:border-sky-900/60 dark:bg-slate-950/70"
                                aria-label={`${t.preview}: ${attachment.displayName}`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={attachment.url}
                                  alt={attachment.displayName}
                                  className="h-16 w-16 object-cover sm:h-20 sm:w-20"
                                  loading="lazy"
                                />
                              </button>
                            ) : null}

                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{attachment.displayName}</p>
                              <p className="text-xs text-muted-foreground">
                                {attachment.mimeType} - {formatBytes(attachment.sizeBytes)}
                              </p>
                            </div>
                          </div>

                          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:w-auto sm:whitespace-nowrap"
                              onClick={() => setPreviewAttachment(attachment)}
                            >
                              <PaperclipIcon className="size-3.5" />
                              {t.preview}
                            </Button>
                            <Button
                              asChild
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:w-auto sm:whitespace-nowrap"
                            >
                              <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLinkIcon className="size-3.5" />
                                {t.openFile}
                              </a>
                            </Button>
                            {canManageExpenses ? (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:w-auto sm:whitespace-nowrap"
                                onClick={() => openDeleteAttachmentDialog(attachment)}
                                disabled={attachmentsBusy || isExpenseArchived}
                              >
                                <Trash2Icon className="size-3.5" />
                                {t.deleteAttachment}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ) : null}

            {activeTab === 'audit' ? (
              <Card className="border-slate-200/80 bg-slate-50/45 dark:border-slate-800/70 dark:bg-slate-950/16">
                <CardHeader>
                  <CardTitle className="text-base">{t.auditTab}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {visibleAuditLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t.noAudit}</p>
                  ) : (
                    visibleAuditLogs.map((log) => (
                      <div key={log._id} className="rounded-lg border border-slate-200/70 bg-slate-50/70 p-3 dark:border-slate-800/60 dark:bg-slate-900/35">
                        <div className="grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
                          <div>
                            <p className="text-muted-foreground">{t.auditAction}</p>
                            <p className="font-medium">{formatAuditAction(log as AuditLogEntry, locale)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{t.auditField}</p>
                            <p className="font-medium">{formatAuditField(log.fieldName, locale)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{t.auditFrom}</p>
                            <p className="line-clamp-2 font-medium">{formatAuditValue(log.oldValue, locale, log.fieldName)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{t.auditTo}</p>
                            <p className="line-clamp-2 font-medium">{formatAuditValue(log.newValue, locale, log.fieldName)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{t.auditBy}</p>
                            <p className="font-medium">{resolveUserLabel(log.performedBy || null)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{t.auditAt}</p>
                            <p className="font-medium">{formatDateTime(log.performedAt, locale)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ) : null}

            {activeTab === 'tickets' ? (
              <Card className="border-teal-200/80 bg-teal-50/38 dark:border-teal-900/35 dark:bg-teal-950/12">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{t.ticketsTab}</CardTitle>
                    {canManageTickets ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:w-auto sm:whitespace-nowrap"
                        onClick={() => setTicketDialogOpen(true)}
                      >
                        <MessageSquarePlusIcon className="size-3.5" />
                        {t.createLinkedTicket}
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {!canViewTickets ? (
                    <p className="text-sm text-muted-foreground">{t.noTickets}</p>
                  ) : linkedTicketsLoading ? (
                    <p className="text-sm text-muted-foreground">{t.linkedTicketsLoading}</p>
                  ) : linkedTicketsError ? (
                    <p className="text-sm text-destructive">
                      {t.linkedTicketsError}: {linkedTicketsError}
                    </p>
                  ) : linkedTickets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t.noTickets}</p>
                  ) : (
                    linkedTickets.map((ticket) => (
                      <div key={ticket._id} className="rounded-lg border border-teal-200/70 bg-teal-50/65 p-3 dark:border-teal-900/40 dark:bg-teal-950/22">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 space-y-0.5">
                            <p className="truncate text-sm font-medium">{ticket.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {ticket.type} - {t.ticketUpdatedAt}: {formatDateTime(ticket.updatedAt)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t.ticketAssignedTo}: {resolveAssignedUsersLabel(ticket.assignedTo)}
                            </p>
                          </div>

                          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                            <TicketUnreadIndicator unreadCount={ticket.unreadCount} locale={locale} />
                            <TicketStatusBadge status={ticket.status} locale={locale} />
                            <Button asChild type="button" variant="outline" size="sm" className="w-full sm:w-auto">
                              <Link href={`/tickets/${ticket._id}`}>{locale === 'fr' ? 'Ouvrir' : 'Open'}</Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </div>

      {expense ? (
        <ExpenseFormDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          mode="edit"
          initialExpense={expense}
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
          }}
        />
      ) : null}

      {expense ? (
        <ExpensePaymentDialog
          open={settleExpenseOpen}
          onOpenChange={setSettleExpenseOpen}
          expenseId={expense._id}
          amountInclVatCents={expense.amountInclVatCents || 0}
          amountPaidCents={expense.amountPaidCents || 0}
          mode="settle"
          locale={locale}
          onSaved={async () => {
            await refetch();
            pushFeedback('success', t.settleExpenseSuccess);
          }}
        />
      ) : null}

      {expense ? (
        <ExpensePaymentDialog
          open={addPaymentOpen}
          onOpenChange={setAddPaymentOpen}
          expenseId={expense._id}
          amountInclVatCents={expense.amountInclVatCents || 0}
          amountPaidCents={expense.amountPaidCents || 0}
          mode="add"
          locale={locale}
          onSaved={async () => {
            await refetch();
            pushFeedback('success', t.addPaymentSuccess);
          }}
        />
      ) : null}

      <AttachmentPreviewDialog
        open={Boolean(previewAttachment)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewAttachment(null);
          }
        }}
        attachment={
          previewAttachment
            ? {
                name: previewAttachment.displayName,
                url: previewAttachment.url,
                mimeType: previewAttachment.mimeType,
              }
            : null
        }
        locale={locale}
      />

      {expense ? (
        <CreateTicketDialog
          open={ticketDialogOpen}
          onOpenChange={setTicketDialogOpen}
          locale={locale}
          prefill={{
            linkedType: 'expense',
            linkedId: expense._id,
            linkedLabel: `${resolveEntityLabel(expense.supplierId)} - ${expense.supplierRef || expense._id}`,
            title: `${resolveEntityLabel(expense.supplierId)} - ${expense.supplierRef || expense._id}`,
          }}
          onCreated={async () => {
            await Promise.all([refetchLinkedTickets(), refetch()]);
            pushFeedback('success', t.ticketCreated);
          }}
        />
      ) : null}

      <AlertDialog
        open={archiveConfirmOpen}
        onOpenChange={(open) => {
          if (actionLoading === 'archive' && !open) return;
          setArchiveConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmArchiveTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {expense ? t.confirmArchiveDescription(expense.supplierRef || resolveEntityLabel(expense.supplierId)) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                disabled={actionLoading === 'archive'}
              >
                {t.confirmArchiveCancel}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="secondary"
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap bg-orange-500 text-white hover:bg-orange-600 hover:text-white"
                disabled={!expense || actionLoading === 'archive'}
                onClick={(event) => {
                  event.preventDefault();
                  void runAction('archive');
                }}
              >
                {actionLoading === 'archive' ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {t.confirmArchiveAction}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteAttachmentDialogOpen}
        onOpenChange={(open) => {
          if (attachmentsBusy) return;
          if (!open) {
            closeDeleteAttachmentDialog();
            return;
          }
          setDeleteAttachmentDialogOpen(true);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteAttachmentDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteAttachmentDialogDescription}
              {attachmentToDelete ? (
                <span className="mt-1 block font-medium text-foreground">{attachmentToDelete.displayName}</span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="expense-attachment-delete-reason">{t.deleteAttachmentReasonLabel}</Label>
              <select
                id="expense-attachment-delete-reason"
                className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={attachmentDeleteReason}
                onChange={(event) => {
                  setAttachmentDeleteReason(event.target.value);
                  setAttachmentDeleteReasonError(null);
                }}
                disabled={attachmentsBusy}
              >
                <option value="">{t.deleteAttachmentReasonPlaceholder}</option>
                {EXPENSE_ATTACHMENT_DELETE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {getExpenseAttachmentDeleteReasonLabel(reason, locale)}
                  </option>
                ))}
              </select>
            </div>

            {attachmentDeleteReason === 'other' ? (
              <div className="space-y-1.5">
                <Label htmlFor="expense-attachment-delete-reason-details">{t.deleteAttachmentReasonDetailsLabel}</Label>
                <Textarea
                  id="expense-attachment-delete-reason-details"
                  value={attachmentDeleteReasonDetails}
                  onChange={(event) => {
                    setAttachmentDeleteReasonDetails(event.target.value);
                    setAttachmentDeleteReasonError(null);
                  }}
                  placeholder={t.deleteAttachmentReasonDetailsPlaceholder}
                  disabled={attachmentsBusy}
                  rows={3}
                />
              </div>
            ) : null}

            {attachmentDeleteReasonError ? (
              <p className="text-xs font-medium text-destructive">{attachmentDeleteReasonError}</p>
            ) : null}
          </div>

          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                disabled={attachmentsBusy}
              >
                {t.confirmDeleteCancel}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap bg-destructive text-white hover:bg-destructive/90 hover:text-white"
                disabled={attachmentsBusy}
                onClick={(event) => {
                  event.preventDefault();
                  void confirmAttachmentDeletion();
                }}
              >
                {attachmentsBusy ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {t.deleteAttachmentConfirmAction}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open);
          if (!open) {
            setDeletePassword('');
            setDeleteReason('');
            setDeleteValidationError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmDelete}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="expense-detail-delete-password">{t.confirmDeletePasswordLabel}</Label>
              <Input
                id="expense-detail-delete-password"
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
              <Label htmlFor="expense-detail-delete-reason">{t.confirmDeleteReasonLabel}</Label>
              <Textarea
                id="expense-detail-delete-reason"
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
                disabled={actionLoading === 'delete'}
              >
                {t.confirmDeleteCancel}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap bg-destructive text-white hover:bg-destructive/90 hover:text-white"
                disabled={actionLoading === 'delete'}
                onClick={() => {
                  void runDelete();
                }}
              >
                {actionLoading === 'delete' ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {t.confirmDeleteAction}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CrmShell>
  );
}
