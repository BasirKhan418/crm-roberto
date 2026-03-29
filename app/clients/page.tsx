'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { PlusIcon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
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
  const { locale } = useLocale();
  const t = {
    en: {
      fetchFailed: 'Failed to fetch clients',
      nameRequired: 'Client name is required',
      createFailed: 'Failed to create client',
      created: 'Client created',
      shellTitle: 'Clients',
      heading: 'Clients',
      subtitle: 'Manage clients and keep contextual timeline notes.',
      addClient: 'Add Client',
      addTitle: 'Add new client',
      addDesc: 'Create a client and it will appear immediately in your list.',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      address: 'Address',
      company: 'Company',
      vat: 'VAT/Tax ID',
      cancel: 'Cancel',
      saving: 'Saving...',
      saveClient: 'Save client',
      directory: 'Client directory',
      search: 'Search by name, email, company...',
      empty: 'No clients yet. Add your first client to start building relationship history.',
      createdCol: 'Created',
      page: 'Page',
      of: 'of',
      total: 'total',
      previous: 'Previous',
      next: 'Next',
      open: 'Open',
      noData: '-',
    },
    fr: {
      fetchFailed: 'Impossible de recuperer les clients',
      nameRequired: 'Le nom du client est requis',
      createFailed: 'Impossible de creer le client',
      created: 'Client cree',
      shellTitle: 'Clients',
      heading: 'Clients',
      subtitle: 'Gerez les clients et conservez un historique contextuel.',
      addClient: 'Ajouter un client',
      addTitle: 'Ajouter un nouveau client',
      addDesc: 'Creez un client et il apparaitra immediatement dans la liste.',
      name: 'Nom',
      email: 'E-mail',
      phone: 'Telephone',
      address: 'Adresse',
      company: 'Entreprise',
      vat: 'TVA/ID fiscal',
      cancel: 'Annuler',
      saving: 'Enregistrement...',
      saveClient: 'Enregistrer le client',
      directory: 'Repertoire des clients',
      search: 'Rechercher par nom, e-mail, entreprise...',
      empty: 'Aucun client. Ajoutez votre premier client pour commencer.',
      createdCol: 'Cree le',
      page: 'Page',
      of: 'sur',
      total: 'au total',
      previous: 'Precedent',
      next: 'Suivant',
      open: 'Ouvrir',
      noData: '-',
    },
  }[locale];

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
        throw new Error(data.message || t.fetchFailed);
      }

      setClients(data.data ?? []);
      setPagination((prev) => data.pagination ?? prev);
    } catch (err) {
      const message = err instanceof Error ? err.message : t.fetchFailed;
      setError(message);
      setClients([]);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
    } finally {
      setLoading(false);
    }
  }, [query, t.fetchFailed]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  async function handleCreateClient() {
    if (!form.fullName.trim()) {
      toast.error(t.nameRequired);
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
        throw new Error(data.message || t.createFailed);
      }

      toast.success(t.created);
      setIsAddOpen(false);
      setForm({ fullName: '', email: '', phone: '', address: '', companyName: '', vatNumber: '' });
      setPagination((prev) => ({ ...prev, page: 1 }));
      await loadClients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.createFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CrmShell title={t.shellTitle}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.heading}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
          <SheetTrigger asChild>
            <Button className='lg:h-10 md:h-10 h-10'>
              <PlusIcon />
              {t.addClient}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>{t.addTitle}</SheetTitle>
              <SheetDescription>{t.addDesc}</SheetDescription>
            </SheetHeader>
            <div className="space-y-3 px-4">
              <div className="space-y-1.5">
                <Label htmlFor="client-full-name">{t.name}</Label>
                <Input id="client-full-name" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-email">{t.email}</Label>
                <Input id="client-email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-phone">{t.phone}</Label>
                <Input id="client-phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-address">{t.address}</Label>
                <Input id="client-address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="client-company">{t.company}</Label>
                  <Input id="client-company" value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client-vat">{t.vat}</Label>
                  <Input id="client-vat" value={form.vatNumber} onChange={(e) => setForm((p) => ({ ...p, vatNumber: e.target.value }))} />
                </div>
              </div>
            </div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                {t.cancel}
              </Button>
              <Button onClick={handleCreateClient} disabled={isSubmitting}>
                {isSubmitting ? t.saving : t.saveClient}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">{t.directory}</CardTitle>
          <div className="relative mt-3 max-w-md">
            <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t.search}
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
            <EmptyState message={t.empty} />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {clients.map((client) => (
                  <article key={client._id} className="space-y-2.5 rounded-xl border border-border/70 bg-card/80 p-3.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link href={`/clients/${client._id}`} className="block text-sm font-semibold text-(--color-text-info) hover:underline wrap-break-word">
                          {client.fullName}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted-foreground">{client.companyName || t.noData}</p>
                      </div>
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href={`/clients/${client._id}`}>{t.open}</Link>
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-background px-2.5 py-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">{t.email}</p>
                        <p className="truncate font-medium">{client.email || t.noData}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t.phone}</p>
                        <p className="truncate font-medium">{client.phone || t.noData}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">{t.createdCol}</p>
                        <p className="font-medium">{new Date(client.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.name}</TableHead>
                      <TableHead>{t.email}</TableHead>
                      <TableHead>{t.phone}</TableHead>
                      <TableHead>{t.company}</TableHead>
                      <TableHead>{t.createdCol}</TableHead>
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
                        <TableCell>{client.email || t.noData}</TableCell>
                        <TableCell>{client.phone || t.noData}</TableCell>
                        <TableCell>{client.companyName || t.noData}</TableCell>
                        <TableCell>{new Date(client.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex items-center justify-between">
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
            </>
          )}
        </CardContent>
      </Card>
    </CrmShell>
  );
}
