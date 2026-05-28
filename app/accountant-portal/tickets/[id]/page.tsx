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
import { formatInvoiceReferencesInText } from '@/lib/i18n/messages';
import { getTicketLinkedTypeLabel, getTicketStatusLabel, getTicketTypeLabel } from '@/lib/tickets/i18n';
import type { TicketStatus } from '@/lib/tickets/constants';

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

function resolveMessageAuthor(message: TicketMessage, locale: 'en' | 'fr') {
  const fallback = locale === 'fr' ? 'Collaborateur' : 'Teammate';
  return resolveUserName(message.author || message.authorId, fallback);
}

function resolveLinkedRecordLabel(linkedType: string | null | undefined, linkedId: unknown, locale: 'en' | 'fr') {
  const id = resolveUserId(linkedId);
  if (!linkedType) return '-';

  if (linkedType === 'expense' || linkedType === 'invoice' || linkedType === 'supplier' || linkedType === 'client') {
    return `${getTicketLinkedTypeLabel(linkedType, locale)}${id ? ` #${id.slice(-6)}` : ''}`;
  }

  return `${linkedType}${id ? ` #${id.slice(-6)}` : ''}`;
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
    replyDescription: 'Post a reply, request missing files, or push the ticket forward.',
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
    conversation: 'Conversation',
    conversationDescription: 'Everything already shared on this ticket stays grouped in one place.',
    messageNumber: (value: number) => `Message ${value}`,
  },
  fr: {
    title: 'Fil du ticket',
    subtitle: 'Répondez aux tickets assignés et faites avancer leur résolution.',
    back: 'Retour aux tickets',
    refresh: 'Actualiser',
    type: 'Type',
    createdBy: 'Créé par',
    assignedTo: 'Assigné à',
    linkedRecord: 'Ressource liée',
    createdAt: 'Créé le',
    updatedAt: 'Mis à jour le',
    status: 'Statut',
    updateStatus: 'Mettre à jour',
    reply: 'Répondre',
    replyDescription: 'Publiez une réponse, demandez des fichiers manquants ou faites avancer le ticket.',
    replyPlaceholder: 'Écrivez votre mise à jour...',
    addFiles: 'Ajouter des fichiers',
    sendReply: 'Envoyer la réponse',
    sending: 'Envoi...',
    archivedReadOnly: 'Les tickets archivés sont en lecture seule.',
    statusUpdated: 'Statut mis à jour',
    statusFailed: 'Échec de mise à jour du statut',
    replySent: 'Réponse envoyée',
    replyFailed: 'Échec d’envoi de la réponse',
    empty: 'Aucun message dans ce fil.',
    notFound: 'Ticket introuvable.',
    attachments: 'Pièces jointes',
    conversation: 'Conversation',
    conversationDescription: 'Tout ce qui a déjà été partagé sur ce ticket reste groupé au même endroit.',
    messageNumber: (value: number) => `Message ${value}`,
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-6">
      <Card className="overflow-hidden rounded-[28px] border-border/70 bg-white/90 py-0 shadow-sm">
        <CardHeader className="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between xl:px-7">
          <div>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="rounded-full px-4" onClick={() => router.push('/accountant-portal/tickets')}>
              <ArrowLeftIcon className="size-4" />
              {t.back}
            </Button>
            <Button type="button" variant="outline" className="rounded-full px-4" onClick={() => void refetch()} disabled={loading}>
              {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
              {t.refresh}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {error ? <ErrorMessage message={error} /> : null}

      {loading ? (
        <div className="space-y-3">
          <Card className="overflow-hidden rounded-[28px] border-border/70 bg-white/90 shadow-sm"><CardContent className="space-y-3 px-5 py-6 sm:px-6"><Skeleton className="h-6 w-48" /><Skeleton className="h-28 w-full" /></CardContent></Card>
          <Card className="overflow-hidden rounded-[28px] border-border/70 bg-white/90 shadow-sm"><CardContent className="space-y-3 px-5 py-6 sm:px-6"><Skeleton className="h-44 w-full" /></CardContent></Card>
        </div>
      ) : !ticket ? (
        <Card className="overflow-hidden rounded-[28px] border-border/70 bg-white/90 shadow-sm"><CardContent className="px-5 py-8 sm:px-6"><EmptyState message={t.notFound} /></CardContent></Card>
      ) : (
        <>
          <Card className="overflow-hidden rounded-[30px] border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] shadow-sm">
            <CardContent className="space-y-6 px-5 py-6 sm:px-6 lg:px-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 space-y-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">{formatInvoiceReferencesInText(locale, ticket.title)}</h1>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <TicketStatusBadge status={ticket.status} locale={locale} />
                    <TicketUnreadIndicator unreadCount={ticket.unreadCount} locale={locale} />
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-3 shadow-sm sm:p-4 xl:min-w-[320px]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t.status}</Label>
                      <p className="text-xs text-muted-foreground">{t.updateStatus}</p>
                    </div>
                    <div className="min-w-44 flex-1 space-y-1.5">
                      <Label className="sr-only">{t.status}</Label>
                    <Select value={statusDraft} onValueChange={(value) => setStatusDraft(value as TicketStatus)} disabled={ticket.status === 'archived'}>
                      <SelectTrigger>
                        <SelectValue placeholder={t.status} />
                      </SelectTrigger>
                      <SelectContent>
                        {['open', 'waiting', 'replied', 'resolved'].map((status) => (
                          <SelectItem key={status} value={status}>{getTicketStatusLabel(status as TicketStatus, locale)}</SelectItem>
                        ))}
                        {ticket.status === 'archived' ? <SelectItem value="archived">{getTicketStatusLabel('archived', locale)}</SelectItem> : null}
                      </SelectContent>
                    </Select>
                    </div>
                    <Button type="button" className="w-full shrink-0 rounded-xl sm:w-auto" onClick={() => void handleStatusUpdate()} disabled={ticket.status === 'archived' || updatingStatus || statusDraft === ticket.status}>
                      {updatingStatus ? <Loader2Icon className="size-4 animate-spin" /> : null}
                      {t.updateStatus}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t.type}</p>
                  <p className="mt-2 text-sm font-medium text-slate-950">{getTicketTypeLabel(ticket.type, locale)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t.createdBy}</p>
                  <p className="mt-2 text-sm font-medium text-slate-950">{resolveUserName(ticket.createdBy, '-')}</p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t.assignedTo}</p>
                  <p className="mt-2 text-sm font-medium text-slate-950">{assignedNames}</p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t.linkedRecord}</p>
                  <p className="mt-2 text-sm font-medium text-slate-950">{resolveLinkedRecordLabel(ticket.linkedType, ticket.linkedId, locale)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t.createdAt}</p>
                  <p className="mt-2 text-sm font-medium text-slate-950">{formatDateTime(ticket.createdAt, locale)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t.updatedAt}</p>
                  <p className="mt-2 text-sm font-medium text-slate-950">{formatDateTime(ticket.updatedAt, locale)}</p>
                </div>
              </div>

              {ticket.status === 'archived' ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-3 text-sm text-muted-foreground">
                  {t.archivedReadOnly}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[28px] border-border/70 bg-white/90 shadow-sm">
            <CardHeader className="px-5 py-5 sm:px-6 lg:px-7">
              <CardTitle>{t.reply}</CardTitle>
              <CardDescription>{t.replyDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-6 sm:px-6 lg:px-7">
              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-3 sm:p-4">
                <Textarea
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  placeholder={t.replyPlaceholder}
                  rows={5}
                  disabled={!canReply || sendingReply}
                  className="min-h-32 resize-y border-slate-200 bg-white"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-slate-50">
                  <PaperclipIcon className="size-4" />
                  {t.addFiles}
                  <input type="file" className="hidden" accept={FILE_ACCEPT} multiple onChange={onFilesSelected} disabled={!canReply || sendingReply} />
                </label>
                <Button type="button" className="w-full rounded-xl sm:w-auto" onClick={() => void handleSendReply()} disabled={!canReply || sendingReply || (!replyBody.trim() && replyFiles.length === 0)}>
                  {sendingReply ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
                  {sendingReply ? t.sending : t.sendReply}
                </Button>
              </div>

              {replyFiles.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {replyFiles.map((file, index) => (
                    <button key={getFileSignature(file)} type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-slate-50" onClick={() => removeReplyFile(index)}>
                      {file.name} {formatFileSize(file.size)}
                    </button>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[28px] border-border/70 bg-white/90 shadow-sm">
            <CardHeader className="px-5 py-5 sm:px-6 lg:px-7">
              <CardTitle>{t.conversation}</CardTitle>
              <CardDescription>{t.conversationDescription}</CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-6 sm:px-6 lg:px-7">
              {ticket.messages.length === 0 ? (
                <EmptyState message={t.empty} />
              ) : (
                <div className="space-y-4">
                  {ticket.messages.map((message, index) => (
                    <div key={message._id} className="rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-4 shadow-sm sm:p-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="font-medium text-slate-950">{resolveMessageAuthor(message, locale)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{t.messageNumber(ticket.messages.length - index)}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDateTime(message.createdAt, locale)}</div>
                      </div>
                      {message.body ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">{formatInvoiceReferencesInText(locale, message.body)}</p> : null}
                      {message.attachments && message.attachments.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {message.attachments.map((attachment) => (
                            <a key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100">
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