'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeftIcon, ExternalLinkIcon, Loader2Icon, PaperclipIcon, RefreshCwIcon, SendIcon } from 'lucide-react';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import { AttachmentPreviewDialog } from '@/components/expenses/attachment-preview-dialog';
import { useLocale } from '@/components/providers/locale-provider';
import { TicketStatusBadge } from '@/components/tickets/ticket-status-badge';
import { TicketUnreadIndicator } from '@/components/tickets/ticket-unread-indicator';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuthMe } from '@/hooks/useAuthMe';
import {
  changeTicketStatus,
  markTicketRead,
  replyTicket,
  type TicketAttachment,
  type TicketMessage,
  uploadTicketFiles,
  useTicketThread,
} from '@/hooks/useTickets';
import { formatInvoiceReferencesInText } from '@/lib/i18n/messages';
import { normalizeRole } from '@/lib/permissions';
import { getDefaultCrmLandingPath, hasModuleActionAccess } from '@/lib/route-access';
import { getTicketStatusLabel, getTicketTypeLabel } from '@/lib/tickets/i18n';
import { TICKET_STATUSES, type TicketStatus } from '@/lib/tickets/constants';

const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.heic';

function getFileSignature(file: File) {
  return `${file.name.toLowerCase()}::${file.size}::${file.lastModified}`;
}

function mergeUniqueFiles(current: File[], incoming: File[]) {
  if (incoming.length === 0) {
    return current;
  }

  const known = new Set(current.map((file) => getFileSignature(file)));
  const merged = [...current];

  for (const file of incoming) {
    const signature = getFileSignature(file);
    if (known.has(signature)) {
      continue;
    }

    known.add(signature);
    merged.push(file);
  }

  return merged;
}

function formatFileSize(sizeBytes: number | undefined) {
  const value = typeof sizeBytes === 'number' ? sizeBytes : Number.NaN;
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    const kib = value / 1024;
    return `${kib % 1 === 0 ? kib.toFixed(0) : kib.toFixed(1)} KB`;
  }

  const mib = value / (1024 * 1024);
  return `${mib % 1 === 0 ? mib.toFixed(0) : mib.toFixed(1)} MB`;
}

function formatDateTime(value: string | undefined, locale: 'en' | 'fr') {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';

  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function resolveUserId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;

  if (typeof value === 'object') {
    const maybeId = (value as { _id?: unknown })._id;
    if (typeof maybeId === 'string') {
      return maybeId;
    }
  }

  return null;
}

function resolveUserName(value: unknown, fallback: string) {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const typed = value as { name?: string; email?: string };
  return typed.name?.trim() || typed.email?.trim() || fallback;
}

function resolveLinkedRecordPath(linkedType: string | null | undefined, linkedId: unknown): string | null {
  const id = resolveUserId(linkedId);
  if (!linkedType || !id) {
    return null;
  }

  if (linkedType === 'expense') return `/expenses/${id}`;
  if (linkedType === 'invoice') return `/invoices/${id}`;
  if (linkedType === 'supplier') return `/suppliers/${id}`;
  if (linkedType === 'client') return `/clients/${id}`;

  return null;
}

function resolveMessageAuthor(message: TicketMessage, locale: 'en' | 'fr') {
  const fallback = locale === 'fr' ? 'Collaborateur' : 'Teammate';
  return resolveUserName(message.author || message.authorId, fallback);
}

function resolveMessageRole(message: TicketMessage) {
  const author = message.author && typeof message.author === 'object' ? message.author : null;
  return typeof author?.role === 'string' ? normalizeRole(author.role) : null;
}

function getMessageTone(role: string | null) {
  switch (role) {
    case 'super_admin':
      return {
        card: 'border-fuchsia-200/90 bg-fuchsia-50/80',
        body: 'border-fuchsia-100 bg-white/95',
        attachments: 'border-fuchsia-200/70 bg-fuchsia-100/75',
        attachmentButton: 'border-fuchsia-200/80 bg-white/95 hover:border-fuchsia-300 hover:bg-white',
        badge: 'border-fuchsia-200 bg-fuchsia-100 text-fuchsia-800',
      };
    case 'administrator':
      return {
        card: 'border-rose-200/90 bg-rose-50/80',
        body: 'border-rose-100 bg-white/95',
        attachments: 'border-rose-200/70 bg-rose-100/75',
        attachmentButton: 'border-rose-200/80 bg-white/95 hover:border-rose-300 hover:bg-white',
        badge: 'border-rose-200 bg-rose-100 text-rose-800',
      };
    case 'manager':
      return {
        card: 'border-violet-200/90 bg-violet-50/80',
        body: 'border-violet-100 bg-white/95',
        attachments: 'border-violet-200/70 bg-violet-100/75',
        attachmentButton: 'border-violet-200/80 bg-white/95 hover:border-violet-300 hover:bg-white',
        badge: 'border-violet-200 bg-violet-100 text-violet-800',
      };
    case 'secretary':
      return {
        card: 'border-amber-200/90 bg-amber-50/80',
        body: 'border-amber-100 bg-white/95',
        attachments: 'border-amber-200/70 bg-amber-100/75',
        attachmentButton: 'border-amber-200/80 bg-white/95 hover:border-amber-300 hover:bg-white',
        badge: 'border-amber-200 bg-amber-100 text-amber-800',
      };
    case 'technician':
      return {
        card: 'border-cyan-200/90 bg-cyan-50/80',
        body: 'border-cyan-100 bg-white/95',
        attachments: 'border-cyan-200/70 bg-cyan-100/75',
        attachmentButton: 'border-cyan-200/80 bg-white/95 hover:border-cyan-300 hover:bg-white',
        badge: 'border-cyan-200 bg-cyan-100 text-cyan-800',
      };
    case 'read_only':
      return {
        card: 'border-slate-200/90 bg-slate-50/80',
        body: 'border-slate-100 bg-white/95',
        attachments: 'border-slate-200/70 bg-slate-100/80',
        attachmentButton: 'border-slate-200/80 bg-white/95 hover:border-slate-300 hover:bg-white',
        badge: 'border-slate-200 bg-slate-100 text-slate-700',
      };
    case 'external_accountant':
      return {
        card: 'border-emerald-200/90 bg-emerald-50/80',
        body: 'border-emerald-100 bg-white/95',
        attachments: 'border-emerald-200/70 bg-emerald-100/70',
        attachmentButton: 'border-emerald-200/80 bg-white/95 hover:border-emerald-300 hover:bg-white',
        badge: 'border-emerald-200 bg-emerald-100 text-emerald-800',
      };
    default:
      return {
        card: 'border-sky-200/90 bg-sky-50/80',
        body: 'border-sky-100 bg-white/95',
        attachments: 'border-sky-200/70 bg-sky-100/75',
        attachmentButton: 'border-sky-200/80 bg-white/95 hover:border-sky-300 hover:bg-white',
        badge: 'border-sky-200 bg-sky-100 text-sky-800',
      };
  }
}

function resolveRoleLabel(role: string | null, locale: 'en' | 'fr') {
  switch (role) {
    case 'super_admin':
      return locale === 'fr' ? 'Super admin' : 'Super admin';
    case 'administrator':
      return locale === 'fr' ? 'Admin' : 'Admin';
    case 'manager':
      return locale === 'fr' ? 'Manager' : 'Manager';
    case 'secretary':
      return locale === 'fr' ? 'Secretaire' : 'Secretary';
    case 'technician':
      return locale === 'fr' ? 'Technicien' : 'Technician';
    case 'read_only':
      return locale === 'fr' ? 'Lecture seule' : 'Read-only';
    case 'external_accountant':
      return locale === 'fr' ? 'Comptable' : 'Accountant';
    default:
      return locale === 'fr' ? 'Client' : 'Client';
  }
}

function resolveMessageMarker(message: TicketMessage, currentUserId: string | null | undefined, locale: 'en' | 'fr') {
  const authorId = resolveUserId(message.authorId || message.author);
  if (currentUserId && authorId === currentUserId) {
    return locale === 'fr' ? 'Vous' : 'You';
  }

  return resolveRoleLabel(resolveMessageRole(message), locale);
}

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { locale } = useLocale();
  const { user, loading: authLoading } = useAuthMe();

  const ticketId = typeof params?.id === 'string' ? params.id : '';
  const { ticket, loading, error, refetch } = useTicketThread(ticketId || undefined);

  const [replyBody, setReplyBody] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<TicketAttachment | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [statusDraft, setStatusDraft] = useState<TicketStatus>('open');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const markedReadRef = useRef<string | null>(null);
  const sendingReplyRef = useRef(false);
  const updatingStatusRef = useRef(false);

  const t = {
    en: {
      shellTitle: 'Ticket Detail',
      heading: 'Ticket thread',
      back: 'Back to tickets',
      notFound: 'Ticket not found.',
      forbiddenTitle: 'You do not have access to this ticket.',
      loadError: 'Could not load ticket thread.',
      refresh: 'Refresh',
      type: 'Type',
      createdBy: 'Created by',
      assignedTo: 'Assigned to',
      linkedRecord: 'Linked record',
      status: 'Status',
      updateStatus: 'Update status',
      statusUpdated: 'Status updated',
      statusUpdateFailed: 'Failed to update status',
      replyTitle: 'Reply',
      replyPlaceholder: 'Write your message here...',
      attachments: 'Attachments',
      messageAttachments: 'Attached files',
      addFiles: 'Add files',
      removeFile: 'Remove',
      sendReply: 'Send reply',
      sendingReply: 'Sending...',
      replySent: 'Reply sent',
      replyFailed: 'Failed to send reply',
      archivedReadOnly: 'Archived tickets are read-only.',
      manageRequired: 'You need ticket manage permission to reply or update status.',
      emptyThread: 'No messages in this thread yet.',
      openLinkedRecord: 'Open linked record',
      createdAt: 'Created',
      updatedAt: 'Updated',
      unassigned: 'Unassigned',
      unreadLabel: 'Unread messages',
      previewAttachment: 'Preview attachment',
      conversationTitle: 'Conversation timeline',
      conversationDescription: 'Read the thread first, then send the next clear action.',
      accountantLabel: 'Accountant',
      clientLabel: 'Client',
    },
    fr: {
      shellTitle: 'Détail Ticket',
      heading: 'Fil du ticket',
      back: 'Retour aux tickets',
      notFound: 'Ticket introuvable.',
      forbiddenTitle: "Vous n'avez pas accès à ce ticket.",
      loadError: 'Impossible de charger le fil du ticket.',
      refresh: 'Actualiser',
      type: 'Type',
      createdBy: 'Créé par',
      assignedTo: 'Assigné à',
      linkedRecord: 'Ressource liée',
      status: 'Statut',
      updateStatus: 'Mettre à jour',
      statusUpdated: 'Statut mis à jour',
      statusUpdateFailed: 'Échec de mise à jour du statut',
      replyTitle: 'Répondre',
      replyPlaceholder: 'Écrivez votre message...',
      attachments: 'Pièces jointes',
      messageAttachments: 'Fichiers joints',
      addFiles: 'Ajouter des fichiers',
      removeFile: 'Retirer',
      sendReply: 'Envoyer la réponse',
      sendingReply: 'Envoi...',
      replySent: 'Réponse envoyée',
      replyFailed: "Impossible d'envoyer la réponse",
      archivedReadOnly: 'Les tickets archivés sont en lecture seule.',
      manageRequired: 'Permission tickets.manage requise pour répondre et changer le statut.',
      emptyThread: 'Aucun message dans ce fil.',
      openLinkedRecord: 'Ouvrir la ressource liée',
      createdAt: 'Créé le',
      updatedAt: 'Mis à jour le',
      unassigned: 'Non assigné',
      unreadLabel: 'Messages non lus',
      previewAttachment: 'Aperçu de la pièce jointe',
      conversationTitle: 'Fil de conversation',
      conversationDescription: 'Relisez d’abord le fil, puis envoyez la prochaine action clairement.',
      accountantLabel: 'Comptable',
      clientLabel: 'Client',
    },
  }[locale];

  const canViewTickets = hasModuleActionAccess({ role: user?.role, modulePermissions: user?.modulePermissions, moduleKey: 'tickets', action: 'view' });
  const canManageTickets = hasModuleActionAccess({ role: user?.role, modulePermissions: user?.modulePermissions, moduleKey: 'tickets', action: 'manage' });

  const canReply = canManageTickets && ticket?.status !== 'archived';

  useEffect(() => {
    if (authLoading || canViewTickets) {
      return;
    }

    router.replace(getDefaultCrmLandingPath(user?.role, user?.modulePermissions, user?.featureFlags));
  }, [authLoading, canViewTickets, router, user?.featureFlags, user?.modulePermissions, user?.role]);

  useEffect(() => {
    if (!ticket?.status) {
      return;
    }

    setStatusDraft(ticket.status);
  }, [ticket?.status]);

  useEffect(() => {
    if (!ticket?._id || !ticket.isUnreadForMe || markedReadRef.current === ticket._id) {
      return;
    }

    markedReadRef.current = ticket._id;

    void markTicketRead(ticket._id)
      .then(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('sidebar-badges:refresh'));
        }
        return refetch();
      })
      .catch(() => {
        // Keep detail usable even if mark-read fails.
      });
  }, [refetch, ticket?._id, ticket?.isUnreadForMe]);

  const participants = useMemo(() => {
    if (!ticket) {
      return '';
    }

    const names = Array.isArray(ticket.assignedTo)
      ? ticket.assignedTo.map((member) => resolveUserName(member, t.unassigned)).filter(Boolean)
      : [];

    return names.length > 0 ? names.join(', ') : t.unassigned;
  }, [ticket, t.unassigned]);

  const linkedPath = resolveLinkedRecordPath(ticket?.linkedType || null, ticket?.linkedId);

  function onFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files ? Array.from(event.target.files) : [];
    if (selected.length > 0) {
      setReplyFiles((previous) => mergeUniqueFiles(previous, selected));
    }
    event.target.value = '';
  }

  function removeReplyFile(index: number) {
    setReplyFiles((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSendReply() {
    if (!ticket?._id || sendingReply || sendingReplyRef.current || !canReply) {
      return;
    }

    const trimmedBody = replyBody.trim();
    if (!trimmedBody && replyFiles.length === 0) {
      return;
    }

    sendingReplyRef.current = true;
    setSendingReply(true);

    try {
      const attachments: TicketAttachment[] = replyFiles.length > 0 ? await uploadTicketFiles(replyFiles) : [];
      await replyTicket({
        ticketId: ticket._id,
        body: trimmedBody || null,
        attachments,
      });

      toast.success(t.replySent);
      setReplyBody('');
      setReplyFiles([]);
      await refetch();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('sidebar-badges:refresh'));
      }
    } catch (sendError) {
      console.error('[tickets] reply failed', sendError);
      toast.error(t.replyFailed);
    } finally {
      sendingReplyRef.current = false;
      setSendingReply(false);
    }
  }

  async function handleStatusUpdate() {
    if (!ticket?._id || updatingStatus || updatingStatusRef.current || !canManageTickets) {
      return;
    }

    if (statusDraft === ticket.status) {
      return;
    }

    updatingStatusRef.current = true;
    setUpdatingStatus(true);
    try {
      await changeTicketStatus({ ticketId: ticket._id, status: statusDraft });
      toast.success(t.statusUpdated);
      await refetch();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('sidebar-badges:refresh'));
      }
    } catch (statusError) {
      console.error('[tickets] status update failed', statusError);
      toast.error(t.statusUpdateFailed);
    } finally {
      updatingStatusRef.current = false;
      setUpdatingStatus(false);
    }
  }

  return (
    <CrmShell title={t.shellTitle} contentClassName="gap-4 px-4 py-3 lg:px-6 lg:py-4">
      <div className="flex flex-col gap-2.5 rounded-2xl bg-card/70 p-3 text-left shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" onClick={() => router.push('/tickets')}>
            <ArrowLeftIcon className="size-4" />
            {t.back}
          </Button>

          <Button type="button" variant="outline" onClick={() => void refetch()} disabled={loading}>
            {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            {t.refresh}
          </Button>
        </div>

        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{t.heading}</h1>
      </div>

      {!authLoading && !canViewTickets ? <ErrorMessage message={t.forbiddenTitle} /> : null}

      {error && canViewTickets ? <ErrorMessage message={t.loadError} /> : null}

      {loading ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="mt-2 h-4 w-40" />
          </div>
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      ) : !ticket ? (
        <div className="rounded-2xl border border-border/70 bg-card p-4">
          <EmptyState message={t.notFound} />
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground">{formatInvoiceReferencesInText(locale, ticket.title)}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <TicketStatusBadge status={ticket.status} locale={locale} />
                  <TicketUnreadIndicator unreadCount={ticket.unreadCount} locale={locale} />
                </div>
              </div>

              {linkedPath ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={linkedPath}>{t.openLinkedRecord}</Link>
                </Button>
              ) : null}
            </div>

            <div className="mt-3 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
              <p>
                {t.type}: <span className="font-medium text-foreground">{getTicketTypeLabel(ticket.type, locale)}</span>
              </p>
              <p>
                  {t.status}: <span className="font-medium text-foreground">{getTicketStatusLabel(ticket.status, locale)}</span>
              </p>
              <p>
                {t.createdBy}: <span className="font-medium text-foreground">{resolveUserName(ticket.createdBy, '-')}</span>
              </p>
              <p>
                {t.assignedTo}: <span className="font-medium text-foreground">{participants}</span>
              </p>
              <p>
                {t.createdAt}: <span className="font-medium text-foreground">{formatDateTime(ticket.createdAt, locale)}</span>
              </p>
              <p>
                {t.updatedAt}: <span className="font-medium text-foreground">{formatDateTime(ticket.updatedAt, locale)}</span>
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1.5">
                <Label>{t.status}</Label>
                <select
                  value={statusDraft}
                  onChange={(event) => setStatusDraft(event.target.value as TicketStatus)}
                  disabled={!canManageTickets || updatingStatus}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm sm:w-48"
                >
                  {TICKET_STATUSES.map((status) => (
                    <option key={status} value={status}>{getTicketStatusLabel(status, locale)}</option>
                  ))}
                </select>
              </div>

              <Button type="button" onClick={() => void handleStatusUpdate()} disabled={!canManageTickets || updatingStatus || statusDraft === ticket.status}>
                {updatingStatus ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {t.updateStatus}
              </Button>
            </div>

            {!canManageTickets ? (
              <p className="mt-2 text-xs text-muted-foreground">{t.manageRequired}</p>
            ) : ticket.status === 'archived' ? (
              <p className="mt-2 text-xs text-muted-foreground">{t.archivedReadOnly}</p>
            ) : null}
          </section>

          <section className="space-y-2 rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{t.replyTitle}</h3>
              <TicketUnreadIndicator unreadCount={ticket.unreadCount} locale={locale} />
            </div>
            <p className="text-sm text-muted-foreground">{t.conversationDescription}</p>
            <Textarea
              value={replyBody}
              onChange={(event) => setReplyBody(event.target.value)}
              placeholder={t.replyPlaceholder}
              rows={4}
              maxLength={10000}
              disabled={!canReply || sendingReply}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{t.attachments}</Label>
                <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary hover:underline">
                  <PaperclipIcon className="size-3.5" />
                  {t.addFiles}
                  <input type="file" className="hidden" accept={FILE_ACCEPT} multiple onChange={onFilesSelected} disabled={!canReply || sendingReply} />
                </label>
              </div>

              {replyFiles.length > 0 ? (
                <div className="space-y-1">
                  {replyFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/70 px-2 py-1 text-xs">
                      <span className="truncate text-foreground">{file.name}</span>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => removeReplyFile(index)} disabled={!canReply || sendingReply}>
                        {t.removeFile}
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={() => void handleSendReply()} disabled={!canReply || sendingReply || (!replyBody.trim() && replyFiles.length === 0)}>
                {sendingReply ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
                {sendingReply ? t.sendingReply : t.sendReply}
              </Button>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{t.conversationTitle}</h3>
              <TicketUnreadIndicator unreadCount={ticket.unreadCount} locale={locale} />
            </div>
            <p className="text-sm text-muted-foreground">{t.conversationDescription}</p>

            {ticket.messages && ticket.messages.length > 0 ? (
              <div className="space-y-3">
                {ticket.messages.map((message, index) => {
                  const authorLabel = resolveMessageAuthor(message, locale);
                  const role = resolveMessageRole(message);
                  const tone = getMessageTone(role);
                  const messageLabel = resolveMessageMarker(message, user?.id, locale);

                  return (
                    <div key={message._id} className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${tone.card}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="text-sm font-bold text-foreground sm:text-base">{authorLabel}</p>
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone.badge}`}>{messageLabel}</span>
                            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              #{ticket.messages.length - index}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] font-medium text-muted-foreground">{formatDateTime(message.createdAt, locale)}</p>
                      </div>

                      {message.body ? (
                        <div className={`mt-3 rounded-xl border px-3.5 py-3 ${tone.body}`}>
                          <p className="whitespace-pre-wrap wrap-break-word text-sm leading-6 text-foreground">{formatInvoiceReferencesInText(locale, message.body)}</p>
                        </div>
                      ) : null}

                      {Array.isArray(message.attachments) && message.attachments.length > 0 ? (
                        <div className={`mt-3 rounded-xl border p-3 ${tone.attachments}`}>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/80">
                              {t.messageAttachments}
                            </p>
                            <span className="text-[11px] font-medium text-muted-foreground">{message.attachments.length}</span>
                          </div>
                          <div className="space-y-2">
                            {message.attachments.map((attachment, index) => {
                              const fileName = attachment.displayName || attachment.originalName;
                              const fileMeta = [formatFileSize(attachment.sizeBytes), attachment.extension?.toUpperCase()]
                                .filter(Boolean)
                                .join(' · ');

                              return (
                                <button
                                  type="button"
                                  key={`${attachment.url}-${index}`}
                                  onClick={() => setPreviewAttachment(attachment)}
                                  title={t.previewAttachment}
                                  aria-label={`${t.previewAttachment}: ${fileName}`}
                                  className={`group flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left shadow-sm transition-colors ${tone.attachmentButton}`}
                                >
                                  <span className="flex min-w-0 items-center gap-2">
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/5">
                                      <PaperclipIcon className="size-4 shrink-0 text-foreground" />
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate text-sm font-semibold text-foreground">{fileName}</span>
                                      {fileMeta ? <span className="block text-[11px] text-muted-foreground">{fileMeta}</span> : null}
                                    </span>
                                  </span>
                                  <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState message={t.emptyThread} />
            )}
          </section>
        </div>
      )}

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
                name: previewAttachment.displayName || previewAttachment.originalName,
                url: previewAttachment.url,
                mimeType: previewAttachment.mimeType,
              }
            : null
        }
        locale={locale}
      />
    </CrmShell>
  );
}
