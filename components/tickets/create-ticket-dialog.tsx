'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';

import {
  Loader2Icon,
  MessageSquarePlusIcon,
  PaperclipIcon,
  RefreshCwIcon,
  XIcon,
} from 'lucide-react';

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
import { Checkbox } from '@/components/ui/checkbox';
import {
  TICKET_LINKED_TYPES,
  TICKET_TYPES,
  type TicketLinkedType,
  type TicketType,
} from '@/lib/tickets/constants';
import { getTicketLinkedTypeLabel, getTicketTypeLabel } from '@/lib/tickets/i18n';
import {
  createTicket,
  uploadTicketFiles,
  useTicketRecipients,
} from '@/hooks/useTickets';

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

type LinkedRecordOption = { _id: string; label: string; sub?: string };
type ExpenseApiItem = {
  _id: string;
  expenseDate?: string | null;
  supplierRef?: string | null;
  supplierId?: null | string | { _id: string; fullName?: string; companyName?: string | null };
};
type InvoiceApiItem = { _id: string; invoiceNumber: string; clientSnapshot?: { fullName?: string } };
type ClientApiItem = { _id: string; fullName: string; companyName?: string | null; email?: string | null };
type SupplierApiItem = { _id: string; fullName: string; contactName?: string | null; email?: string | null };

type LinkedPrefill = {
  linkedType?: TicketLinkedType | null;
  linkedId?: string | null;
  linkedLabel?: string | null;
  title?: string | null;
  body?: string | null;
};

type CreateTicketDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: 'en' | 'fr';
  prefill?: LinkedPrefill;
  onCreated?: () => void | Promise<void>;
};

export function CreateTicketDialog({
  open,
  onOpenChange,
  locale,
  prefill,
  onCreated,
}: CreateTicketDialogProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TicketType>('document');
  const [body, setBody] = useState('');
  const [linkedType, setLinkedType] = useState<TicketLinkedType | ''>('');
  const [linkedId, setLinkedId] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [linkedRecordSearch, setLinkedRecordSearch] = useState('');
  const [linkedRecords, setLinkedRecords] = useState<LinkedRecordOption[]>([]);
  const [linkedRecordsLoading, setLinkedRecordsLoading] = useState(false);
  const [linkedLabel, setLinkedLabel] = useState('');
  const submitInFlightRef = useRef(false);
  const initializedSessionKeyRef = useRef<string | null>(null);

  const { users, loading: recipientsLoading, error: recipientsError, refetch: refetchRecipients } =
    useTicketRecipients(recipientSearch.trim() || undefined, 40);

  useEffect(() => {
    if (!linkedType || linkedId) {
      if (!linkedType) setLinkedRecords([]);
      return;
    }

    setLinkedRecordsLoading(true);
    const controller = new AbortController();
    const q = linkedRecordSearch.trim();

    const urls: Record<string, string> = {
      expense: `/api/expenses?limit=20${q ? `&search=${encodeURIComponent(q)}` : ''}`,
      invoice: `/api/invoices?limit=20${q ? `&search=${encodeURIComponent(q)}` : ''}`,
      client: `/api/clients?limit=20${q ? `&search=${encodeURIComponent(q)}` : ''}`,
      supplier: `/api/suppliers?limit=20${q ? `&search=${encodeURIComponent(q)}` : ''}`,
    };

    const timer = setTimeout(() => {
      fetch(urls[linkedType], { signal: controller.signal })
        .then((res) => res.json())
        .then((json) => {
          let records: LinkedRecordOption[] = [];
          if (linkedType === 'expense') {
            const items = (json.items ?? json.data ?? []) as ExpenseApiItem[];
            records = items.map((item) => {
              const sup =
                typeof item.supplierId === 'object' && item.supplierId
                  ? (item.supplierId.companyName || item.supplierId.fullName || '')
                  : '';
              const label = item.supplierRef || sup || `#${item._id.slice(-6)}`;
              const sub = item.expenseDate
                ? new Date(item.expenseDate).toLocaleDateString(
                    locale === 'fr' ? 'fr-FR' : 'en-GB',
                    { day: '2-digit', month: 'short', year: 'numeric' },
                  )
                : '';
              return { _id: item._id, label, sub };
            });
          } else if (linkedType === 'invoice') {
            const items = (json.data ?? []) as InvoiceApiItem[];
            records = items.map((item) => ({
              _id: item._id,
              label: item.invoiceNumber,
              sub: item.clientSnapshot?.fullName ?? '',
            }));
          } else if (linkedType === 'client') {
            const items = (json.data ?? []) as ClientApiItem[];
            records = items.map((item) => ({
              _id: item._id,
              label: item.fullName,
              sub: item.companyName || item.email || '',
            }));
          } else {
            const items = (json.data ?? []) as SupplierApiItem[];
            records = items.map((item) => ({
              _id: item._id,
              label: item.fullName,
              sub: item.contactName || item.email || '',
            }));
          }
          setLinkedRecords(records);
          setLinkedRecordsLoading(false);
        })
        .catch((err: unknown) => {
          if ((err as Error).name !== 'AbortError') {
            setLinkedRecords([]);
            setLinkedRecordsLoading(false);
          }
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [linkedType, linkedRecordSearch, linkedId, locale]);

  const t = useMemo(
    () =>
      locale === 'fr'
        ? {
            title: 'Créer un ticket',
            description: 'Discutez un sujet interne et assignez les bons destinataires.',
            ticketTitle: 'Titre',
            ticketType: 'Type',
            message: 'Message',
            recipients: 'Destinataires',
            recipientsSearch: 'Rechercher un collaborateur...',
            recipientsLoading: 'Chargement des destinataires...',
            recipientsEmpty: 'Aucun utilisateur trouvé.',
            recipientsLoadFailed: 'Impossible de charger les destinataires.',
            linkedSection: 'Lien optionnel',
            linkedType: 'Type de lien',
            linkedRecord: 'Enregistrement lié',
            linkedHint: 'Optionnel – liez ce ticket à une dépense, une facture, un fournisseur ou un client.',
            linkedSearch: 'Rechercher un enregistrement...',
            linkedLoading: 'Chargement...',
            linkedEmpty: 'Aucun enregistrement trouvé.',
            linkedChange: 'Changer',
            linkedPrefill: 'Lien pré-rempli',
            attachments: 'Pièces jointes',
            addFiles: 'Ajouter des fichiers',
            noFiles: 'Aucun fichier ajouté.',
            removeFile: 'Retirer',
            cancel: 'Annuler',
            create: 'Créer le ticket',
            creating: 'Création...',
            requiredTitle: 'Le titre doit contenir au moins 3 caractères.',
            requiredBody: 'Ajoutez un message ou au moins une pièce jointe.',
            requiredLinkedId: 'Sélectionnez Aucun lien ou choisissez un enregistrement dans la liste.',
            created: 'Ticket créé avec succès.',
            failed: 'Impossible de créer le ticket.',
            refreshRecipients: 'Actualiser',
          }
        : {
            title: 'Create Ticket',
            description: 'Start an internal thread and assign the right recipients.',
            ticketTitle: 'Title',
            ticketType: 'Type',
            message: 'Message',
            recipients: 'Recipients',
            recipientsSearch: 'Search teammate...',
            recipientsLoading: 'Loading recipients...',
            recipientsEmpty: 'No users found.',
            recipientsLoadFailed: 'Failed to load recipients.',
            linkedSection: 'Optional link',
            linkedType: 'Linked type',
            linkedRecord: 'Linked record',
            linkedHint: 'Optional – link this ticket to an expense, invoice, supplier, or client.',
            linkedSearch: 'Search records...',
            linkedLoading: 'Loading...',
            linkedEmpty: 'No records found.',
            linkedChange: 'Change',
            linkedPrefill: 'Prefilled link',
            attachments: 'Attachments',
            addFiles: 'Add files',
            noFiles: 'No files added.',
            removeFile: 'Remove',
            cancel: 'Cancel',
            create: 'Create ticket',
            creating: 'Creating...',
            requiredTitle: 'Title must contain at least 3 characters.',
            requiredBody: 'Add a message or at least one attachment.',
            requiredLinkedId: 'Either select no linked type or choose a record from the list.',
            created: 'Ticket created successfully.',
            failed: 'Failed to create ticket.',
            refreshRecipients: 'Refresh',
          },
    [locale]
  );

  useEffect(() => {
    if (!open) {
      initializedSessionKeyRef.current = null;
      return;
    }

    const sessionKey = `ticket:${prefill?.linkedType || ''}:${prefill?.linkedId || ''}`;
    if (initializedSessionKeyRef.current === sessionKey) {
      return;
    }
    initializedSessionKeyRef.current = sessionKey;

    setTitle(prefill?.title?.trim() || '');
    setType('document');
    setBody(prefill?.body?.trim() || '');
    setLinkedType(prefill?.linkedType || '');
    setLinkedId(prefill?.linkedId?.trim() || '');
    setLinkedLabel(prefill?.linkedLabel?.trim() || '');
    setLinkedRecordSearch('');
    setLinkedRecords([]);
    setLinkedRecordsLoading(false);
    setRecipientSearch('');
    setSelectedRecipientIds([]);
    setFiles([]);
    setFeedback(null);
  }, [open, prefill?.body, prefill?.linkedId, prefill?.linkedLabel, prefill?.linkedType, prefill?.title]);

  function toggleRecipient(userId: string, checked: boolean) {
    setSelectedRecipientIds((previous) => {
      if (checked) {
        if (previous.includes(userId)) return previous;
        return [...previous, userId];
      }

      return previous.filter((id) => id !== userId);
    });
  }

  function onFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files ? Array.from(event.target.files) : [];
    if (selected.length > 0) {
      setFiles((previous) => mergeUniqueFiles(previous, selected));
    }
    event.target.value = '';
  }

  function removeFile(index: number) {
    setFiles((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSubmit() {
    if (submitInFlightRef.current) {
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (trimmedTitle.length < 3) {
      setFeedback({ type: 'error', message: t.requiredTitle });
      return;
    }

    if (!trimmedBody && files.length === 0) {
      setFeedback({ type: 'error', message: t.requiredBody });
      return;
    }

    if (linkedType && !linkedId.trim()) {
      setFeedback({ type: 'error', message: t.requiredLinkedId });
      return;
    }

    submitInFlightRef.current = true;
    setSubmitting(true);
    setFeedback(null);

    try {
      const uploadedAttachments = files.length > 0 ? await uploadTicketFiles(files) : [];

      await createTicket({
        title: trimmedTitle,
        type,
        body: trimmedBody || null,
        assignedTo: selectedRecipientIds,
        linkedType: linkedType || null,
        linkedId: linkedId.trim() || null,
        attachments: uploadedAttachments,
      });

      setFeedback({ type: 'success', message: t.created });

      if (onCreated) {
        await onCreated();
      }

      onOpenChange(false);
    } catch (submitError) {
      console.error('[tickets] create failed', submitError);
      setFeedback({
        type: 'error',
        message:
          submitError instanceof Error &&
          submitError.message.toLowerCase().includes('linkedid is required when linkedtype is set')
            ? t.requiredLinkedId
            : t.failed,
      });
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlusIcon className="size-4" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {feedback ? (
            <p className={`text-sm ${feedback.type === 'success' ? 'text-emerald-600' : 'text-destructive'}`}>
              {feedback.message}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t.ticketTitle}</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} />
            </div>

            <div className="space-y-1.5">
              <Label>{t.ticketType}</Label>
              <select
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={type}
                onChange={(event) => setType(event.target.value as TicketType)}
              >
                {TICKET_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {getTicketTypeLabel(option, locale)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t.message}</Label>
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={4}
                maxLength={10000}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>{t.recipients}</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetchRecipients()}>
                <RefreshCwIcon className="size-3.5" />
                {t.refreshRecipients}
              </Button>
            </div>

            <Input
              value={recipientSearch}
              onChange={(event) => setRecipientSearch(event.target.value)}
              placeholder={t.recipientsSearch}
            />

            <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
              {recipientsLoading ? (
                <p className="text-xs text-muted-foreground">{t.recipientsLoading}</p>
              ) : recipientsError ? (
                <p className="text-xs text-destructive">{t.recipientsLoadFailed}</p>
              ) : users.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t.recipientsEmpty}</p>
              ) : (
                users.map((user) => {
                  const checked = selectedRecipientIds.includes(user._id);

                  return (
                    <label
                      key={user._id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-2 py-1.5"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleRecipient(user._id, Boolean(value))}
                      />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block truncate font-medium">{user.name || user.email || user._id}</span>
                        <span className="block truncate text-xs text-muted-foreground">{user.email || user.role || '-'}</span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t.linkedSection}</Label>
              {prefill?.linkedType && prefill?.linkedId ? (
                <p className="text-xs text-muted-foreground">
                  {t.linkedPrefill}: {prefill.linkedLabel || `${prefill.linkedType} #${prefill.linkedId}`}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{t.linkedHint}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t.linkedType}</Label>
              <select
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={linkedType}
                onChange={(event) => {
                  setLinkedType((event.target.value || '') as TicketLinkedType | '');
                  setLinkedId('');
                  setLinkedLabel('');
                  setLinkedRecordSearch('');
                  setLinkedRecords([]);
                }}
              >
                <option value="">-</option>
                {TICKET_LINKED_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {getTicketLinkedTypeLabel(option, locale)}
                  </option>
                ))}
              </select>
            </div>
            {linkedType && !linkedId ? (
              <div className="sm:col-span-2 space-y-2 rounded-lg border border-border/60 p-3">
                <Input
                  value={linkedRecordSearch}
                  onChange={(event) => setLinkedRecordSearch(event.target.value)}
                  placeholder={t.linkedSearch}
                />
                <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  {linkedRecordsLoading ? (
                    <p className="text-xs text-muted-foreground">{t.linkedLoading}</p>
                  ) : linkedRecords.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t.linkedEmpty}</p>
                  ) : (
                    linkedRecords.map((record) => (
                      <button
                        key={record._id}
                        type="button"
                        onClick={() => {
                          setLinkedId(record._id);
                          setLinkedLabel(record.label);
                        }}
                        className="w-full rounded-md border border-border/60 px-2 py-1.5 text-left hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <span className="block truncate text-sm font-medium">{record.label}</span>
                        {record.sub ? (
                          <span className="block truncate text-xs text-muted-foreground">{record.sub}</span>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : linkedType && linkedId ? (
              <div className="space-y-1.5">
                <Label>{t.linkedRecord}</Label>
                <div className="flex items-center gap-2 rounded-md border border-input bg-muted/30 px-2.5 py-2">
                  <span className="flex-1 truncate text-sm font-medium">{linkedLabel || linkedId}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setLinkedId('');
                      setLinkedLabel('');
                    }}
                  >
                    <XIcon className="size-3 mr-1" />
                    {t.linkedChange}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label>{t.attachments}</Label>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input px-2 py-1 text-xs">
                <PaperclipIcon className="size-3.5" />
                {t.addFiles}
                <input type="file" className="hidden" multiple accept={FILE_ACCEPT} onChange={onFilesSelected} />
              </label>
            </div>

            {files.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t.noFiles}</p>
            ) : (
              <div className="space-y-1">
                {files.map((file, index) => (
                  <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs">
                    <span className="truncate">{file.name}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)}>
                      <XIcon className="size-3.5" />
                      {t.removeFile}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {submitting ? t.creating : t.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
