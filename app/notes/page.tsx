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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type NoteStatus = 'overdue' | 'today' | 'upcoming';
const TAB_PAGE_SIZE = 6;

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

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getNoteStatus(followUpDate: string | null | undefined, todayKey: string): NoteStatus | null {
  if (!followUpDate) {
    return null;
  }

  const followUpKey = getDateKey(new Date(followUpDate));
  if (followUpKey < todayKey) {
    return 'overdue';
  }
  if (followUpKey === todayKey) {
    return 'today';
  }
  return 'upcoming';
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
      taskBoard: 'Task board',
      searchPlaceholder: 'Search by title or description...',
      all: 'All',
      clientsOnly: 'Clients only',
      suppliersOnly: 'Suppliers only',
      empty: 'No notes found. Start by adding your first business note.',
      emptyTaskSection: 'No tasks in this section.',
      followUp: 'Follow-up',
      overdue: 'Overdue',
      today: 'Today',
      upcoming: 'Upcoming',
      statusOverdue: 'Overdue',
      statusToday: 'Today',
      statusUpcoming: 'Upcoming',
      summaryOverdue: 'Overdue tasks',
      summaryToday: 'Due today',
      summaryUpcoming: 'Upcoming tasks',
      actionableEmpty: 'No follow-up tasks on this page. Add a follow-up date to make notes actionable.',
      viewDetails: 'View details',
      seeMore: 'See more',
      taskDetails: 'Task details',
      taskDetailsDesc: 'Review full note details and take action.',
      page: 'Page',
      of: 'of',
      total: 'total',
      previous: 'Previous',
      next: 'Next',
      tabPage: 'Tab page',
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
      taskBoard: 'Tableau des tâches',
      searchPlaceholder: 'Rechercher par titre ou description...',
      all: 'Tout',
      clientsOnly: 'Clients seulement',
      suppliersOnly: 'Fournisseurs seulement',
      empty: 'Aucune note trouvée. Commencez par ajouter votre première note.',
      emptyTaskSection: 'Aucune tâche dans cette section.',
      followUp: 'Suivi',
      overdue: 'En retard',
      today: "Aujourd'hui",
      upcoming: 'À venir',
      statusOverdue: 'En retard',
      statusToday: "Aujourd'hui",
      statusUpcoming: 'À venir',
      summaryOverdue: 'Tâches en retard',
      summaryToday: "Tâches d'aujourd'hui",
      summaryUpcoming: 'Tâches à venir',
      actionableEmpty: 'Aucune tâche de suivi sur cette page. Ajoutez une date de suivi pour rendre la note actionnable.',
      viewDetails: 'Voir détails',
      seeMore: 'Voir plus',
      taskDetails: 'Détails de la tâche',
      taskDetailsDesc: 'Consultez la note complète et agissez rapidement.',
      page: 'Page',
      of: 'sur',
      total: 'au total',
      previous: 'Précédent',
      next: 'Suivant',
      tabPage: 'Page onglet',
    },
  }[locale];

  const [notes, setNotes] = useState<Note[]>([]);
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
  const [detailsNote, setDetailsNote] = useState<Note | null>(null);
  const [activeTab, setActiveTab] = useState<NoteStatus>('today');
  const [tabPageByStatus, setTabPageByStatus] = useState<Record<NoteStatus, number>>({
    overdue: 1,
    today: 1,
    upcoming: 1,
  });

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    [locale],
  );

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => getDateKey(today), [today]);

  const groupedNotes = useMemo(() => {
    const grouped: Record<NoteStatus, Note[]> = { overdue: [], today: [], upcoming: [] };
    for (const note of notes) {
      const status = getNoteStatus(note.followUpDate, todayKey);
      if (status) {
        grouped[status].push(note);
      }
    }
    return grouped;
  }, [notes, todayKey]);

  const actionableNotesCount = groupedNotes.overdue.length + groupedNotes.today.length + groupedNotes.upcoming.length;

  const overdueNotes = groupedNotes.overdue;

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
    params.set('page', '1');
    params.set('limit', '100');
    params.set('sortBy', 'createdAt');
    params.set('sortOrder', 'desc');
    if (search) {
      params.set('search', search);
    }
    if (filter !== 'all') {
      params.set('linkedType', filter);
    }
    return params.toString();
  }, [search, filter]);

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
    setTabPageByStatus({ overdue: 1, today: 1, upcoming: 1 });
  }, [search, filter]);

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
      setTabPageByStatus({ overdue: 1, today: 1, upcoming: 1 });
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
  const activeTabNotes = groupedNotes[activeTab];
  const activeTabTotalPages = Math.max(1, Math.ceil(activeTabNotes.length / TAB_PAGE_SIZE));
  const activeTabPage = Math.min(tabPageByStatus[activeTab], activeTabTotalPages);

  function setTabPage(status: NoteStatus, page: number) {
    const total = Math.max(1, Math.ceil(groupedNotes[status].length / TAB_PAGE_SIZE));
    const nextPage = Math.min(Math.max(1, page), total);
    setTabPageByStatus((prev) => ({ ...prev, [status]: nextPage }));
  }

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
          <CardTitle className="text-base">{t.taskBoard}</CardTitle>
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
                    setSearch(searchInput.trim());
                  }
                }}
              />
            </div>
            <Select value={filter} onValueChange={(v: 'all' | 'client' | 'supplier') => { setFilter(v); }}>
              <SelectTrigger data-tour-notes-filter className="w-full sm:w-45"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.all}</SelectItem>
                <SelectItem value="client">{t.clientsOnly}</SelectItem>
                <SelectItem value="supplier">{t.suppliersOnly}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {error ? <ErrorMessage message={error} /> : null}

          {!loading && notes.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-red-200/80 bg-red-50/40 px-3 py-2 dark:border-red-900/40 dark:bg-red-950/10">
                <p className="text-[11px] font-medium text-red-700 dark:text-red-300">{t.summaryOverdue}</p>
                <p className="mt-0.5 text-lg font-semibold text-red-700 dark:text-red-300">{groupedNotes.overdue.length}</p>
              </div>
              <div className="rounded-lg border border-orange-200/80 bg-orange-50/40 px-3 py-2 dark:border-orange-900/40 dark:bg-orange-950/10">
                <p className="text-[11px] font-medium text-orange-700 dark:text-orange-300">{t.summaryToday}</p>
                <p className="mt-0.5 text-lg font-semibold text-orange-700 dark:text-orange-300">{groupedNotes.today.length}</p>
              </div>
              <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/40 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/10">
                <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">{t.summaryUpcoming}</p>
                <p className="mt-0.5 text-lg font-semibold text-emerald-700 dark:text-emerald-300">{groupedNotes.upcoming.length}</p>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div data-tour-notes-list className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 5 }).map((_, idx) => <Skeleton key={idx} className="h-28 w-full" />)}
            </div>
          ) : notes.length === 0 ? (
            <EmptyState message={t.empty} />
          ) : (
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as NoteStatus)} className="space-y-4">
              <TabsList className="grid h-auto! w-full grid-cols-3 items-stretch gap-1 border border-border/80 bg-muted/10 p-1">
                <TabsTrigger value="overdue" className="h-auto! min-h-10 min-w-0 flex-col gap-0.5 whitespace-normal px-2 py-1.5 text-center text-xs sm:text-sm">
                  <span className="wrap-break-word leading-tight">{t.overdue}</span>
                  <span className="text-[11px] leading-none">({groupedNotes.overdue.length})</span>
                </TabsTrigger>
                <TabsTrigger value="today" className="h-auto! min-h-10 min-w-0 flex-col gap-0.5 whitespace-normal px-2 py-1.5 text-center text-xs sm:text-sm">
                  <span className="wrap-break-word leading-tight">{t.today}</span>
                  <span className="text-[11px] leading-none">({groupedNotes.today.length})</span>
                </TabsTrigger>
                <TabsTrigger value="upcoming" className="h-auto! min-h-10 min-w-0 flex-col gap-0.5 whitespace-normal px-2 py-1.5 text-center text-xs sm:text-sm">
                  <span className="wrap-break-word leading-tight">{t.upcoming}</span>
                  <span className="text-[11px] leading-none">({groupedNotes.upcoming.length})</span>
                </TabsTrigger>
              </TabsList>

              {actionableNotesCount === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-5 text-center text-sm text-muted-foreground">
                  {t.actionableEmpty}
                </div>
              ) : null}

              {([
                {
                  key: 'overdue' as NoteStatus,
                  cardClass: 'border-red-200/80 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/10',
                  badgeClass: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
                  badgeLabel: t.statusOverdue,
                },
                {
                  key: 'today' as NoteStatus,
                  cardClass: 'border-orange-200/80 bg-orange-50/40 dark:border-orange-900/40 dark:bg-orange-950/10',
                  badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
                  badgeLabel: t.statusToday,
                },
                {
                  key: 'upcoming' as NoteStatus,
                  cardClass: 'border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10',
                  badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
                  badgeLabel: t.statusUpcoming,
                },
              ]).map((section) => (
                <TabsContent key={section.key} value={section.key} className="space-y-3">
                  {(() => {
                    const sectionNotes = groupedNotes[section.key];
                    const sectionTotalPages = Math.max(1, Math.ceil(sectionNotes.length / TAB_PAGE_SIZE));
                    const sectionPage = Math.min(tabPageByStatus[section.key], sectionTotalPages);
                    const sectionPagedNotes = sectionNotes.slice((sectionPage - 1) * TAB_PAGE_SIZE, sectionPage * TAB_PAGE_SIZE);

                    if (sectionPagedNotes.length === 0) {
                      return (
                        <div className="rounded-xl border border-dashed border-border/70 px-4 py-5 text-center text-xs text-muted-foreground">
                          {t.emptyTaskSection}
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {sectionPagedNotes.map((note) => (
                          <article key={note._id} className={`rounded-xl border p-4 shadow-sm ${section.cardClass}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-1">
                                <h3 className="truncate text-sm font-semibold leading-snug">{note.title}</h3>
                                <p className="text-xs text-muted-foreground">
                                  {note.linkedType === 'client' ? t.client : t.supplier} · {note.linkedId?.fullName}
                                </p>
                              </div>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${section.badgeClass}`}>
                                {section.badgeLabel}
                              </span>
                            </div>

                            <div className="mt-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.followUpDate}</p>
                              <p className="mt-0.5 text-sm font-semibold">
                                {dateFormatter.format(new Date(note.followUpDate as string))}
                              </p>
                            </div>

                            <p className="mt-3 line-clamp-1 text-sm text-muted-foreground">
                              {note.description}
                            </p>
                            <button
                              type="button"
                              className="mt-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                              onClick={() => setDetailsNote(note)}
                            >
                              {t.seeMore}
                            </button>

                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="w-full"
                                disabled={markingFollowUpId === note._id}
                                onClick={() => markFollowUpDone(note._id)}
                              >
                                {markingFollowUpId === note._id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                                {markingFollowUpId === note._id
                                  ? (locale === 'fr' ? 'Enregistrement...' : 'Saving...')
                                  : (locale === 'fr' ? 'Suivi termine' : 'Mark done')}
                              </Button>
                              <Button type="button" size="sm" variant="secondary" className="w-full" onClick={() => openEditNote(note)}>
                                <PencilIcon className="size-3.5" />
                                {t.editNote}
                              </Button>
                              <Button type="button" size="sm" variant="ghost" className="w-full" onClick={() => setDetailsNote(note)}>
                                <ClockIcon className="size-3.5" />
                                {t.viewDetails}
                              </Button>
                            </div>
                          </article>
                        ))}
                      </div>
                    );
                  })()}
                </TabsContent>
              ))}

              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {t.tabPage} {activeTabPage} {t.of} {activeTabTotalPages} - {activeTabNotes.length} {t.total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activeTabPage <= 1}
                    onClick={() => setTabPage(activeTab, activeTabPage - 1)}
                  >
                    {t.previous}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activeTabPage >= activeTabTotalPages}
                    onClick={() => setTabPage(activeTab, activeTabPage + 1)}
                  >
                    {t.next}
                  </Button>
                </div>
              </div>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Sheet open={Boolean(detailsNote)} onOpenChange={(open) => { if (!open) { setDetailsNote(null); } }}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{t.taskDetails}</SheetTitle>
            <SheetDescription>{t.taskDetailsDesc}</SheetDescription>
          </SheetHeader>

          {detailsNote ? (
            <div className="space-y-4 px-4 pb-4 sm:px-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t.title}</p>
                <p className="mt-1 text-sm font-semibold">{detailsNote.title}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground">{t.linkedRecord}</p>
                <Link
                  className="mt-1 inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80"
                  href={`/${detailsNote.linkedType === 'client' ? 'clients' : 'suppliers'}/${detailsNote.linkedId?._id}`}
                >
                  {detailsNote.linkedType === 'client' ? t.client : t.supplier} · {detailsNote.linkedId?.fullName}
                </Link>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground">{t.followUpDate}</p>
                <p className="mt-1 text-sm font-semibold">
                  {detailsNote.followUpDate ? dateFormatter.format(new Date(detailsNote.followUpDate)) : '-'}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground">{t.description}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{detailsNote.description}</p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={markingFollowUpId === detailsNote._id}
                  onClick={() => markFollowUpDone(detailsNote._id)}
                >
                  {markingFollowUpId === detailsNote._id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                  {markingFollowUpId === detailsNote._id
                    ? (locale === 'fr' ? 'Enregistrement...' : 'Saving...')
                    : (locale === 'fr' ? 'Suivi termine' : 'Mark done')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    openEditNote(detailsNote);
                    setDetailsNote(null);
                  }}
                >
                  <PencilIcon className="size-4" />
                  {t.editNote}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deletingNoteId === detailsNote._id}
                  onClick={() => {
                    setDeleteTargetId(detailsNote._id);
                    setIsDeleteConfirmOpen(true);
                    setDetailsNote(null);
                  }}
                >
                  <Trash2Icon className="size-4" />
                  {t.deleteNote}
                </Button>
              </div>
            </div>
          ) : null}

          <SheetFooter>
            <Button variant="outline" onClick={() => setDetailsNote(null)}>{t.cancel}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </CrmShell>
  );
}
