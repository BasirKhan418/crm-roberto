'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import { resolveTranslatedError } from '@/lib/i18n/messages';
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

interface SupplierRecord {
  _id: string;
  fullName: string;
  contactName?: string | null;
  category: 'materials' | 'logistics' | 'services' | 'technology' | 'other';
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  vatNumber?: string | null;
  iban?: string | null;
  notes?: string | null;
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
    supplier: SupplierRecord;
    timeline: NoteItem[];
  };
}

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = {
    en: {
      loadFailed: 'Failed to load supplier details',
      updateFailed: 'Failed to update supplier',
      updated: 'Supplier updated',
      deleteFailed: 'Failed to delete supplier',
      deleted: 'Supplier deleted',
      noteValidation: 'Title and description are required',
      noteDateRequired: 'Follow-up date is required',
      noteAddFailed: 'Failed to add note',
      noteAdded: 'Note added',
      noteUpdateFailed: 'Failed to update note',
      noteUpdated: 'Note updated',
      shellTitle: 'Supplier detail',
      notFound: 'Supplier not found.',
      profileSubtitle: 'Supplier profile and relationship details.',
      email: 'Email',
      phone: 'Phone',
      address: 'Address',
      contactName: 'Contact name',
      postalCode: 'Postal code',
      city: 'City',
      country: 'Country',
      category: 'Category',
      materials: 'Materials',
      logistics: 'Logistics',
      services: 'Services',
      technology: 'Technology',
      other: 'Other',
      vat: 'VAT',
      edit: 'Edit',
      editSupplier: 'Edit supplier',
      editSupplierDesc: 'Update supplier information.',
      legalName: 'Company legal name',
      vatTax: 'VAT/Tax ID',
      iban: 'IBAN',
      notes: 'Notes',
      cancel: 'Cancel',
      saving: 'Saving...',
      saveChanges: 'Save changes',
      delete: 'Delete',
      deleteTitle: 'Delete supplier?',
      deleteDesc: 'This will permanently delete this supplier and linked notes.',
      deleting: 'Deleting...',
      deleteSupplier: 'Delete supplier',
      addNote: 'Add note',
      addNoteTitle: 'Add note',
      addNoteDesc: 'This note is automatically linked to this supplier.',
      title: 'Title',
      description: 'Description',
      followUpDate: 'Follow-up date',
      saveNote: 'Save note',
      editNote: 'Edit note',
      editNoteDesc: 'Update this supplier note.',
      timeline: 'Interaction timeline',
      timelineDesc: 'See full supplier history in one place.',
      timelineEmpty: 'No notes yet. Add your first note from this profile.',
      followUp: 'Follow-up',
    },
    fr: {
      loadFailed: 'Impossible de charger les d\u00e9tails du fournisseur',
      updateFailed: 'Impossible de mettre \u00e0 jour le fournisseur',
      updated: 'Fournisseur mis \u00e0 jour',
      deleteFailed: 'Impossible de supprimer le fournisseur',
      deleted: 'Fournisseur supprim\u00e9',
      noteValidation: 'Le titre et la description sont requis',
      noteDateRequired: 'La date de suivi est requise',
      noteAddFailed: "Impossible d'ajouter la note",
      noteAdded: 'Note ajout\u00e9e',
      noteUpdateFailed: 'Impossible de mettre \u00e0 jour la note',
      noteUpdated: 'Note mise \u00e0 jour',
      shellTitle: 'D\u00e9tail fournisseur',
      notFound: 'Fournisseur introuvable.',
      profileSubtitle: 'Profil fournisseur et d\u00e9tails de la relation.',
      email: 'E-mail',
      phone: 'T\u00e9l\u00e9phone',
      address: 'Adresse',
      contactName: 'Nom du contact',
      postalCode: 'Code postal',
      city: 'Ville',
      country: 'Pays',
      category: 'Catégorie',
      materials: 'Matériaux',
      logistics: 'Logistique',
      services: 'Services',
      technology: 'Technologie',
      other: 'Autre',
      vat: 'TVA',
      edit: 'Modifier',
      editSupplier: 'Modifier le fournisseur',
      editSupplierDesc: 'Mettez \u00e0 jour les informations du fournisseur.',
      legalName: 'Raison sociale',
      vatTax: 'TVA/ID fiscal',
      iban: 'IBAN',
      notes: 'Notes',
      cancel: 'Annuler',
      saving: 'Enregistrement...',
      saveChanges: 'Enregistrer les modifications',
      delete: 'Supprimer',
      deleteTitle: 'Supprimer le fournisseur\u00a0?',
      deleteDesc: 'Cette action supprimera d\u00e9finitivement ce fournisseur et ses notes li\u00e9es.',
      deleting: 'Suppression...',
      deleteSupplier: 'Supprimer le fournisseur',
      addNote: 'Ajouter une note',
      addNoteTitle: 'Ajouter une note',
      addNoteDesc: 'Cette note est automatiquement li\u00e9e \u00e0 ce fournisseur.',
      title: 'Titre',
      description: 'Description',
      followUpDate: 'Date de suivi',
      saveNote: 'Enregistrer la note',
      editNote: 'Modifier la note',
      editNoteDesc: 'Mettez \u00e0 jour cette note fournisseur.',
      timeline: 'Chronologie des interactions',
      timelineDesc: "Consultez tout l'historique fournisseur en un seul endroit.",
      timelineEmpty: 'Aucune note. Ajoutez votre premi\u00e8re note depuis ce profil.',
      followUp: 'Suivi',
    },
  }[locale];

  const [supplierId, setSupplierId] = useState('');
  const [supplier, setSupplier] = useState<SupplierRecord | null>(null);
  const [timeline, setTimeline] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isNoteEditOpen, setIsNoteEditOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingSupplier, setIsDeletingSupplier] = useState(false);
  const [isNoteUpdating, setIsNoteUpdating] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    fullName: '',
    contactName: '',
    category: 'other' as SupplierRecord['category'],
    email: '',
    phone: '',
    address: '',
    postalCode: '',
    city: '',
    country: '',
    vatNumber: '',
    iban: '',
    notes: '',
  });

  const [noteForm, setNoteForm] = useState({ title: '', description: '', followUpDate: '' });
  const [editNoteForm, setEditNoteForm] = useState({ title: '', description: '', followUpDate: '' });

  useEffect(() => {
    params.then((resolved) => setSupplierId(resolved.id));
  }, [params]);

  const endpoint = useMemo(() => (supplierId ? `/api/suppliers/${supplierId}` : ''), [supplierId]);

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

      setSupplier(data.data.supplier);
      setTimeline(data.data.timeline);
      setEditForm({
        fullName: data.data.supplier.fullName || '',
        contactName: data.data.supplier.contactName || '',
        category: data.data.supplier.category || 'other',
        email: data.data.supplier.email || '',
        phone: data.data.supplier.phone || '',
        address: data.data.supplier.address || '',
        postalCode: data.data.supplier.postalCode || '',
        city: data.data.supplier.city || '',
        country: data.data.supplier.country || '',
        vatNumber: data.data.supplier.vatNumber || '',
        iban: data.data.supplier.iban || '',
        notes: data.data.supplier.notes || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
      setSupplier(null);
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, t.loadFailed]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  async function saveSupplier() {
    if (!supplier) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/suppliers/${supplier._id}`, {
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
      toast.error(resolveTranslatedError(locale, err, t.updateFailed));
    } finally {
      setIsSaving(false);
    }
  }

  async function removeSupplier() {
    if (!supplier) {
      return;
    }

    setIsDeletingSupplier(true);
    try {
      const response = await fetch(`/api/suppliers/${supplier._id}`, { method: 'DELETE' });
      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || t.deleteFailed);
      }
      toast.success(t.deleted);
      router.push('/suppliers');
    } catch (err) {
      toast.error(resolveTranslatedError(locale, err, t.deleteFailed));
    } finally {
      setIsDeletingSupplier(false);
      setIsDeleteConfirmOpen(false);
    }
  }

  async function addNote() {
    if (!supplier) {
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
      const response = await fetch(`/api/suppliers/${supplier._id}/notes`, {
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
      toast.error(resolveTranslatedError(locale, err, t.noteAddFailed));
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
      toast.error(resolveTranslatedError(locale, err, t.noteUpdateFailed));
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
      ) : !supplier ? (
        <EmptyState message={t.notFound} />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.2fr]">
          <Card data-tour-supplier-profile>
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-base font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {supplier.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <CardTitle className="text-xl">{supplier.fullName}</CardTitle>
                  <p className="text-sm text-muted-foreground">{t.profileSubtitle}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-4 text-sm">
              <p><span className="text-muted-foreground">{t.email}:</span> {supplier.email || '-'}</p>
              <p><span className="text-muted-foreground">{t.phone}:</span> {supplier.phone || '-'}</p>
              <p><span className="text-muted-foreground">{t.address}:</span> {supplier.address || '-'}</p>
              <p><span className="text-muted-foreground">{t.contactName}:</span> {supplier.contactName || '-'}</p>
              <p><span className="text-muted-foreground">{t.postalCode}:</span> {supplier.postalCode || '-'}</p>
              <p><span className="text-muted-foreground">{t.city}:</span> {supplier.city || '-'}</p>
              <p><span className="text-muted-foreground">{t.country}:</span> {supplier.country || '-'}</p>
              <p><span className="text-muted-foreground">{t.category}:</span> {
                supplier.category === 'materials'
                  ? t.materials
                  : supplier.category === 'logistics'
                  ? t.logistics
                  : supplier.category === 'services'
                  ? t.services
                  : supplier.category === 'technology'
                  ? t.technology
                  : t.other
              }</p>
              <p><span className="text-muted-foreground">{t.vat}:</span> {supplier.vatNumber || '-'}</p>
                  <p><span className="text-muted-foreground">{t.iban}:</span> {supplier.iban || '-'}</p>
                  <p><span className="text-muted-foreground">{t.notes}:</span> {supplier.notes || '-'}</p>

              <div data-tour-supplier-actions className="flex flex-wrap gap-2 pt-3">
                <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm"><PencilIcon />{t.edit}</Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-lg">
                    <SheetHeader>
                      <SheetTitle>{t.editSupplier}</SheetTitle>
                      <SheetDescription>{t.editSupplierDesc}</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-3 px-4">
                      <div className="space-y-1.5"><Label>{t.legalName}</Label><Input value={editForm.fullName} onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))} /></div>
                      <div className="space-y-1.5"><Label>{t.contactName}</Label><Input value={editForm.contactName} onChange={(e) => setEditForm((p) => ({ ...p, contactName: e.target.value }))} /></div>
                      <div className="space-y-1.5"><Label>{t.email}</Label><Input value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} /></div>
                      <div className="space-y-1.5"><Label>{t.phone}</Label><Input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} /></div>
                      <div className="space-y-1.5"><Label>{t.address}</Label><Input value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} /></div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5"><Label>{t.postalCode}</Label><Input value={editForm.postalCode} onChange={(e) => setEditForm((p) => ({ ...p, postalCode: e.target.value }))} /></div>
                        <div className="space-y-1.5"><Label>{t.city}</Label><Input value={editForm.city} onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))} /></div>
                        <div className="space-y-1.5"><Label>{t.country}</Label><Input value={editForm.country} onChange={(e) => setEditForm((p) => ({ ...p, country: e.target.value }))} /></div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t.category}</Label>
                        <select
                          value={editForm.category}
                          onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value as SupplierRecord['category'] }))}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
                        >
                          <option value="materials">{t.materials}</option>
                          <option value="logistics">{t.logistics}</option>
                          <option value="services">{t.services}</option>
                          <option value="technology">{t.technology}</option>
                          <option value="other">{t.other}</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label>{t.vatTax}</Label><Input value={editForm.vatNumber} onChange={(e) => setEditForm((p) => ({ ...p, vatNumber: e.target.value }))} /></div>
                        <div className="space-y-1.5"><Label>{t.iban}</Label><Input value={editForm.iban} onChange={(e) => setEditForm((p) => ({ ...p, iban: e.target.value }))} /></div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t.notes}</Label>
                        <textarea
                          className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          value={editForm.notes}
                          onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                        />
                      </div>
                    </div>
                    <SheetFooter>
                      <Button variant="outline" onClick={() => setIsEditOpen(false)}>{t.cancel}</Button>
                      <Button onClick={saveSupplier} disabled={isSaving}>{isSaving ? t.saving : t.saveChanges}</Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>

                <Button variant="destructive" size="sm" onClick={() => setIsDeleteConfirmOpen(true)}><Trash2Icon />{t.delete}</Button>

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
                          if (isDeletingSupplier) {
                            return;
                          }
                          void removeSupplier();
                        }}
                      >
                        <Button variant="destructive" disabled={isDeletingSupplier}>
                          {isDeletingSupplier ? t.deleting : t.deleteSupplier}
                        </Button>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Sheet open={isNoteOpen} onOpenChange={setIsNoteOpen}>
                  <SheetTrigger asChild>
                    <Button size="sm"><PlusIcon />{t.addNote}</Button>
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

          <Card data-tour-supplier-timeline>
            <CardHeader className="border-b">
              <CardTitle>{t.timeline}</CardTitle>
              <p className="text-sm text-muted-foreground">{t.timelineDesc}</p>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {timeline.length === 0 ? (
                <EmptyState message={t.timelineEmpty} />
              ) : (
                timeline.map((note) => (
                  <div key={note._id} className="rounded-lg border border-l-4 border-border/70 border-l-amber-400 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{note.title}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB')}</span>
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => openNoteEdit(note)}>
                          <PencilIcon />
                        </Button>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{note.description}</p>
                    {note.followUpDate ? (
                      <p className="mt-2 text-xs text-sky-600 dark:text-sky-400">{t.followUp}: {new Date(note.followUpDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB')}</p>
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
