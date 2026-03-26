'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { PlusIcon, SearchIcon } from 'lucide-react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Client {
  _id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  companyName?: string | null;
  vatNumber?: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const initialPagination: Pagination = { page: 1, limit: 10, total: 0, totalPages: 0 };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    companyName: '',
    vatNumber: '',
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
    return params.toString();
  }, [pagination.page, pagination.limit, search]);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/clients?${query}`, { cache: 'no-store' });
      const data = (await response.json()) as {
        success: boolean;
        message?: string;
        data?: Client[];
        pagination?: Pagination;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch clients');
      }

      setClients(data.data ?? []);
      setPagination((prev) => data.pagination ?? prev);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch clients';
      setError(message);
      setClients([]);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  async function handleCreateClient() {
    if (!form.fullName.trim()) {
      toast.error('Client name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          companyName: form.companyName || undefined,
          vatNumber: form.vatNumber || undefined,
        }),
      });

      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create client');
      }

      toast.success('Client created');
      setIsAddOpen(false);
      setForm({ fullName: '', email: '', phone: '', address: '', companyName: '', vatNumber: '' });
      setPagination((prev) => ({ ...prev, page: 1 }));
      await loadClients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CrmShell title="Clients">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">Manage clients and keep contextual timeline notes.</p>
        </div>

        <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
          <SheetTrigger asChild>
            <Button>
              <PlusIcon />
              Add Client
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Add new client</SheetTitle>
              <SheetDescription>Create a client and it will appear immediately in your list.</SheetDescription>
            </SheetHeader>
            <div className="space-y-3 px-4">
              <div className="space-y-1.5">
                <Label htmlFor="client-full-name">Name</Label>
                <Input id="client-full-name" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-email">Email</Label>
                <Input id="client-email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-phone">Phone</Label>
                <Input id="client-phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-address">Address</Label>
                <Input id="client-address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="client-company">Company</Label>
                  <Input id="client-company" value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client-vat">VAT/Tax ID</Label>
                  <Input id="client-vat" value={form.vatNumber} onChange={(e) => setForm((p) => ({ ...p, vatNumber: e.target.value }))} />
                </div>
              </div>
            </div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateClient} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save client'}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Client directory</CardTitle>
          <div className="relative mt-3 max-w-md">
            <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search by name, email, company..."
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
        </CardHeader>
        <CardContent className="pt-4">
          {error ? <ErrorMessage message={error} /> : null}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-10 w-full" />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <EmptyState message="No clients yet. Add your first client to start building relationship history." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client._id}>
                      <TableCell className="font-medium">
                        <Link href={`/clients/${client._id}`} className="hover:underline">
                          {client.fullName}
                        </Link>
                      </TableCell>
                      <TableCell>{client.email || '-'}</TableCell>
                      <TableCell>{client.phone || '-'}</TableCell>
                      <TableCell>{client.companyName || '-'}</TableCell>
                      <TableCell>{new Date(client.createdAt).toLocaleDateString('en-US')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

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
            </>
          )}
        </CardContent>
      </Card>
    </CrmShell>
  );
}
