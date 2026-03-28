'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
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
    },
  }[locale];

  const [clientId, setClientId] = useState('');
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [timeline, setTimeline] = useState<NoteItem[]>([]);
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

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

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

  return (
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
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-xl">{client.fullName}</CardTitle>
              <p className="text-sm text-muted-foreground">{t.profileSubtitle}</p>
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
                timeline.map((note, index) => (
                  <div key={note._id} className={`rounded-lg border border-border/70 p-3 ${index === timeline.length - 1 ? '' : ''}`}>
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
      )}
    </CrmShell>
  );
}
