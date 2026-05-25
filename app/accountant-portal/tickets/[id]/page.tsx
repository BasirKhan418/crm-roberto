'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeftIcon, Loader2Icon, PaperclipIcon, RefreshCwIcon, SendIcon } from 'lucide-react';
import { toast } from 'sonner';

import { useLocale } from '@/components/providers/locale-provider';
import { TicketStatusBadge } from '@/components/tickets/ticket-status-badge';
import { TicketUnreadIndicator } from '@/components/tickets/ticket-unread-indicator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { changeAccountantTicketStatus, replyAccountantTicket, uploadAccountantTicketFiles, useAccountantTicketThread } from '@/hooks/useAccountantTickets';
import type { TicketAttachment, TicketMessage } from '@/hooks/useTickets';
import type { TicketStatus, TicketType } from '@/lib/tickets/constants';

const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.heic';

function getFileSignature(file: File) {
  return `${file.name.toLowerCase()}::${file.size}::${file.lastModified}`;
}

function mergeUniqueFiles(current: File[], incoming: File[]) {
  if (incoming.length === 0) return current;
  const known = new Set(current.map((file) => getFileSignature(file)));
  const merged = [...current];
  for (const file of incoming) {
    const signature = getFileSignature(file);
    if (known.has(signature)) continue;
    known.add(signature);
    merged.push(file);
  }
  return merged;
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

function formatFileSize(sizeBytes: number | undefined) {
  const value = typeof sizeBytes === 'number' ? sizeBytes : Number.NaN;
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function resolveUserId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const maybeId = (value as { _id?: unknown })._id;
    if (typeof maybeId === 'string') return maybeId;
  }
  return null;
}

function resolveUserName(value: unknown, fallback: string) {
  if (!value || typeof value !== 'object') return fallback;
  const typed = value as { name?: string; email?: string };
  return typed.name?.trim() || typed.email?.trim() || fallback;
}

function resolveTypeLabel(type: TicketType, locale: 'en' | 'fr') {
  const labels = {
    en: { accounting: 'Accounting', validation: 'Validation', document: 'Document', dispute: 'Dispute' },
    fr: { accounting: 'Comptabilite', validation: 'Validation', document: 'Document', dispute: 'Litige' },
  } as const;
  return labels[locale][type] || type;
}

function resolveMessageAuthor(message: TicketMessage, locale: 'en' | 'fr') {
  const fallback = locale === 'fr' ? 'Collaborateur' : 'Teammate';
  return resolveUserName(message.author || message.authorId, fallback);
}

function resolveLinkedRecordLabel(linkedType: string | null | undefined, linkedId: unknown, locale: 'en' | 'fr') {
  const id = resolveUserId(linkedId);
  if (!linkedType) return '-';

  const labels = {
    en: { expense: 'Expense', invoice: 'Invoice', supplier: 'Supplier', client: 'Client' },
    fr: { expense: 'Depense', invoice: 'Facture', supplier: 'Fournisseur', client: 'Client' },
  } as const;

  const typed = linkedType as keyof typeof labels.en;
  return `${labels[locale][typed] || linkedType}${id ? ` #${id.slice(-6)}` : ''}`;
}

const copy = {
  en: {
    title: 'Ticket thread',
    subtitle: 'Reply to assigned tickets and move them toward resolution.',
    back: 'Back to tickets',
    refresh: 'Refresh',
    type: 'Type',
    createdBy: 'Created by',
    assignedTo: 'Assigned to',
    linkedRecord: 'Linked record',
    createdAt: 'Created',
    updatedAt: 'Updated',
    status: 'Status',
    updateStatus: 'Update status',
    reply: 'Reply',
    replyPlaceholder: 'Write your update here...',
    addFiles: 'Add files',
    sendReply: 'Send reply',
    sending: 'Sending...',
    archivedReadOnly: 'Archived tickets are read-only.',
    statusUpdated: 'Status updated',
    statusFailed: 'Failed to update status',
    replySent: 'Reply sent',
    replyFailed: 'Failed to send reply',
    empty: 'No messages in this thread yet.',
    notFound: 'Ticket not found.',
    attachments: 'Attachments',
  },
  fr: {
    title: 'Fil du ticket',
    subtitle: 'Repondez aux tickets assignes et faites avancer leur resolution.',
    back: 'Retour aux tickets',
    refresh: 'Actualiser',
    type: 'Type',
    createdBy: 'Cree par',
    assignedTo: 'Assigne a',
    linkedRecord: 'Ressource liee',
    createdAt: 'Cree le',
    updatedAt: 'Mis a jour le',
    status: 'Statut',
    updateStatus: 'Mettre a jour',
    reply: 'Repondre',
    replyPlaceholder: 'Ecrivez votre mise a jour...',
    addFiles: 'Ajouter des fichiers',
    sendReply: 'Envoyer la reponse',
    sending: 'Envoi...',
    archivedReadOnly: 'Les tickets archives sont en lecture seule.',
    statusUpdated: 'Statut mis a jour',
    statusFailed: 'Echec de mise a jour du statut',
    replySent: 'Reponse envoyee',
    replyFailed: 'Echec d envoi de la reponse',
    empty: 'Aucun message dans ce fil.',
    notFound: 'Ticket introuvable.',
    attachments: 'Pieces jointes',
  },
} as const;

export default function AccountantPortalTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { locale } = useLocale();
  const t = copy[locale];

  const ticketId = typeof params?.id === 'string' ? params.id : '';
  const { ticket, loading, error, refetch } = useAccountantTicketThread(ticketId || undefined);

  const [replyBody, setReplyBody] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [sendingReply, setSendingReply] = useState(false);
  const [statusDraft, setStatusDraft] = useState<TicketStatus>('open');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const sendingReplyRef = useRef(false);
  const updatingStatusRef = useRef(false);

  useEffect(() => {
    if (ticket?.status) {
      setStatusDraft(ticket.status);
    }
  }, [ticket?.status]);

  const assignedNames = useMemo(() => {
    if (!ticket || !Array.isArray(ticket.assignedTo)) return '-';
    const names = ticket.assignedTo.map((user) => resolveUserName(user, '-')).filter(Boolean);
    return names.length > 0 ? names.join(', ') : '-';
  }, [ticket]);

  const canReply = ticket?.status !== 'archived';

  function onFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files ? Array.from(event.target.files) : [];
    if (selected.length > 0) {
      setReplyFiles((previous) => mergeUniqueFiles(previous, selected));
    }
    event.target.value = '';
  }

  function removeReplyFile(index: number) {
    setReplyFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
  }

  async function handleSendReply() {
    if (!ticket?._id || sendingReply || sendingReplyRef.current || !canReply) return;

    const trimmedBody = replyBody.trim();
    if (!trimmedBody && replyFiles.length === 0) return;

    sendingReplyRef.current = true;
    setSendingReply(true);

    try {
      const attachments: TicketAttachment[] = replyFiles.length > 0 ? await uploadAccountantTicketFiles(replyFiles) : [];
      await replyAccountantTicket({ ticketId: ticket._id, body: trimmedBody || null, attachments });
      toast.success(t.replySent);
      setReplyBody('');
      setReplyFiles([]);
      await refetch();
    } catch (sendError) {
      console.error('[accountant-portal] reply failed', sendError);
      toast.error(t.replyFailed);
    } finally {
      sendingReplyRef.current = false;
      setSendingReply(false);
    }
  }

  async function handleStatusUpdate() {
    if (!ticket?._id || updatingStatus || updatingStatusRef.current || statusDraft === ticket.status) return;

    updatingStatusRef.current = true;
    setUpdatingStatus(true);
    try {
      await changeAccountantTicketStatus({ ticketId: ticket._id, status: statusDraft });
      toast.success(t.statusUpdated);
      await refetch();
    } catch (statusError) {
      console.error('[accountant-portal] status update failed', statusError);
      toast.error(t.statusFailed);
    } finally {
      updatingStatusRef.current = false;
      setUpdatingStatus(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-white/90 shadow-sm">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => router.push('/accountant-portal/tickets')}>
              <ArrowLeftIcon className="size-4" />
              {t.back}
            </Button>
            <Button type="button" variant="outline" onClick={() => void refetch()} disabled={loading}>
              {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
              {t.refresh}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {error ? <ErrorMessage message={error} /> : null}

      {loading ? (
        <div className="space-y-3">
          <Card className="border-border/70 bg-white/90 shadow-sm"><CardContent className="space-y-3 pt-6"><Skeleton className="h-6 w-48" /><Skeleton className="h-24 w-full" /></CardContent></Card>
          <Card className="border-border/70 bg-white/90 shadow-sm"><CardContent className="space-y-3 pt-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
        </div>
      ) : !ticket ? (
        <Card className="border-border/70 bg-white/90 shadow-sm"><CardContent className="pt-6"><EmptyState message={t.notFound} /></CardContent></Card>
      ) : (
        <>
          <Card className="border-border/70 bg-white/90 shadow-sm">
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <h1 className="text-xl font-semibold text-slate-950">{ticket.title}</h1>
                  <div className="flex flex-wrap items-center gap-2">
                    <TicketStatusBadge status={ticket.status} locale={locale} />
                    <TicketUnreadIndicator unreadCount={ticket.unreadCount} locale={locale} />
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <div className="min-w-44 space-y-1.5">
                    <Label>{t.status}</Label>
                    <Select value={statusDraft} onValueChange={(value) => setStatusDraft(value as TicketStatus)} disabled={ticket.status === 'archived'}>
                      <SelectTrigger>
                        <SelectValue placeholder={t.status} />
                      </SelectTrigger>
                      <SelectContent>
                        {['open', 'waiting', 'replied', 'resolved'].map((status) => (
                          <SelectItem key={status} value={status}>{status.replace('_', ' ')}</SelectItem>
                        ))}
                        {ticket.status === 'archived' ? <SelectItem value="archived">archived</SelectItem> : null}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" onClick={() => void handleStatusUpdate()} disabled={ticket.status === 'archived' || updatingStatus || statusDraft === ticket.status}>
                    {updatingStatus ? <Loader2Icon className="size-4 animate-spin" /> : null}
                    {t.updateStatus}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 text-sm text-muted-foreground">
                <div><span className="font-medium text-foreground">{t.type}:</span> {resolveTypeLabel(ticket.type, locale)}</div>
                <div><span className="font-medium text-foreground">{t.createdBy}:</span> {resolveUserName(ticket.createdBy, '-')}</div>
                <div><span className="font-medium text-foreground">{t.assignedTo}:</span> {assignedNames}</div>
                <div><span className="font-medium text-foreground">{t.linkedRecord}:</span> {resolveLinkedRecordLabel(ticket.linkedType, ticket.linkedId, locale)}</div>
                <div><span className="font-medium text-foreground">{t.createdAt}:</span> {formatDateTime(ticket.createdAt, locale)}</div>
                <div><span className="font-medium text-foreground">{t.updatedAt}:</span> {formatDateTime(ticket.updatedAt, locale)}</div>
              </div>

              {ticket.status === 'archived' ? <p className="text-sm text-muted-foreground">{t.archivedReadOnly}</p> : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle>{t.reply}</CardTitle>
              <CardDescription>{t.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={replyBody} onChange={(event) => setReplyBody(event.target.value)} placeholder={t.replyPlaceholder} rows={5} disabled={!canReply || sendingReply} />
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-foreground">
                  <PaperclipIcon className="size-4" />
                  {t.addFiles}
                  <input type="file" className="hidden" accept={FILE_ACCEPT} multiple onChange={onFilesSelected} disabled={!canReply || sendingReply} />
                </label>
                <Button type="button" onClick={() => void handleSendReply()} disabled={!canReply || sendingReply || (!replyBody.trim() && replyFiles.length === 0)}>
                  {sendingReply ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
                  {sendingReply ? t.sending : t.sendReply}
                </Button>
              </div>

              {replyFiles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {replyFiles.map((file, index) => (
                    <button key={getFileSignature(file)} type="button" className="rounded-full border px-3 py-1 text-xs text-muted-foreground" onClick={() => removeReplyFile(index)}>
                      {file.name} {formatFileSize(file.size)}
                    </button>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle>{t.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {ticket.messages.length === 0 ? (
                <EmptyState message={t.empty} />
              ) : (
                <div className="space-y-3">
                  {ticket.messages.map((message) => (
                    <div key={message._id} className="rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium text-slate-950">{resolveMessageAuthor(message, locale)}</div>
                        <div className="text-xs text-muted-foreground">{formatDateTime(message.createdAt, locale)}</div>
                      </div>
                      {message.body ? <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{message.body}</p> : null}
                      {message.attachments && message.attachments.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.attachments.map((attachment) => (
                            <a key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
                              <PaperclipIcon className="size-3.5" />
                              {attachment.displayName}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}