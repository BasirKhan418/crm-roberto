'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';

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
import { ExpenseFormDialog } from '@/components/expenses/expense-form-dialog';
import { ExpenseMoneyDisplay } from '@/components/expenses/expense-money-display';
import { ExpenseStatusBadge } from '@/components/expenses/expense-status-badge';
import { MarkPaidDialog } from '@/components/expenses/mark-paid-dialog';
import { useLocale } from '@/components/providers/locale-provider';
import { CreateTicketDialog } from '@/components/tickets/create-ticket-dialog';
import { TicketStatusBadge } from '@/components/tickets/ticket-status-badge';
import { TicketUnreadIndicator } from '@/components/tickets/ticket-unread-indicator';
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
import { useAuthMe } from '@/hooks/useAuthMe';
import { useExpenseDetail } from '@/hooks/useExpenseDetail';
import { createInlineExpenseSupplier, useExpenseLookups } from '@/hooks/useExpenseLookups';
import { useTickets } from '@/hooks/useTickets';
import {
  EXPENSE_MAX_FILE_SIZE_BYTES,
  formatFileSizeMb,
  getExpenseFileExtension,
  isExpenseMimeTypeAllowed,
} from '@/lib/expenses/upload';
import { hasPermission } from '@/lib/permissions';

type GenericApiResponse = {
  success: boolean;
  message?: string;
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

function formatDate(value?: string | Date | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR');
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('fr-FR');
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

function formatAuditValue(value: unknown) {
  if (value == null) return '-';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
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

export default function ExpenseDetailPage() {
  const params = useParams<{ id: string }>();
  const expenseId = typeof params?.id === 'string' ? params.id : '';
  const { locale } = useLocale();
  const { user, loading: authLoading } = useAuthMe();
  const { expense, loading, error, refetch } = useExpenseDetail(expenseId);
  const { categories, suppliers, clients, invoices, refetch: refetchLookups } = useExpenseLookups(undefined, 80);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<'summary' | 'attachments' | 'audit' | 'tickets'>('summary');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [attachmentsBusy, setAttachmentsBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<ExpenseAttachment | null>(null);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);

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
          reference: 'Reference',
          supplier: 'Supplier',
          category: 'Category',
          client: 'Client',
          invoice: 'Invoice',
          project: 'Project',
          type: 'Type',
          paymentMethod: 'Payment method',
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
          replaceFileHint: `Allowed: PDF/JPEG/PNG/HEIC. Max ${formatFileSizeMb(EXPENSE_MAX_FILE_SIZE_BYTES)} MB`,
          deleteAttachment: 'Delete',
          noAttachments: 'No attachments linked to this expense yet.',
          uploadFailed: 'Attachment upload failed',
          uploadSuccess: 'Attachment uploaded',
          deleteSuccess: 'Attachment deleted',
          duplicate: 'Duplicate',
          archive: 'Archive',
          edit: 'Edit',
          markPaid: 'Mark paid',
          delete: 'Delete',
          actionFailed: 'Action failed',
          duplicateSuccess: 'Expense duplicated',
          archiveSuccess: 'Expense archived',
          deleteSuccessExpense: 'Expense deleted',
          confirmArchive: 'Archive this expense?',
          confirmDelete: 'Delete this expense? This cannot be undone.',
          confirmDeleteTitle: 'Confirm expense deletion',
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
          reference: 'Référence',
          supplier: 'Fournisseur',
          category: 'Catégorie',
          client: 'Client',
          invoice: 'Facture',
          project: 'Projet',
          type: 'Type',
          paymentMethod: 'Mode de paiement',
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
          replaceFileHint: `Autorisés : PDF/JPEG/PNG/HEIC. Max ${formatFileSizeMb(EXPENSE_MAX_FILE_SIZE_BYTES)} MB`,
          deleteAttachment: 'Supprimer',
          noAttachments: 'Aucune pièce jointe sur cette dépense.',
          uploadFailed: 'Échec upload pièce jointe',
          uploadSuccess: 'Pièce jointe ajoutée',
          deleteSuccess: 'Pièce jointe supprimée',
          duplicate: 'Dupliquer',
          archive: 'Archiver',
          edit: 'Modifier',
          markPaid: 'Marquer payée',
          delete: 'Supprimer',
          actionFailed: 'Échec action',
          duplicateSuccess: 'Dépense dupliquée',
          archiveSuccess: 'Dépense archivée',
          deleteSuccessExpense: 'Dépense supprimée',
          confirmArchive: 'Archiver cette dépense ?',
          confirmDelete: 'Supprimer cette dépense ? Action irréversible.',
          confirmDeleteTitle: 'Confirmer suppression dépense',
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
        },
      })[locale],
    [locale]
  );

  const canManageExpenses = hasPermission(user?.role, 'expenses.manage');
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

  function pushFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message });
    window.setTimeout(() => {
      setFeedback((previous) => {
        if (!previous || previous.message !== message) return previous;
        return null;
      });
    }, 3000);
  }

  async function runAction(action: 'duplicate' | 'archive') {
    if (!expense) return;

    if (action === 'archive' && !window.confirm(t.confirmArchive)) {
      return;
    }

    setActionLoading(action);

    try {
      const response = await fetch(`/api/expenses/${expense._id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'duplicate' ? { action: 'duplicate', copyAttachments: true } : { action: 'archive' }),
      });

      const payload = (await response.json().catch(() => null)) as GenericApiResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.actionFailed);
      }

      await refetch();
      pushFeedback('success', action === 'duplicate' ? t.duplicateSuccess : t.archiveSuccess);
    } catch (actionError) {
      pushFeedback('error', actionError instanceof Error ? actionError.message : t.actionFailed);
    } finally {
      setActionLoading(null);
    }
  }

  async function runDelete() {
    if (!expense) return;

    setActionLoading('delete');

    try {
      const response = await fetch(`/api/expenses/${expense._id}?mode=delete`, {
        method: 'DELETE',
      });

      const payload = (await response.json().catch(() => null)) as GenericApiResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.actionFailed);
      }

      pushFeedback('success', t.deleteSuccessExpense);
      window.setTimeout(() => {
        window.location.href = '/expenses';
      }, 500);
    } catch (deleteError) {
      pushFeedback('error', deleteError instanceof Error ? deleteError.message : t.actionFailed);
    } finally {
      setActionLoading(null);
    }
  }

  async function uploadAttachment(file: File) {
    if (!expense) return;

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

    const attachmentPayload = (await attachmentResponse.json().catch(() => null)) as GenericApiResponse | null;

    if (!attachmentResponse.ok || !attachmentPayload?.success) {
      throw new Error(attachmentPayload?.message || t.uploadFailed);
    }
  }

  async function handleAttachmentUpload(files: FileList | null) {
    if (!files || !expense || !canManageExpenses) {
      return;
    }

    setAttachmentsBusy(true);
    setAttachmentError(null);

    try {
      for (const file of Array.from(files)) {
        await uploadAttachment(file);
      }

      await refetch();
      pushFeedback('success', t.uploadSuccess);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : t.uploadFailed;
      setAttachmentError(message);
      pushFeedback('error', message);
    } finally {
      setAttachmentsBusy(false);
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!expense || !canManageExpenses) return;
    if (!window.confirm(t.confirmDeleteAttachment)) return;

    setAttachmentsBusy(true);
    setAttachmentError(null);

    try {
      const response = await fetch(`/api/expenses/${expense._id}/attachments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachmentId }),
      });

      const payload = (await response.json().catch(() => null)) as GenericApiResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.actionFailed);
      }

      await refetch();
      pushFeedback('success', t.deleteSuccess);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : t.actionFailed;
      setAttachmentError(message);
      pushFeedback('error', message);
    } finally {
      setAttachmentsBusy(false);
    }
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
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
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
            <Card className="border-border/70">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{resolveEntityLabel(expense.supplierId)}</CardTitle>
                    <CardDescription>
                      {formatDate(expense.expenseDate)} - {expense.supplierRef || '-'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <ExpenseStatusBadge status={expense.status} paymentStatus={expense.paymentStatus} />
                    {canManageExpenses ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="outline" size="icon" className="size-8" disabled={Boolean(actionLoading)}>
                            {actionLoading ? <Loader2Icon className="size-4 animate-spin" /> : <MoreHorizontalIcon className="size-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onSelect={() => setEditDialogOpen(true)}>
                              <PencilIcon className="size-4" />
                            {t.edit}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setMarkPaidOpen(true)} disabled={expense.paymentStatus === 'paid'}>
                            <CheckCircle2Icon className="size-4" />
                            {t.markPaid}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => void runAction('duplicate')}>
                            <CopyIcon className="size-4" />
                            {t.duplicate}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => void runAction('archive')} disabled={expense.status === 'archived'}>
                            <ArchiveIcon className="size-4" />
                            {t.archive}
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteConfirmOpen(true)}>
                            <Trash2Icon className="size-4" />
                            {t.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </div>
                {expense.status === 'draft' ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">{t.statusDraftHint}</p>
                ) : null}
              </CardHeader>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={activeTab === 'summary' ? 'default' : 'outline'} onClick={() => setActiveTab('summary')}>
                {t.summaryTab}
              </Button>
              <Button type="button" size="sm" variant={activeTab === 'attachments' ? 'default' : 'outline'} onClick={() => setActiveTab('attachments')}>
                {t.attachmentsTab}
              </Button>
              <Button type="button" size="sm" variant={activeTab === 'audit' ? 'default' : 'outline'} onClick={() => setActiveTab('audit')}>
                {t.auditTab}
              </Button>
              <Button type="button" size="sm" variant={activeTab === 'tickets' ? 'default' : 'outline'} onClick={() => setActiveTab('tickets')}>
                {t.ticketsTab}
              </Button>
            </div>

            {activeTab === 'summary' ? (
              <div className="grid gap-4 lg:grid-cols-3">
                {expense.status === 'draft' && expense.attachments && expense.attachments.length > 0 ? (
                  <Card className="border-border/70 lg:col-span-3">
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{t.draftAttachmentPreview}</CardTitle>
                          <CardDescription>{t.draftAttachmentPreviewHint}</CardDescription>
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => setActiveTab('attachments')}>
                          {t.openAttachmentsTab}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isImageMimeType(expense.attachments[0]?.mimeType) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={expense.attachments[0]?.url}
                          alt={expense.attachments[0]?.displayName || 'Draft attachment'}
                          className="max-h-90 w-full rounded-lg border border-border/60 object-contain"
                        />
                      ) : isPdfMimeType(expense.attachments[0]?.mimeType) ? (
                        <iframe
                          src={expense.attachments[0]?.url}
                          title={expense.attachments[0]?.displayName || 'Draft attachment'}
                          className="h-90 w-full rounded-lg border border-border/60"
                        />
                      ) : (
                        <div className="rounded-lg border border-border/60 p-3">
                          <p className="text-sm font-medium">{expense.attachments[0]?.displayName || '-'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{expense.attachments[0]?.mimeType || '-'}</p>
                          <div className="mt-3">
                            <Button asChild type="button" variant="outline" size="sm">
                              <a href={expense.attachments[0]?.url || '#'} target="_blank" rel="noopener noreferrer">
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

                <Card className="border-border/70 lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">{t.financial}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border/60 p-3">
                      <p className="text-xs text-muted-foreground">{t.amountExclVat}</p>
                      <ExpenseMoneyDisplay cents={expense.amountExclVatCents || 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-sm font-medium" />
                    </div>
                    <div className="rounded-lg border border-border/60 p-3">
                      <p className="text-xs text-muted-foreground">{t.vatAmount}</p>
                      <ExpenseMoneyDisplay cents={expense.vatAmountCents || 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-sm font-medium" />
                    </div>
                    <div className="rounded-lg border border-border/60 p-3">
                      <p className="text-xs text-muted-foreground">{t.amountInclVat}</p>
                      <ExpenseMoneyDisplay cents={expense.amountInclVatCents || 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-sm font-medium" />
                    </div>
                    <div className="rounded-lg border border-border/60 p-3">
                      <p className="text-xs text-muted-foreground">{t.amountPaid}</p>
                      <ExpenseMoneyDisplay cents={expense.amountPaidCents || 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-sm font-medium" />
                    </div>
                    <div className="rounded-lg border border-border/60 p-3 sm:col-span-2">
                      <p className="text-xs text-muted-foreground">{t.remaining}</p>
                      <ExpenseMoneyDisplay cents={expense.remainingBalanceCents || 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-sm font-medium" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/70">
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
                      <p className="font-medium">{expense.paymentMethod || '-'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/70 lg:col-span-2">
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
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.invoice}</p>
                      <p className="font-medium">{resolveEntityLabel(expense.invoiceId)}</p>
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
                      <p className="font-medium">{expense.expenseType || '-'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/70">
                  <CardHeader>
                    <CardTitle className="text-base">{t.lifecycle}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="text-xs text-muted-foreground">{t.status}</p>
                      <p className="font-medium">{expense.status}</p>
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

                <Card className="border-border/70 lg:col-span-3">
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
              <Card className="border-border/70">
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
                        onClick={() => fileInputRef.current?.click()}
                        disabled={attachmentsBusy}
                      >
                        {attachmentsBusy ? <Loader2Icon className="size-4 animate-spin" /> : <FileUpIcon className="size-4" />}
                        {t.uploadAttachment}
                      </Button>
                    ) : null}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.heic"
                      className="hidden"
                      multiple
                      onChange={(event) => {
                        void handleAttachmentUpload(event.target.files);
                        event.target.value = '';
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {attachmentError ? <p className="text-sm text-destructive">{attachmentError}</p> : null}

                  {!expense.attachments || expense.attachments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t.noAttachments}</p>
                  ) : (
                    expense.attachments.map((attachment) => (
                      <div key={attachment._id} className="rounded-lg border border-border/60 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{attachment.displayName}</p>
                            <p className="text-xs text-muted-foreground">
                              {attachment.mimeType} - {formatBytes(attachment.sizeBytes)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setPreviewAttachment(attachment)}>
                              <PaperclipIcon className="size-3.5" />
                              {t.preview}
                            </Button>
                            <Button asChild type="button" variant="outline" size="sm">
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
                                onClick={() => void handleDeleteAttachment(attachment._id)}
                                disabled={attachmentsBusy}
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
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">{t.auditTab}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {!expense.auditLogs || expense.auditLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t.noAudit}</p>
                  ) : (
                    expense.auditLogs.map((log) => (
                      <div key={log._id} className="rounded-lg border border-border/60 p-3">
                        <div className="grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
                          <div>
                            <p className="text-muted-foreground">{t.auditAction}</p>
                            <p className="font-medium">{log.action}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{t.auditField}</p>
                            <p className="font-medium">{log.fieldName || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{t.auditFrom}</p>
                            <p className="line-clamp-2 font-medium">{formatAuditValue(log.oldValue)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{t.auditTo}</p>
                            <p className="line-clamp-2 font-medium">{formatAuditValue(log.newValue)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{t.auditBy}</p>
                            <p className="font-medium">{resolveUserLabel(log.performedBy || null)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{t.auditAt}</p>
                            <p className="font-medium">{formatDateTime(log.performedAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ) : null}

            {activeTab === 'tickets' ? (
              <Card className="border-border/70">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{t.ticketsTab}</CardTitle>
                    {canManageTickets ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => setTicketDialogOpen(true)}>
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
                      <div key={ticket._id} className="rounded-lg border border-border/60 p-3">
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

                          <div className="flex items-center gap-2">
                            <TicketUnreadIndicator unreadCount={ticket.unreadCount} locale={locale} />
                            <TicketStatusBadge status={ticket.status} locale={locale} />
                            <Button asChild type="button" variant="outline" size="sm">
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
        <MarkPaidDialog
          open={markPaidOpen}
          onOpenChange={setMarkPaidOpen}
          expenseId={expense._id}
          amountInclVatCents={expense.amountInclVatCents || 0}
          amountPaidCents={expense.amountPaidCents || 0}
          locale={locale}
          onSaved={async () => {
            await refetch();
            pushFeedback('success', t.markPaid);
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

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmDelete}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={actionLoading === 'delete'}>
                {t.confirmDeleteCancel}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={actionLoading === 'delete'}
                onClick={() => {
                  setDeleteConfirmOpen(false);
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
