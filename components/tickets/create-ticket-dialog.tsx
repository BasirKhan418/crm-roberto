'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';

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
import {
  createTicket,
  uploadTicketFiles,
  useTicketRecipients,
} from '@/hooks/useTickets';

const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.heic';

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

  const { users, loading: recipientsLoading, error: recipientsError, refetch: refetchRecipients } =
    useTicketRecipients(recipientSearch.trim() || undefined, 40);

  const t = useMemo(
    () =>
      locale === 'fr'
        ? {
            title: 'Creer un ticket',
            description: 'Discutez un sujet interne et assignez les bons destinataires.',
            ticketTitle: 'Titre',
            ticketType: 'Type',
            message: 'Message',
            recipients: 'Destinataires',
            recipientsSearch: 'Rechercher un collaborateur...',
            recipientsEmpty: 'Aucun utilisateur trouve.',
            linkedSection: 'Lien optionnel',
            linkedType: 'Type de lien',
            linkedId: 'ID de la ressource',
            linkedHint: 'Expense, invoice, supplier ou client ID.',
            linkedPrefill: 'Lien pre-rempli',
            attachments: 'Pieces jointes',
            addFiles: 'Ajouter des fichiers',
            noFiles: 'Aucun fichier ajoute.',
            removeFile: 'Retirer',
            cancel: 'Annuler',
            create: 'Creer le ticket',
            creating: 'Creation...',
            requiredTitle: 'Le titre doit contenir au moins 3 caracteres.',
            requiredBody: 'Ajoutez un message ou au moins une piece jointe.',
            created: 'Ticket cree avec succes.',
            failed: 'Impossible de creer le ticket.',
            refreshRecipients: 'Actualiser',
            types: {
              accounting: 'Comptabilite',
              validation: 'Validation',
              document: 'Document',
              dispute: 'Litige',
            },
            linkedTypes: {
              expense: 'Depense',
              invoice: 'Facture',
              supplier: 'Fournisseur',
              client: 'Client',
            },
          }
        : {
            title: 'Create Ticket',
            description: 'Start an internal thread and assign the right recipients.',
            ticketTitle: 'Title',
            ticketType: 'Type',
            message: 'Message',
            recipients: 'Recipients',
            recipientsSearch: 'Search teammate...',
            recipientsEmpty: 'No users found.',
            linkedSection: 'Optional link',
            linkedType: 'Linked type',
            linkedId: 'Linked record ID',
            linkedHint: 'Expense, invoice, supplier, or client ID.',
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
            created: 'Ticket created successfully.',
            failed: 'Failed to create ticket.',
            refreshRecipients: 'Refresh',
            types: {
              accounting: 'Accounting',
              validation: 'Validation',
              document: 'Document',
              dispute: 'Dispute',
            },
            linkedTypes: {
              expense: 'Expense',
              invoice: 'Invoice',
              supplier: 'Supplier',
              client: 'Client',
            },
          },
    [locale]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setTitle(prefill?.title?.trim() || '');
    setType('document');
    setBody(prefill?.body?.trim() || '');
    setLinkedType(prefill?.linkedType || '');
    setLinkedId(prefill?.linkedId?.trim() || '');
    setRecipientSearch('');
    setSelectedRecipientIds([]);
    setFiles([]);
    setFeedback(null);
  }, [open, prefill]);

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
      setFiles((previous) => [...previous, ...selected]);
    }
    event.target.value = '';
  }

  function removeFile(index: number) {
    setFiles((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSubmit() {
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
      setFeedback({
        type: 'error',
        message: submitError instanceof Error ? submitError.message : t.failed,
      });
    } finally {
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
                    {t.types[option]}
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
                <p className="text-xs text-muted-foreground">{t.creating}</p>
              ) : recipientsError ? (
                <p className="text-xs text-destructive">{recipientsError}</p>
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
                onChange={(event) => setLinkedType((event.target.value || '') as TicketLinkedType | '')}
              >
                <option value="">-</option>
                {TICKET_LINKED_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {t.linkedTypes[option]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t.linkedId}</Label>
              <Input value={linkedId} onChange={(event) => setLinkedId(event.target.value)} />
            </div>
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
