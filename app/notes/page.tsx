'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AlertTriangleIcon, CheckCircle2, ClockIcon, Loader2, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import { resolveTranslatedError, translate } from '@/lib/i18n/messages';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

interface LinkedEntity {
  _id: string;
  fullName: string;
}

interface Note {
  _id: string;
  title: string;
  description: string;
  linkedType: 'client' | 'supplier';
  linkedId: LinkedEntity;
  followUpDate?: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function NotesPage() {
  const { locale } = useLocale();
  const t = {
    en: {
      fetchFailed: 'Failed to fetch notes',
      validationRequired: 'Title, description, and linked record are required',
      dateRequired: 'Follow-up date is required',
      createFailed: 'Failed to create note',
      created: 'Note created',
      deleteFailed: 'Failed to delete note',
      deleted: 'Note deleted',
      updateFailed: 'Failed to update note',
      updated: 'Note updated',
      shellTitle: 'Notes',
      heading: 'Notes',
      subtitle: 'Search all notes and keep business memory centralized.',
      addNote: 'Add note',
      createNote: 'Create note',
      createDesc: 'Add note from global view and link it to client or supplier.',
      editNote: 'Edit note',
      editDesc: 'Update note details and linked record.',
      title: 'Title',
      description: 'Description',
      linkedType: 'Linked type',
      client: 'Client',
      supplier: 'Supplier',
      linkedRecord: 'Linked record',
      select: 'Select',
      followUpDate: 'Follow-up date',
      cancel: 'Cancel',
      saving: 'Saving...',
      saveNote: 'Save note',
      saveChanges: 'Save changes',
      deleteTitle: 'Delete note?',
      deleteDesc: 'This action cannot be undone. The note will be permanently removed.',
      deleting: 'Deleting...',
      deleteNote: 'Delete note',
      allNotes: 'All notes',
      searchPlaceholder: 'Search by title or description...',
      all: 'All',
      clientsOnly: 'Clients only',
      suppliersOnly: 'Suppliers only',
      empty: 'No notes found. Start by adding your first business note.',
      followUp: 'Follow-up',
      page: 'Page',
      of: 'of',
      total: 'total',
      previous: 'Previous',
      next: 'Next',
    },
    fr: {
      fetchFailed: 'Impossible de récupérer les notes',
      validationRequired: "Le titre, la description et l'élément lié sont requis",
      dateRequired: 'La date de suivi est requise',
      createFailed: 'Impossible de créer la note',
      created: 'Note créée',
      deleteFailed: 'Impossible de supprimer la note',
      deleted: 'Note supprimée',
      updateFailed: 'Impossible de mettre à jour la note',
      updated: 'Note mise à jour',
      shellTitle: 'Notes',
      heading: 'Notes',
      subtitle: 'Recherchez toutes les notes et centralisez la mémoire métier.',
      addNote: 'Ajouter une note',
      createNote: 'Créer une note',
      createDesc: "Ajoutez une note depuis la vue globale et liez-la à un client ou fournisseur.",
      editNote: 'Modifier la note',
      editDesc: "Mettez à jour les détails de la note et l'élément lié.",
      title: 'Titre',
      description: 'Description',
      linkedType: 'Type lié',
      client: 'Client',
      supplier: 'Fournisseur',
      linkedRecord: 'Élément lié',
      select: 'Sélectionner',
      followUpDate: 'Date de suivi',
      cancel: 'Annuler',
      saving: 'Enregistrement...',
      saveNote: 'Enregistrer la note',
      saveChanges: 'Enregistrer les modifications',
      deleteTitle: 'Supprimer la note ?',
      deleteDesc: 'Cette action est irréversible. La note sera supprimée définitivement.',
      deleting: 'Suppression...',
      deleteNote: 'Supprimer la note',
      allNotes: 'Toutes les notes',
      searchPlaceholder: 'Rechercher par titre ou description...',
      all: 'Tout',
      clientsOnly: 'Clients seulement',
      suppliersOnly: 'Fournisseurs seulement',
      empty: 'Aucune note trouvée. Commencez par ajouter votre première note.',
      followUp: 'Suivi',
      page: 'Page',
      of: 'sur',
      total: 'au total',
      previous: 'Précédent',
      next: 'Suivant',
    },
  }[locale];

  const [notes, setNotes] = useState<Note[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'client' | 'supplier'>('all');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [markingFollowUpId, setMarkingFollowUpId] = useState<string | null>(null);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    [locale],
  );

  const today = useMemo(() => new Date(), []);

  const overdueNotes = useMemo(
    () => notes.filter((n) => n.followUpDate && new Date(n.followUpDate) < today),
    [notes, today],
  );

  const [clients, setClients] = useState<LinkedEntity[]>([]);
  const [suppliers, setSuppliers] = useState<LinkedEntity[]>([]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    linkedType: 'client' as 'client' | 'supplier',
    linkedId: '',
    followUpDate: '',
  });

  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    linkedType: 'client' as 'client' | 'supplier',
    linkedId: '',
    followUpDate: '',
  });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(pagination.page));
    params.set('limit', String(pagination.limit));
    params.set('sortBy', 'createdAt');
    params.set('sortOrder', 'desc');
    if (search) {
      params.set('search', search);
    }
    if (filter !== 'all') {
      params.set('linkedType', filter);
    }
    return params.toString();
  }, [pagination.page, pagination.limit, search, filter]);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/notes?${query}`, { cache: 'no-store' });
      const data = (await response.json()) as {
        success: boolean;
        message?: string;
        data?: Note[];
        pagination?: Pagination;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.message || t.fetchFailed);
      }

      setNotes(data.data ?? []);
      setPagination((prev) => data.pagination ?? prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.fetchFailed);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [query, t.fetchFailed]);

  const loadLinkedOptions = useCallback(async () => {
    try {
      const [clientsRes, suppliersRes] = await Promise.all([
        fetch('/api/clients?page=1&limit=100&sortBy=fullName&sortOrder=asc', { cache: 'no-store' }),
        fetch('/api/suppliers?page=1&limit=100&sortBy=fullName&sortOrder=asc', { cache: 'no-store' }),
      ]);

      const [clientsJson, suppliersJson] = await Promise.all([clientsRes.json(), suppliersRes.json()]);
      setClients((clientsJson?.data ?? []) as LinkedEntity[]);
      setSuppliers((suppliersJson?.data ?? []) as LinkedEntity[]);
    } catch {
      setClients([]);
      setSuppliers([]);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    loadLinkedOptions();
  }, [loadLinkedOptions]);

  useEffect(() => {
    const options = form.linkedType === 'client' ? clients : suppliers;
    if (options.length > 0 && !options.some((item) => item._id === form.linkedId)) {
      setForm((prev) => ({ ...prev, linkedId: options[0]._id }));
    }
  }, [form.linkedType, form.linkedId, clients, suppliers]);

  useEffect(() => {
    if (!isEditOpen) {
      return;
    }

    const options = editForm.linkedType === 'client' ? clients : suppliers;
    if (options.length > 0 && !options.some((item) => item._id === editForm.linkedId)) {
      setEditForm((prev) => ({ ...prev, linkedId: options[0]._id }));
    }
  }, [isEditOpen, editForm.linkedType, editForm.linkedId, clients, suppliers]);

  async function createNote() {
    if (!form.title.trim() || !form.description.trim() || !form.linkedId) {
      toast.error(t.validationRequired);
      return;
    }
    if (!form.followUpDate) {
      toast.error(t.dateRequired);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          linkedType: form.linkedType,
          linkedId: form.linkedId,
          followUpDate: form.followUpDate,
        }),
      });
      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || t.createFailed);
      }

      toast.success(t.created);
      setIsAddOpen(false);
      setForm({ title: '', description: '', linkedType: 'client', linkedId: '', followUpDate: '' });
      setPagination((prev) => ({ ...prev, page: 1 }));
      await loadNotes();
    } catch (err) {
      toast.error(resolveTranslatedError(locale, err, t.createFailed));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    setDeletingNoteId(noteId);
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
      });

      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete note');
      }

      setNotes((prev) => prev.filter((note) => note._id !== noteId));
      setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      toast.success(t.deleted);
      setIsDeleteConfirmOpen(false);
      setDeleteTargetId(null);
      await loadNotes();
    } catch (err) {
      toast.error(resolveTranslatedError(locale, err, t.deleteFailed));
    } finally {
      setDeletingNoteId(null);
    }
  }

  async function markFollowUpDone(noteId: string) {
    setMarkingFollowUpId(noteId);
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpDate: null }),
      });
      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) throw new Error(data.message);
      setNotes((prev) => prev.map((n) => n._id === noteId ? { ...n, followUpDate: null } : n));
      toast.success(translate(locale, 'notes.followUpDone'));
    } catch (err) {
      toast.error(resolveTranslatedError(locale, err, translate(locale, 'notes.clearFollowUpFailed')));
    } finally {
      setMarkingFollowUpId(null);
    }
  }

  function openEditNote(note: Note) {
    setEditingNoteId(note._id);
    setEditForm({
      title: note.title,
      description: note.description,
      linkedType: note.linkedType,
      linkedId: note.linkedId?._id || '',
      followUpDate: note.followUpDate ? String(note.followUpDate).slice(0, 10) : '',
    });
    setIsEditOpen(true);
  }

  async function updateNote() {
    if (!editingNoteId) {
      return;
    }
    if (!editForm.title.trim() || !editForm.description.trim() || !editForm.linkedId) {
      toast.error(t.validationRequired);
      return;
    }
    if (!editForm.followUpDate) {
      toast.error(t.dateRequired);
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/notes/${editingNoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          linkedType: editForm.linkedType,
          linkedId: editForm.linkedId,
          followUpDate: editForm.followUpDate,
        }),
      });

      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || t.updateFailed);
      }

      toast.success(t.updated);
      setIsEditOpen(false);
      setEditingNoteId(null);
      await loadNotes();
    } catch (err) {
      toast.error(resolveTranslatedError(locale, err, t.updateFailed));
    } finally {
      setIsUpdating(false);
    }
  }

  const linkedOptions = form.linkedType === 'client' ? clients : suppliers;
  const editLinkedOptions = editForm.linkedType === 'client' ? clients : suppliers;

  return (
    <CrmShell title={t.shellTitle}>
      <div data-tour-notes-header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.heading}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
          <SheetTrigger asChild>
            <Button data-tour-notes-add className='h-10 w-full sm:w-auto'>
              <PlusIcon />
              {t.addNote}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full p-0 sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>{t.createNote}</SheetTitle>
              <SheetDescription>{t.createDesc}</SheetDescription>
            </SheetHeader>

            <div className="max-h-[calc(100svh-10rem)] space-y-3 overflow-y-auto px-4 pb-4 sm:px-6">
              <div className="space-y-1.5">
                <Label>{t.title}</Label>
                <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
              </div>

              <div className="space-y-1.5">
                <Label>{t.description}</Label>
                <textarea
                  className="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t.linkedType}</Label>
                  <Select
                    value={form.linkedType}
                    onValueChange={(value: 'client' | 'supplier') =>
                      setForm((p) => ({ ...p, linkedType: value, linkedId: '' }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">{t.client}</SelectItem>
                      <SelectItem value="supplier">{t.supplier}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t.linkedRecord}</Label>
                  <Select value={form.linkedId} onValueChange={(value) => setForm((p) => ({ ...p, linkedId: value }))}>
                    <SelectTrigger><SelectValue placeholder={t.select} /></SelectTrigger>
                    <SelectContent>
                      {linkedOptions.map((item) => (
                        <SelectItem key={item._id} value={item._id}>{item.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t.followUpDate}</Label>
                <Input type="date" value={form.followUpDate} onChange={(e) => setForm((p) => ({ ...p, followUpDate: e.target.value }))} />
              </div>
            </div>

            <SheetFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>{t.cancel}</Button>
              <Button onClick={createNote} disabled={isSaving}>{isSaving ? t.saving : t.saveNote}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Sheet
          open={isEditOpen}
          onOpenChange={(open) => {
            setIsEditOpen(open);
            if (!open) {
              setEditingNoteId(null);
            }
          }}
        >
          <SheetContent side="right" className="w-full p-0 sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>{t.editNote}</SheetTitle>
              <SheetDescription>{t.editDesc}</SheetDescription>
            </SheetHeader>

            <div className="max-h-[calc(100svh-10rem)] space-y-3 overflow-y-auto px-4 pb-4 sm:px-6">
              <div className="space-y-1.5">
                <Label>{t.title}</Label>
                <Input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} />
              </div>

              <div className="space-y-1.5">
                <Label>{t.description}</Label>
                <textarea
                  className="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t.linkedType}</Label>
                  <Select
                    value={editForm.linkedType}
                    onValueChange={(value: 'client' | 'supplier') =>
                      setEditForm((p) => ({ ...p, linkedType: value, linkedId: '' }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">{t.client}</SelectItem>
                      <SelectItem value="supplier">{t.supplier}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t.linkedRecord}</Label>
                  <Select value={editForm.linkedId} onValueChange={(value) => setEditForm((p) => ({ ...p, linkedId: value }))}>
                    <SelectTrigger><SelectValue placeholder={t.select} /></SelectTrigger>
                    <SelectContent>
                      {editLinkedOptions.map((item) => (
                        <SelectItem key={item._id} value={item._id}>{item.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t.followUpDate}</Label>
                <Input
                  type="date"
                  value={editForm.followUpDate}
                  onChange={(e) => setEditForm((p) => ({ ...p, followUpDate: e.target.value }))}
                />
              </div>
            </div>

            <SheetFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>{t.cancel}</Button>
              <Button onClick={updateNote} disabled={isUpdating}>{isUpdating ? t.saving : t.saveChanges}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

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
                  if (!deleteTargetId || deletingNoteId === deleteTargetId) {
                    return;
                  }
                  void deleteNote(deleteTargetId);
                }}
              >
                <Button variant="destructive" disabled={!deleteTargetId || deletingNoteId === deleteTargetId}>
                  {deletingNoteId === deleteTargetId ? t.deleting : t.deleteNote}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {overdueNotes.length > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/20">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              {overdueNotes.length}{' '}
              {locale === 'fr'
                ? `suivi(s) en retard`
                : `overdue follow-up${overdueNotes.length > 1 ? 's' : ''}`}
            </p>
            <p className="mt-0.5 text-xs text-red-600/80 dark:text-red-400/70">
              {overdueNotes.slice(0, 3).map((n) => n.title).join(' · ')}
              {overdueNotes.length > 3 ? ` +${overdueNotes.length - 3}` : ''}
            </p>
          </div>
        </div>
      ) : null}

      <Card data-tour-notes-panel>
        <CardHeader className="border-b">
          <CardTitle className="text-base">{t.allNotes}</CardTitle>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                data-tour-notes-search
                className="pl-8"
                placeholder={t.searchPlaceholder}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setPagination((prev) => ({ ...prev, page: 1 }));
                    setSearch(searchInput.trim());
                  }
                }}
              />
            </div>
            <Select value={filter} onValueChange={(v: 'all' | 'client' | 'supplier') => { setFilter(v); setPagination((p) => ({ ...p, page: 1 })); }}>
              <SelectTrigger data-tour-notes-filter className="w-full sm:w-45"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.all}</SelectItem>
                <SelectItem value="client">{t.clientsOnly}</SelectItem>
                <SelectItem value="supplier">{t.suppliersOnly}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-4">
          {error ? <ErrorMessage message={error} /> : null}

          {loading ? (
            <div data-tour-notes-list className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 5 }).map((_, idx) => <Skeleton key={idx} className="h-28 w-full" />)}
            </div>
          ) : notes.length === 0 ? (
            <EmptyState message={t.empty} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {notes.map((note) => (
              <div key={note._id} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${note.linkedType === 'client' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <h3 className="text-sm font-semibold leading-snug">{note.title}</h3>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-xs text-muted-foreground">{dateFormatter.format(new Date(note.createdAt))}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEditNote(note)}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      onClick={() => {
                        setDeleteTargetId(note._id);
                        setIsDeleteConfirmOpen(true);
                      }}
                      disabled={deletingNoteId === note._id}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{note.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Link
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted/80"
                    href={`/${note.linkedType === 'client' ? 'clients' : 'suppliers'}/${note.linkedId?._id}`}
                  >
                    {note.linkedType === 'client' ? t.client : t.supplier} · {note.linkedId?.fullName}
                  </Link>
                  {note.followUpDate ? (
                    <>
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                        new Date(note.followUpDate) < today
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                      }`}>
                        {new Date(note.followUpDate) < today
                          ? <AlertTriangleIcon className="size-3" />
                          : <ClockIcon className="size-3" />}
                        {t.followUp}: {dateFormatter.format(new Date(note.followUpDate))}
                      </span>
                      <button
                        type="button"
                        disabled={markingFollowUpId === note._id}
                        onClick={() => markFollowUpDone(note._id)}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:justify-start dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50">
                        {markingFollowUpId === note._id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-3" strokeWidth={2.5} />
                        )}
                        {markingFollowUpId === note._id
                          ? (locale === 'fr' ? 'Enregistrement...' : 'Saving...')
                          : (locale === 'fr' ? 'Suivi terminé' : 'Mark done')}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {t.page} {pagination.page} {t.of} {Math.max(pagination.totalPages, 1)} - {pagination.total} {t.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              >
                {t.previous}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.totalPages === 0 || pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                {t.next}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </CrmShell>
  );
}
