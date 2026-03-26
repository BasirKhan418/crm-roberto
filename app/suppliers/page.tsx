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

interface Supplier {
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

export default function SuppliersPage() {
  const { locale } = useLocale();
  const t = {
    en: {
      fetchFailed: 'Failed to fetch suppliers',
      nameRequired: 'Supplier name is required',
      createFailed: 'Failed to create supplier',
      created: 'Supplier created',
      shellTitle: 'Suppliers',
      heading: 'Suppliers',
      subtitle: 'Track suppliers with contextual notes and negotiation history.',
      addSupplier: 'Add Supplier',
      addTitle: 'Add new supplier',
      addDesc: 'Create a supplier and it will appear immediately in your list.',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      address: 'Address',
      company: 'Company',
      vat: 'VAT/Tax ID',
      cancel: 'Cancel',
      saving: 'Saving...',
      saveSupplier: 'Save supplier',
      directory: 'Supplier directory',
      search: 'Search by name, email, company...',
      empty: 'No suppliers yet. Add your first supplier to keep operational context in one place.',
      createdCol: 'Created',
      page: 'Page',
      of: 'of',
      total: 'total',
      previous: 'Previous',
      next: 'Next',
    },
    fr: {
      fetchFailed: 'Impossible de recuperer les fournisseurs',
      nameRequired: 'Le nom du fournisseur est requis',
      createFailed: 'Impossible de creer le fournisseur',
      created: 'Fournisseur cree',
      shellTitle: 'Fournisseurs',
      heading: 'Fournisseurs',
      subtitle: 'Suivez les fournisseurs avec notes contextuelles et historique de negociation.',
      addSupplier: 'Ajouter un fournisseur',
      addTitle: 'Ajouter un nouveau fournisseur',
      addDesc: 'Creez un fournisseur et il apparaitra immediatement dans la liste.',
      name: 'Nom',
      email: 'E-mail',
      phone: 'Telephone',
      address: 'Adresse',
      company: 'Entreprise',
      vat: 'TVA/ID fiscal',
      cancel: 'Annuler',
      saving: 'Enregistrement...',
      saveSupplier: 'Enregistrer le fournisseur',
      directory: 'Repertoire des fournisseurs',
      search: 'Rechercher par nom, e-mail, entreprise...',
      empty: 'Aucun fournisseur. Ajoutez votre premier fournisseur.',
      createdCol: 'Cree le',
      page: 'Page',
      of: 'sur',
      total: 'au total',
      previous: 'Precedent',
      next: 'Suivant',
    },
  }[locale];

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/suppliers?${query}`, { cache: 'no-store' });
      const data = (await response.json()) as {
        success: boolean;
        message?: string;
        data?: Supplier[];
        pagination?: Pagination;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.message || t.fetchFailed);
      }

      setSuppliers(data.data ?? []);
      setPagination((prev) => data.pagination ?? prev);
    } catch (err) {
      const message = err instanceof Error ? err.message : t.fetchFailed;
      setError(message);
      setSuppliers([]);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  async function handleCreateSupplier() {
    if (!form.fullName.trim()) {
      toast.error(t.nameRequired);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/suppliers', {
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
      await loadSuppliers();
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
            <Button>
              <PlusIcon />
                {t.addSupplier}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>{t.addTitle}</SheetTitle>
              <SheetDescription>{t.addDesc}</SheetDescription>
            </SheetHeader>
            <div className="space-y-3 px-4">
              <div className="space-y-1.5">
                <Label htmlFor="supplier-full-name">{t.name}</Label>
                <Input id="supplier-full-name" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-email">{t.email}</Label>
                <Input id="supplier-email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-phone">{t.phone}</Label>
                <Input id="supplier-phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-address">{t.address}</Label>
                <Input id="supplier-address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="supplier-company">{t.company}</Label>
                  <Input id="supplier-company" value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="supplier-vat">{t.vat}</Label>
                  <Input id="supplier-vat" value={form.vatNumber} onChange={(e) => setForm((p) => ({ ...p, vatNumber: e.target.value }))} />
                </div>
              </div>
            </div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                {t.cancel}
              </Button>
              <Button onClick={handleCreateSupplier} disabled={isSubmitting}>
                {isSubmitting ? t.saving : t.saveSupplier}
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
          ) : suppliers.length === 0 ? (
            <EmptyState message={t.empty} />
          ) : (
            <>
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
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier._id}>
                      <TableCell className="font-medium">
                        <Link href={`/suppliers/${supplier._id}`} className="hover:underline">
                          {supplier.fullName}
                        </Link>
                      </TableCell>
                      <TableCell>{supplier.email || '-'}</TableCell>
                      <TableCell>{supplier.phone || '-'}</TableCell>
                      <TableCell>{supplier.companyName || '-'}</TableCell>
                      <TableCell>{new Date(supplier.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

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
