'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
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
    supplier: SupplierRecord;
    timeline: NoteItem[];
  };
}

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();

  const [supplierId, setSupplierId] = useState('');
  const [supplier, setSupplier] = useState<SupplierRecord | null>(null);
  const [timeline, setTimeline] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    companyName: '',
    vatNumber: '',
  });

  const [noteForm, setNoteForm] = useState({ title: '', description: '', followUpDate: '' });

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
        throw new Error(data.message || 'Failed to load supplier details');
      }

      setSupplier(data.data.supplier);
      setTimeline(data.data.timeline);
      setEditForm({
        fullName: data.data.supplier.fullName || '',
        email: data.data.supplier.email || '',
        phone: data.data.supplier.phone || '',
        address: data.data.supplier.address || '',
        companyName: data.data.supplier.companyName || '',
        vatNumber: data.data.supplier.vatNumber || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load supplier details');
      setSupplier(null);
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

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
        throw new Error(data.message || 'Failed to update supplier');
      }

      toast.success('Supplier updated');
      setIsEditOpen(false);
      await loadDetails();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update supplier');
    } finally {
      setIsSaving(false);
    }
  }

  async function removeSupplier() {
    if (!supplier) {
      return;
    }

    const confirmed = window.confirm('Delete this supplier and linked notes?');
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/suppliers/${supplier._id}`, { method: 'DELETE' });
      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete supplier');
      }
      toast.success('Supplier deleted');
      router.push('/suppliers');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete supplier');
    }
  }

  async function addNote() {
    if (!supplier) {
      return;
    }
    if (!noteForm.title.trim() || !noteForm.description.trim()) {
      toast.error('Title and description are required');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/suppliers/${supplier._id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteForm),
      });
      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to add note');
      }

      toast.success('Note added');
      setIsNoteOpen(false);
      setNoteForm({ title: '', description: '', followUpDate: '' });
      await loadDetails();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <CrmShell title="Supplier detail">
      {error ? <ErrorMessage message={error} /> : null}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : !supplier ? (
        <EmptyState message="Supplier not found." />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-xl">{supplier.fullName}</CardTitle>
              <p className="text-sm text-muted-foreground">Supplier profile and relationship details.</p>
            </CardHeader>
            <CardContent className="space-y-2 pt-4 text-sm">
              <p><span className="text-muted-foreground">Email:</span> {supplier.email || '-'}</p>
              <p><span className="text-muted-foreground">Phone:</span> {supplier.phone || '-'}</p>
              <p><span className="text-muted-foreground">Address:</span> {supplier.address || '-'}</p>
              <p><span className="text-muted-foreground">Company:</span> {supplier.companyName || '-'}</p>
              <p><span className="text-muted-foreground">VAT:</span> {supplier.vatNumber || '-'}</p>

              <div className="flex flex-wrap gap-2 pt-3">
                <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm"><PencilIcon />Edit</Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-lg">
                    <SheetHeader>
                      <SheetTitle>Edit supplier</SheetTitle>
                      <SheetDescription>Update supplier information.</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-3 px-4">
                      <div className="space-y-1.5"><Label>Name</Label><Input value={editForm.fullName} onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))} /></div>
                      <div className="space-y-1.5"><Label>Email</Label><Input value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} /></div>
                      <div className="space-y-1.5"><Label>Phone</Label><Input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} /></div>
                      <div className="space-y-1.5"><Label>Address</Label><Input value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} /></div>
                      <div className="space-y-1.5"><Label>Company</Label><Input value={editForm.companyName} onChange={(e) => setEditForm((p) => ({ ...p, companyName: e.target.value }))} /></div>
                      <div className="space-y-1.5"><Label>VAT/Tax ID</Label><Input value={editForm.vatNumber} onChange={(e) => setEditForm((p) => ({ ...p, vatNumber: e.target.value }))} /></div>
                    </div>
                    <SheetFooter>
                      <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                      <Button onClick={saveSupplier} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save changes'}</Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>

                <Button variant="destructive" size="sm" onClick={removeSupplier}><Trash2Icon />Delete</Button>

                <Sheet open={isNoteOpen} onOpenChange={setIsNoteOpen}>
                  <SheetTrigger asChild>
                    <Button size="sm"><PlusIcon />Add note</Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-lg">
                    <SheetHeader>
                      <SheetTitle>Add note</SheetTitle>
                      <SheetDescription>This note is automatically linked to this supplier.</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-3 px-4">
                      <div className="space-y-1.5"><Label>Title</Label><Input value={noteForm.title} onChange={(e) => setNoteForm((p) => ({ ...p, title: e.target.value }))} /></div>
                      <div className="space-y-1.5">
                        <Label>Description</Label>
                        <textarea
                          className="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          value={noteForm.description}
                          onChange={(e) => setNoteForm((p) => ({ ...p, description: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5"><Label>Follow-up date</Label><Input type="date" value={noteForm.followUpDate} onChange={(e) => setNoteForm((p) => ({ ...p, followUpDate: e.target.value }))} /></div>
                    </div>
                    <SheetFooter>
                      <Button variant="outline" onClick={() => setIsNoteOpen(false)}>Cancel</Button>
                      <Button onClick={addNote} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save note'}</Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Interaction timeline</CardTitle>
              <p className="text-sm text-muted-foreground">See full supplier history in one place.</p>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {timeline.length === 0 ? (
                <EmptyState message="No notes yet. Add your first note from this profile." />
              ) : (
                timeline.map((note) => (
                  <div key={note._id} className="rounded-lg border border-border/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{note.title}</h3>
                      <span className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString('en-US')}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{note.description}</p>
                    {note.followUpDate ? (
                      <p className="mt-2 text-xs text-sky-600 dark:text-sky-400">Follow-up: {new Date(note.followUpDate).toLocaleDateString('en-US')}</p>
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
