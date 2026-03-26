'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { PlusIcon, SearchIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
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
  const [notes, setNotes] = useState<Note[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'client' | 'supplier'>('all');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const [clients, setClients] = useState<LinkedEntity[]>([]);
  const [suppliers, setSuppliers] = useState<LinkedEntity[]>([]);

  const [form, setForm] = useState({
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
        throw new Error(data.message || 'Failed to fetch notes');
      }

      setNotes(data.data ?? []);
      setPagination((prev) => data.pagination ?? prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notes');
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

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

  async function createNote() {
    if (!form.title.trim() || !form.description.trim() || !form.linkedId) {
      toast.error('Title, description, and linked record are required');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create note');
      }

      toast.success('Note created');
      setIsAddOpen(false);
      setForm({ title: '', description: '', linkedType: 'client', linkedId: '', followUpDate: '' });
      setPagination((prev) => ({ ...prev, page: 1 }));
      await loadNotes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    const confirmed = window.confirm('Delete this note?');
    if (!confirmed) {
      return;
    }

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
      toast.success('Note deleted');
      await loadNotes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete note');
    } finally {
      setDeletingNoteId(null);
    }
  }

  const linkedOptions = form.linkedType === 'client' ? clients : suppliers;

  return (
    <CrmShell title="Notes">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Notes</h1>
          <p className="text-sm text-muted-foreground">Search all notes and keep business memory centralized.</p>
        </div>

        <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
          <SheetTrigger asChild>
            <Button>
              <PlusIcon />
              Add note
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Create note</SheetTitle>
              <SheetDescription>Add note from global view and link it to client or supplier.</SheetDescription>
            </SheetHeader>

            <div className="space-y-3 px-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <textarea
                  className="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Linked type</Label>
                  <Select
                    value={form.linkedType}
                    onValueChange={(value: 'client' | 'supplier') =>
                      setForm((p) => ({ ...p, linkedType: value, linkedId: '' }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="supplier">Supplier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Linked record</Label>
                  <Select value={form.linkedId} onValueChange={(value) => setForm((p) => ({ ...p, linkedId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {linkedOptions.map((item) => (
                        <SelectItem key={item._id} value={item._id}>{item.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Follow-up date</Label>
                <Input type="date" value={form.followUpDate} onChange={(e) => setForm((p) => ({ ...p, followUpDate: e.target.value }))} />
              </div>
            </div>

            <SheetFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={createNote} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save note'}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">All notes</CardTitle>
          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative max-w-md flex-1">
              <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by title or description..."
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
              <SelectTrigger className="w-45"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="client">Clients only</SelectItem>
                <SelectItem value="supplier">Suppliers only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-4">
          {error ? <ErrorMessage message={error} /> : null}

          {loading ? (
            Array.from({ length: 5 }).map((_, idx) => <Skeleton key={idx} className="h-28 w-full" />)
          ) : notes.length === 0 ? (
            <EmptyState message="No notes found. Start by adding your first business note." />
          ) : (
            notes.map((note) => (
              <div key={note._id} className="rounded-xl border border-border/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-base font-semibold">{note.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString('en-US')}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      onClick={() => deleteNote(note._id)}
                      disabled={deletingNoteId === note._id}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{note.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Link
                    className="rounded-full bg-sky-100 px-2 py-1 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-300"
                    href={`/${note.linkedType === 'client' ? 'clients' : 'suppliers'}/${note.linkedId?._id}`}
                  >
                    {note.linkedType === 'client' ? 'Client' : 'Supplier'} · {note.linkedId?.fullName}
                  </Link>
                  {note.followUpDate ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      Follow-up: {new Date(note.followUpDate).toLocaleDateString('en-US')}
                    </span>
                  ) : null}
                </div>
              </div>
            ))
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {pagination.page} of {Math.max(pagination.totalPages, 1)} - {pagination.total} total
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.totalPages === 0 || pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </CrmShell>
  );
}
