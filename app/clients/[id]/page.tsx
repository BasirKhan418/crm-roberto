'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { PencilIcon, PlusIcon, Trash2Icon, FileTextIcon, EyeIcon, SearchIcon, SendIcon } from 'lucide-react';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import SendQuoteModal from '@/components/quotes/SendQuoteModal';
import QuoteStatusSummary from '@/components/quotes/QuoteStatusSummary';
import { useLocale } from '@/components/providers/locale-provider';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import type { QuoteStatus } from '@/components/ui/StatusBadge';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

interface ClientRecord {
  _id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  companyName?: string | null;
  vatNumber?: string | null;
}

interface NoteItem {
  _id: string;
  title: string;
  description: string;
  createdAt: string;
  followUpDate?: string | null;
}

interface ClientQuote {
  _id: string;
  quoteNumber: string;
  date: string;
  status: QuoteStatus;
  statusChangedAt?: string | null;
  totalIncludingTax: number;
}

interface DetailResponse {
  success: boolean;
  message?: string;
  data?: {
    client: ClientRecord;
    timeline: NoteItem[];
  };
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = {
    en: {
      loadFailed: 'Failed to load client details',
      updateFailed: 'Failed to update client',
      updated: 'Client updated',
      deleteFailed: 'Failed to delete client',
      deleted: 'Client deleted',
      noteValidation: 'Title and description are required',
      noteDateRequired: 'Follow-up date is required',
      noteAddFailed: 'Failed to add note',
      noteAdded: 'Note added',
      noteUpdateFailed: 'Failed to update note',
      noteUpdated: 'Note updated',
      shellTitle: 'Client detail',
      notFound: 'Client not found.',
      profileSubtitle: 'Client profile and contact details.',
      email: 'Email',
      phone: 'Phone',
      address: 'Address',
      company: 'Company',
      vat: 'VAT',
      edit: 'Edit',
      editClient: 'Edit client',
      editClientDesc: 'Update core profile fields.',
      name: 'Name',
      vatTax: 'VAT/Tax ID',
      cancel: 'Cancel',
      saving: 'Saving...',
      saveChanges: 'Save changes',
      delete: 'Delete',
      deleteTitle: 'Delete client?',
      deleteDesc: 'This will permanently delete this client and linked notes.',
      deleting: 'Deleting...',
      deleteClient: 'Delete client',
      addNote: 'Add note',
      addNoteTitle: 'Add note',
      addNoteDesc: 'This note is automatically linked to this client.',
      title: 'Title',
      description: 'Description',
      followUpDate: 'Follow-up date',
      saveNote: 'Save note',
      editNote: 'Edit note',
      editNoteDesc: 'Update this client note.',
      timeline: 'Interaction timeline',
      timelineDesc: 'Newest notes first so context is always visible.',
      timelineEmpty: 'No notes yet. Add your first note from this profile.',
      followUp: 'Follow-up',
      quotesTitle: 'Related quotes',
      quotesDesc: 'All quotes linked to this client.',
      quotesEmpty: 'No quotes found for this client.',
      quotesSearch: 'Search by quote number...',
      quotesAll: 'All',
      quotesDraft: 'Draft',
      quotesSent: 'Sent',
      quotesAccepted: 'Accepted',
      quotesRefused: 'Refused',
      colQuoteNo: 'Quote #',
      colDate: 'Date',
      colTotal: 'Total TTC',
      colStatus: 'Status',
      colActions: 'Actions',
      viewQuote: 'View',
      sendQuote: 'Send',
    },
    fr: {
      loadFailed: 'Impossible de charger les details du client',
      updateFailed: 'Impossible de mettre a jour le client',
      updated: 'Client mis a jour',
      deleteFailed: 'Impossible de supprimer le client',
      deleted: 'Client supprime',
      noteValidation: 'Le titre et la description sont requis',
      noteDateRequired: 'La date de suivi est requise',
      noteAddFailed: 'Impossible d\'ajouter la note',
      noteAdded: 'Note ajoutee',
      noteUpdateFailed: 'Impossible de mettre a jour la note',
      noteUpdated: 'Note mise a jour',
      shellTitle: 'Detail client',
      notFound: 'Client introuvable.',
      profileSubtitle: 'Profil client et coordonnees.',
      email: 'E-mail',
      phone: 'Telephone',
      address: 'Adresse',
      company: 'Entreprise',
      vat: 'TVA',
      edit: 'Modifier',
      editClient: 'Modifier le client',
      editClientDesc: 'Mettez a jour les champs principaux du profil.',
      name: 'Nom',
      vatTax: 'TVA/ID fiscal',
      cancel: 'Annuler',
      saving: 'Enregistrement...',
      saveChanges: 'Enregistrer les modifications',
      delete: 'Supprimer',
      deleteTitle: 'Supprimer le client ?',
      deleteDesc: 'Cette action supprimera definitivement ce client et ses notes liees.',
      deleting: 'Suppression...',
      deleteClient: 'Supprimer le client',
      addNote: 'Ajouter une note',
      addNoteTitle: 'Ajouter une note',
      addNoteDesc: 'Cette note est automatiquement liee a ce client.',
      title: 'Titre',
      description: 'Description',
      followUpDate: 'Date de suivi',
      saveNote: 'Enregistrer la note',
      editNote: 'Modifier la note',
      editNoteDesc: 'Mettez a jour cette note client.',
      timeline: 'Chronologie des interactions',
      timelineDesc: 'Les notes les plus recentes en premier pour garder le contexte visible.',
      timelineEmpty: 'Aucune note. Ajoutez votre premiere note depuis ce profil.',
      followUp: 'Suivi',
      quotesTitle: 'Devis associes',
      quotesDesc: 'Tous les devis lies a ce client.',
      quotesEmpty: 'Aucun devis trouve pour ce client.',
      quotesSearch: 'Rechercher par numero de devis...',
      quotesAll: 'Tous',
      quotesDraft: 'Brouillon',
      quotesSent: 'Envoye',
      quotesAccepted: 'Accepte',
      quotesRefused: 'Refuse',
      colQuoteNo: 'Devis N',
      colDate: 'Date',
      colTotal: 'Total TTC',
      colStatus: 'Statut',
      colActions: 'Actions',
      viewQuote: 'Voir',
      sendQuote: 'Envoyer',
    },
  }[locale];

  const [clientId, setClientId] = useState('');
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [timeline, setTimeline] = useState<NoteItem[]>([]);
  const [quotes, setQuotes] = useState<ClientQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isNoteEditOpen, setIsNoteEditOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [isNoteUpdating, setIsNoteUpdating] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<ClientQuote | null>(null);

  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    companyName: '',
    vatNumber: '',
  });

  const [noteForm, setNoteForm] = useState({ title: '', description: '', followUpDate: '' });
  const [editNoteForm, setEditNoteForm] = useState({ title: '', description: '', followUpDate: '' });

  useEffect(() => {
    params.then((resolved) => setClientId(resolved.id));
  }, [params]);

  const endpoint = useMemo(() => (clientId ? `/api/clients/${clientId}` : ''), [clientId]);

  const loadDetails = useCallback(async () => {
    if (!endpoint) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      const data = (await response.json()) as DetailResponse;

      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.message || t.loadFailed);
      }

      setClient(data.data.client);
      setTimeline(data.data.timeline);
      setEditForm({
        fullName: data.data.client.fullName || '',
        email: data.data.client.email || '',
        phone: data.data.client.phone || '',
        address: data.data.client.address || '',
        companyName: data.data.client.companyName || '',
        vatNumber: data.data.client.vatNumber || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
      setClient(null);
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, t.loadFailed]);

  const loadQuotes = useCallback(async () => {
    if (!clientId) return;
    setQuotesLoading(true);
    try {
      const res = await fetch(`/api/quotes?clientId=${clientId}&limit=100`, { cache: 'no-store' });
      const data = (await res.json()) as { success?: boolean; data?: ClientQuote[] };
      setQuotes(data.data ?? []);
    } catch {
      setQuotes([]);
    } finally {
      setQuotesLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  async function saveClient() {
    if (!client) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/clients/${client._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || t.updateFailed);
      }

      toast.success(t.updated);
      setIsEditOpen(false);
      await loadDetails();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.updateFailed);
    } finally {
      setIsSaving(false);
    }
  }

  async function removeClient() {
    if (!client) {
      return;
    }

    setIsDeletingClient(true);
    try {
      const response = await fetch(`/api/clients/${client._id}`, { method: 'DELETE' });
      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || t.deleteFailed);
      }
      toast.success(t.deleted);
      router.push('/clients');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.deleteFailed);
    } finally {
      setIsDeletingClient(false);
      setIsDeleteConfirmOpen(false);
    }
  }

  async function addNote() {
    if (!client) {
      return;
    }
    if (!noteForm.title.trim() || !noteForm.description.trim()) {
      toast.error(t.noteValidation);
      return;
    }
    if (!noteForm.followUpDate) {
      toast.error(t.noteDateRequired);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/clients/${client._id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noteForm.title,
          description: noteForm.description,
          followUpDate: noteForm.followUpDate,
        }),
      });
      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || t.noteAddFailed);
      }

      toast.success(t.noteAdded);
      setIsNoteOpen(false);
      setNoteForm({ title: '', description: '', followUpDate: '' });
      await loadDetails();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.noteAddFailed);
    } finally {
      setIsSaving(false);
    }
  }

  function openNoteEdit(note: NoteItem) {
    setEditingNoteId(note._id);
    setEditNoteForm({
      title: note.title,
      description: note.description,
      followUpDate: note.followUpDate ? String(note.followUpDate).slice(0, 10) : '',
    });
    setIsNoteEditOpen(true);
  }

  async function updateNote() {
    if (!editingNoteId) {
      return;
    }
    if (!editNoteForm.title.trim() || !editNoteForm.description.trim()) {
      toast.error(t.noteValidation);
      return;
    }
    if (!editNoteForm.followUpDate) {
      toast.error(t.noteDateRequired);
      return;
    }

    setIsNoteUpdating(true);
    try {
      const response = await fetch(`/api/notes/${editingNoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editNoteForm.title,
          description: editNoteForm.description,
          followUpDate: editNoteForm.followUpDate,
        }),
      });
      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || t.noteUpdateFailed);
      }

      toast.success(t.noteUpdated);
      setIsNoteEditOpen(false);
      setEditingNoteId(null);
      await loadDetails();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.noteUpdateFailed);
    } finally {
      setIsNoteUpdating(false);
    }
  }

  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const matchesStatus = quoteStatusFilter === 'all' || q.status === quoteStatusFilter;
      const matchesSearch = quoteSearch.trim() === '' || q.quoteNumber.toLowerCase().includes(quoteSearch.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [quotes, quoteStatusFilter, quoteSearch]);

  return (
    <>
    <CrmShell title={t.shellTitle}>
      {error ? <ErrorMessage message={error} /> : null}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : !client ? (
        <EmptyState message={t.notFound} />
      ) : (
        <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-base font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {client.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <CardTitle className="text-xl">{client.fullName}</CardTitle>
                  <p className="text-sm text-muted-foreground">{t.profileSubtitle}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-4 text-sm">
              <p><span className="text-muted-foreground">{t.email}:</span> {client.email || '-'}</p>
              <p><span className="text-muted-foreground">{t.phone}:</span> {client.phone || '-'}</p>
              <p><span className="text-muted-foreground">{t.address}:</span> {client.address || '-'}</p>
              <p><span className="text-muted-foreground">{t.company}:</span> {client.companyName || '-'}</p>
              <p><span className="text-muted-foreground">{t.vat}:</span> {client.vatNumber || '-'}</p>

              <div className="flex flex-wrap gap-2 pt-3">
                <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      <PencilIcon />
                      {t.edit}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-lg">
                    <SheetHeader>
                      <SheetTitle>{t.editClient}</SheetTitle>
                      <SheetDescription>{t.editClientDesc}</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-3 px-4">
                      <div className="space-y-1.5"><Label>{t.name}</Label><Input value={editForm.fullName} onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))} /></div>
                      <div className="space-y-1.5"><Label>{t.email}</Label><Input value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} /></div>
                      <div className="space-y-1.5"><Label>{t.phone}</Label><Input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} /></div>
                      <div className="space-y-1.5"><Label>{t.address}</Label><Input value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} /></div>
                      <div className="space-y-1.5"><Label>{t.company}</Label><Input value={editForm.companyName} onChange={(e) => setEditForm((p) => ({ ...p, companyName: e.target.value }))} /></div>
                      <div className="space-y-1.5"><Label>{t.vatTax}</Label><Input value={editForm.vatNumber} onChange={(e) => setEditForm((p) => ({ ...p, vatNumber: e.target.value }))} /></div>
                    </div>
                    <SheetFooter>
                      <Button variant="outline" onClick={() => setIsEditOpen(false)}>{t.cancel}</Button>
                      <Button onClick={saveClient} disabled={isSaving}>{isSaving ? t.saving : t.saveChanges}</Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>

                <Button variant="destructive" size="sm" onClick={() => setIsDeleteConfirmOpen(true)}>
                  <Trash2Icon />
                  {t.delete}
                </Button>

                <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t.deleteDesc}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel asChild>
                        <Button variant="outline">{t.cancel}</Button>
                      </AlertDialogCancel>
                      <AlertDialogAction
                        asChild
                        onClick={(event) => {
                          event.preventDefault();
                          if (isDeletingClient) {
                            return;
                          }
                          void removeClient();
                        }}
                      >
                        <Button variant="destructive" disabled={isDeletingClient}>
                          {isDeletingClient ? t.deleting : t.deleteClient}
                        </Button>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Sheet open={isNoteOpen} onOpenChange={setIsNoteOpen}>
                  <SheetTrigger asChild>
                    <Button size="sm">
                      <PlusIcon />
                      {t.addNote}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-lg">
                    <SheetHeader>
                      <SheetTitle>{t.addNoteTitle}</SheetTitle>
                      <SheetDescription>{t.addNoteDesc}</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-3 px-4">
                      <div className="space-y-1.5"><Label>{t.title}</Label><Input value={noteForm.title} onChange={(e) => setNoteForm((p) => ({ ...p, title: e.target.value }))} /></div>
                      <div className="space-y-1.5">
                        <Label>{t.description}</Label>
                        <textarea
                          className="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          value={noteForm.description}
                          onChange={(e) => setNoteForm((p) => ({ ...p, description: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5"><Label>{t.followUpDate}</Label><Input type="date" value={noteForm.followUpDate} onChange={(e) => setNoteForm((p) => ({ ...p, followUpDate: e.target.value }))} /></div>
                    </div>
                    <SheetFooter>
                      <Button variant="outline" onClick={() => setIsNoteOpen(false)}>{t.cancel}</Button>
                      <Button onClick={addNote} disabled={isSaving}>{isSaving ? t.saving : t.saveNote}</Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>

                <Sheet
                  open={isNoteEditOpen}
                  onOpenChange={(open) => {
                    setIsNoteEditOpen(open);
                    if (!open) {
                      setEditingNoteId(null);
                    }
                  }}
                >
                  <SheetContent side="right" className="w-full sm:max-w-lg">
                    <SheetHeader>
                      <SheetTitle>{t.editNote}</SheetTitle>
                      <SheetDescription>{t.editNoteDesc}</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-3 px-4">
                      <div className="space-y-1.5"><Label>{t.title}</Label><Input value={editNoteForm.title} onChange={(e) => setEditNoteForm((p) => ({ ...p, title: e.target.value }))} /></div>
                      <div className="space-y-1.5">
                        <Label>{t.description}</Label>
                        <textarea
                          className="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          value={editNoteForm.description}
                          onChange={(e) => setEditNoteForm((p) => ({ ...p, description: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5"><Label>{t.followUpDate}</Label><Input type="date" value={editNoteForm.followUpDate} onChange={(e) => setEditNoteForm((p) => ({ ...p, followUpDate: e.target.value }))} /></div>
                    </div>
                    <SheetFooter>
                      <Button variant="outline" onClick={() => setIsNoteEditOpen(false)}>{t.cancel}</Button>
                      <Button onClick={updateNote} disabled={isNoteUpdating}>{isNoteUpdating ? t.saving : t.saveChanges}</Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>{t.timeline}</CardTitle>
              <p className="text-sm text-muted-foreground">{t.timelineDesc}</p>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {timeline.length === 0 ? (
                <EmptyState message={t.timelineEmpty} />
              ) : (
                timeline.map((note) => (
                  <div key={note._id} className="rounded-lg border border-l-4 border-border/70 border-l-emerald-400 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{note.title}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString('en-US')}</span>
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => openNoteEdit(note)}>
                          <PencilIcon />
                        </Button>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{note.description}</p>
                    {note.followUpDate ? (
                      <p className="mt-2 text-xs text-sky-600 dark:text-sky-400">{t.followUp}: {new Date(note.followUpDate).toLocaleDateString('en-US')}</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="inline-flex items-center gap-2">
                  <FileTextIcon className="size-4 text-muted-foreground" />
                  {t.quotesTitle}
                </CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">{t.quotesDesc}</p>
              </div>
              <Button size="sm" asChild>
                <Link href="/quotes/new">{t.viewQuote}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {/* Filters */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t.quotesSearch}
                  value={quoteSearch}
                  onChange={(e) => setQuoteSearch(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'draft', 'sent', 'accepted', 'refused'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setQuoteStatusFilter(s)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      quoteStatusFilter === s
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {s === 'all' ? t.quotesAll : s === 'draft' ? t.quotesDraft : s === 'sent' ? t.quotesSent : s === 'accepted' ? t.quotesAccepted : t.quotesRefused}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            {quotesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2 rounded-xl border border-border/70 p-3">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-8 w-full animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : filteredQuotes.length === 0 ? (
              <EmptyState message={t.quotesEmpty} />
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {filteredQuotes.map((q) => (
                    <article key={q._id} className="space-y-2.5 rounded-xl border border-border/70 bg-card/80 p-3.5 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-(--color-text-info)">{q.quoteNumber}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            }).format(new Date(q.date))}
                          </p>
                        </div>
                        <QuoteStatusSummary status={q.status} statusChangedAt={q.statusChangedAt} locale={locale as 'en' | 'fr'} className="items-end text-right" />
                      </div>

                      <div className="rounded-lg border border-border/60 bg-background px-2.5 py-2 text-xs">
                        <p className="text-muted-foreground">{t.colTotal}</p>
                        <p className="mt-0.5 text-sm font-semibold">
                          <PriceDisplay cents={q.totalIncludingTax} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} />
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" className={`h-9 ${q.status !== 'draft' ? 'col-span-2' : ''}`} asChild>
                          <Link href={`/quotes/${q._id}`}>
                            <EyeIcon className="size-3.5" />
                            {t.viewQuote}
                          </Link>
                        </Button>

                        {q.status === 'draft' ? (
                          <Button type="button" size="sm" className="h-9" onClick={() => setSendTarget(q)}>
                            <SendIcon className="size-3.5" />
                            {t.sendQuote}
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto rounded-lg border border-border/70 md:block">
                  <table className="min-w-full text-sm">
                    <thead className="bg-secondary/40 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">{t.colQuoteNo}</th>
                        <th className="px-3 py-2 text-left font-medium">{t.colDate}</th>
                        <th className="px-3 py-2 text-right font-medium">{t.colTotal}</th>
                        <th className="px-3 py-2 text-left font-medium">{t.colStatus}</th>
                        <th className="px-3 py-2 text-right font-medium">{t.colActions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuotes.map((q, index) => (
                        <tr key={q._id} className={`border-t border-border/60 ${index % 2 === 1 ? 'bg-secondary/10' : 'bg-background'}`}>
                          <td className="px-3 py-2 font-semibold">{q.quoteNumber}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                            {new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            }).format(new Date(q.date))}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            <PriceDisplay cents={q.totalIncludingTax} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} />
                          </td>
                          <td className="px-3 py-2">
                            <QuoteStatusSummary status={q.status} statusChangedAt={q.statusChangedAt} locale={locale as 'en' | 'fr'} />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/quotes/${q._id}`}>
                                  <EyeIcon className="size-3.5" />
                                  {t.viewQuote}
                                </Link>
                              </Button>

                              {q.status === 'draft' ? (
                                <Button type="button" variant="outline" size="sm" onClick={() => setSendTarget(q)}>
                                  <SendIcon className="size-3.5" />
                                  {t.sendQuote}
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        </div>
      )}
    </CrmShell>

    {sendTarget ? (
      <SendQuoteModal
        open={Boolean(sendTarget)}
        onOpenChange={(next) => (!next ? setSendTarget(null) : undefined)}
        quoteId={sendTarget!._id}
        quoteNumber={sendTarget!.quoteNumber}
        clientEmail={client?.email}
        clientName={client?.fullName}
        companyName={undefined}
        locale={locale as 'en' | 'fr'}
        quoteStatus={sendTarget.status}
        onSent={() => {
          void loadQuotes();
        }}
      />
    ) : null}
    </>
  );
}
