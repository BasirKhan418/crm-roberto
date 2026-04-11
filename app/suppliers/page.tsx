'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Building2, LayoutGrid, List, Mail, MapPin, Phone, PlusIcon, SearchIcon, Truck } from 'lucide-react';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import { resolveTranslatedError } from '@/lib/i18n/messages';
import { Button } from '@/components/ui/button';
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
  contactName?: string | null;
  category: 'materials' | 'logistics' | 'services' | 'technology' | 'other';
  tags?: Array<'important' | 'pending' | 'partner'>;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  companyName?: string | null;
  vatNumber?: string | null;
  iban?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const initialPagination: Pagination = { page: 1, limit: 12, total: 0, totalPages: 0 };
const SUPPLIERS_VIEW_STORAGE_KEY = 'crm.suppliers.viewMode.v1';

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = [
  'bg-teal-600',
  'bg-cyan-600',
  'bg-emerald-600',
  'bg-sky-600',
  'bg-indigo-600',
  'bg-violet-600',
  'bg-rose-600',
  'bg-amber-600',
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? 'bg-teal-600';
}

type SupplierCategory = 'materials' | 'logistics' | 'services' | 'technology' | 'other';
type SupplierTag = 'important' | 'pending' | 'partner';
const SUPPLIER_TAGS: SupplierTag[] = ['important', 'pending', 'partner'];

function extractSupplierTags(notes?: string | null): SupplierTag[] {
  if (!notes) {
    return [];
  }

  const lowered = notes.toLowerCase();
  const tags: SupplierTag[] = [];
  if (/(^|\s)#important(\s|$)/.test(lowered)) tags.push('important');
  if (/(^|\s)#pending(\s|$)/.test(lowered)) tags.push('pending');
  if (/(^|\s)#partner(\s|$)/.test(lowered)) tags.push('partner');
  return tags;
}

function getSupplierTags(supplier: Supplier): SupplierTag[] {
  const fromModel = Array.isArray(supplier.tags) ? supplier.tags : [];
  const fromNotes = extractSupplierTags(supplier.notes);
  return Array.from(new Set([...fromModel, ...fromNotes]));
}

function tagBadgeClass(tag: SupplierTag): string {
  if (tag === 'important') {
    return 'border border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-800/60 dark:bg-rose-900/40 dark:text-rose-300';
  }

  if (tag === 'pending') {
    return 'border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/40 dark:text-amber-300';
  }

  return 'border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/40 dark:text-emerald-300';
}

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
      materials: 'Materials',
      logistics: 'Logistics',
      services: 'Services',
      technology: 'Technology',
      other: 'Other',
      addSupplier: 'Add Supplier',
      addTitle: 'Add new supplier',
      addDesc: 'Create a supplier and it will appear immediately in your list.',
      legalName: 'Company legal name',
      contactName: 'Contact name',
      email: 'Email',
      phone: 'Phone',
      address: 'Address',
      postalCode: 'Postal code',
      city: 'City',
      country: 'Country',
      vat: 'VAT/Tax ID',
      iban: 'IBAN',
      tags: 'Tags',
      notes: 'Notes',
      tagsHint: 'Use tags to quickly identify supplier priority and relationship state.',
      notesHint: 'Add longer business context, payment notes, or negotiation history.',
      cancel: 'Cancel',
      saving: 'Saving...',
      saveSupplier: 'Save supplier',
      directory: 'Supplier directory',
      search: 'Search by legal name, contact, email, city...',
      empty: 'No suppliers yet. Add your first supplier to keep operational context in one place.',
      createdCol: 'Created',
      page: 'Page',
      of: 'of',
      total: 'total',
      previous: 'Previous',
      next: 'Next',
      open: 'Open',
      noData: '—',
      totalSuppliers: 'Total suppliers',
      viewProfile: 'View profile →',
      cardView: 'Card view',
      listView: 'List view',
      nameCol: 'Name',
      contactCol: 'Contact',
      categoryCol: 'Category',
      emailCol: 'Email',
      phoneCol: 'Phone',
      cityCol: 'City',
      ibanCol: 'IBAN',
      tagsCol: 'Tags',
      tagImportant: 'Important',
      tagPending: 'Pending',
      tagPartner: 'Partner',
    },
    fr: {
      fetchFailed: 'Impossible de récupérer les fournisseurs',
      nameRequired: 'Le nom du fournisseur est requis',
      createFailed: 'Impossible de créer le fournisseur',
      created: 'Fournisseur créé',
      shellTitle: 'Fournisseurs',
      heading: 'Fournisseurs',
      subtitle: 'Suivez les fournisseurs avec notes contextuelles et historique de négociation.',
      materials: 'Matériaux',
      logistics: 'Logistique',
      services: 'Services',
      technology: 'Technologie',
      other: 'Autre',
      addSupplier: 'Ajouter un fournisseur',
      addTitle: 'Ajouter un nouveau fournisseur',
      addDesc: 'Créez un fournisseur et il apparaêtra immédiatement dans la liste.',
      legalName: 'Raison sociale',
      contactName: 'Nom du contact',
      email: 'E-mail',
      phone: 'Téléphone',
      address: 'Adresse',
      postalCode: 'Code postal',
      city: 'Ville',
      country: 'Pays',
      vat: 'TVA/ID fiscal',
      iban: 'IBAN',
      tags: 'Tags',
      notes: 'Notes',
      tagsHint: 'Utilisez des tags pour identifier rapidement la priorite et le statut de relation.',
      notesHint: 'Ajoutez du contexte metier, des notes de paiement ou un historique de negociation.',
      cancel: 'Annuler',
      saving: 'Enregistrement...',
      saveSupplier: 'Enregistrer le fournisseur',
      directory: 'Répertoire des fournisseurs',
      search: 'Rechercher par raison sociale, contact, e-mail, ville...',
      empty: 'Aucun fournisseur. Ajoutez votre premier fournisseur.',
      createdCol: 'Créé le',
      page: 'Page',
      of: 'sur',
      total: 'au total',
      previous: 'Précédent',
      next: 'Suivant',
      open: 'Ouvrir',
      noData: '—',
      totalSuppliers: 'Total fournisseurs',
      viewProfile: 'Voir le profil →',
      cardView: 'Vue cartes',
      listView: 'Vue liste',
      nameCol: 'Nom',
      contactCol: 'Contact',
      categoryCol: 'Categorie',
      emailCol: 'E-mail',
      phoneCol: 'Telephone',
      cityCol: 'Ville',
      ibanCol: 'IBAN',
      tagsCol: 'Tags',
      tagImportant: 'Important',
      tagPending: 'En attente',
      tagPartner: 'Partenaire',
    },
  }[locale];

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    postalCode: '',
    city: '',
    country: '',
    vatNumber: '',
    iban: '',
    tags: [] as SupplierTag[],
    notes: '',
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SUPPLIERS_VIEW_STORAGE_KEY);
      if (raw === 'card' || raw === 'list') {
        setViewMode(raw);
      }
    } catch {
      // Ignore storage errors.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SUPPLIERS_VIEW_STORAGE_KEY, viewMode);
    } catch {
      // Ignore storage errors.
    }
  }, [viewMode]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(pagination.page));
    params.set('limit', String(pagination.limit));
    params.set('sortBy', 'createdAt');
    params.set('sortOrder', 'desc');
    if (search) {
      params.set('search', search);
    }
    // Removed category filter
    return params.toString();
  }, [pagination.page, pagination.limit, search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPagination((prev) => ({ ...prev, page: 1 }));
      setSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const categoryLabelByValue = useMemo(
    () => ({
      materials: t.materials,
      logistics: t.logistics,
      services: t.services,
      technology: t.technology,
      other: t.other,
    }),
    [t.materials, t.logistics, t.other, t.services, t.technology]
  );

  const getCategoryLabel = useCallback(
    (category: SupplierCategory | undefined | null) => categoryLabelByValue[category ?? 'other'],
    [categoryLabelByValue]
  );

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
  }, [query, t.fetchFailed]);

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
          contactName: form.contactName || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          postalCode: form.postalCode || undefined,
          city: form.city || undefined,
          country: form.country || undefined,
          vatNumber: form.vatNumber || undefined,
          iban: form.iban || undefined,
          tags: form.tags,
          notes: form.notes || undefined,
        }),
      });

      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || t.createFailed);
      }

      toast.success(t.created);
      setIsAddOpen(false);
      setForm({
        fullName: '',
        contactName: '',
        email: '',
        phone: '',
        address: '',
        postalCode: '',
        city: '',
        country: '',
        vatNumber: '',
        iban: '',
        tags: [],
        notes: '',
      });
      setPagination((prev) => ({ ...prev, page: 1 }));
      await loadSuppliers();
    } catch (err) {
      toast.error(resolveTranslatedError(locale, err, t.createFailed));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CrmShell title={t.shellTitle}>

      {/* Page header */}
      <div data-tour-suppliers-header className="flex flex-col gap-3 pb-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t.heading}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
          <SheetTrigger asChild>
            <Button className="h-10" data-tour-add-supplier>
              <PlusIcon />
              {t.addSupplier}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full p-0 sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>{t.addTitle}</SheetTitle>
              <SheetDescription>{t.addDesc}</SheetDescription>
            </SheetHeader>
            <div className="max-h-[calc(100svh-10rem)] space-y-3 overflow-y-auto px-4 pb-4 sm:px-6">
              <div className="space-y-1.5">
                <Label htmlFor="supplier-full-name">{t.legalName}</Label>
                <Input id="supplier-full-name" data-tour-supplier-modal-name value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-contact-name">{t.contactName}</Label>
                <Input id="supplier-contact-name" value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} />
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
                  <Label htmlFor="supplier-postal">{t.postalCode}</Label>
                  <Input id="supplier-postal" value={form.postalCode} onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="supplier-city">{t.city}</Label>
                  <Input id="supplier-city" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-country">{t.country}</Label>
                <Input id="supplier-country" value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-vat">{t.vat}</Label>
                <Input id="supplier-vat" value={form.vatNumber} onChange={(e) => setForm((p) => ({ ...p, vatNumber: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-iban">{t.iban}</Label>
                <Input
                  id="supplier-iban"
                  className="font-mono"
                  value={form.iban}
                  onChange={(e) => setForm((p) => ({ ...p, iban: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t.tags}</Label>
                <div className="flex flex-wrap gap-2">
                  {SUPPLIER_TAGS.map((tag) => {
                    const active = form.tags.includes(tag);
                    return (
                      <Button
                        key={tag}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            tags: prev.tags.includes(tag)
                              ? prev.tags.filter((item) => item !== tag)
                              : [...prev.tags, tag],
                          }));
                        }}
                        className={`h-8 rounded-full px-3 text-xs ${active ? tagBadgeClass(tag) : ''}`}
                      >
                        {tag === 'important' ? t.tagImportant : tag === 'pending' ? t.tagPending : t.tagPartner}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">{t.tagsHint}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-notes">{t.notes}</Label>
                <textarea
                  id="supplier-notes"
                  className="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">{t.notesHint}</p>
              </div>
            </div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>{t.cancel}</Button>
              <Button data-tour-supplier-modal-save onClick={handleCreateSupplier} disabled={isSubmitting}>
                {isSubmitting ? t.saving : t.saveSupplier}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Stat bar */}
      {!loading && !error ? (
        <div className="flex items-center gap-3 rounded-xl bg-primary/8 px-4 py-3 dark:bg-primary/15">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary">
            <Truck className="size-4 text-white" strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-medium text-primary/70 dark:text-primary/60">{t.totalSuppliers}</p>
            <p className="text-xl font-bold text-primary dark:text-primary/80">{pagination.total}</p>
          </div>
        </div>
      ) : null}

      {/* Search */}
      <div className="space-y-3 rounded-xl bg-card/60 p-3 sm:p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full sm:max-w-md">
            <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              data-tour-suppliers-search
              className="h-10 pl-8"
              placeholder={t.search}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="inline-flex w-full rounded-lg border bg-background p-1 md:w-auto">
            <Button
              type="button"
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 gap-1.5 md:flex-none"
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid className="size-3.5" />
              {t.cardView}
            </Button>
            <Button
              type="button"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 gap-1.5 md:flex-none"
              onClick={() => setViewMode('list')}
            >
              <List className="size-3.5" />
              {t.listView}
            </Button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error ? <ErrorMessage message={error} /> : null}

      {/* Results */}
      {loading ? (
        viewMode === 'list' ? (
          <div className="rounded-xl border bg-card">
            <Table className="min-w-245">
              <TableHeader>
                <TableRow>
                  <TableHead>{t.nameCol}</TableHead>
                  <TableHead>{t.contactCol}</TableHead>
                  <TableHead>{t.categoryCol}</TableHead>
                  <TableHead>{t.emailCol}</TableHead>
                  <TableHead>{t.phoneCol}</TableHead>
                  <TableHead>{t.cityCol}</TableHead>
                  <TableHead>{t.ibanCol}</TableHead>
                  <TableHead>{t.tagsCol}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-44" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-44" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="space-y-3 rounded-2xl bg-card p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        )
      ) : suppliers.length === 0 ? (
        <EmptyState message={t.empty} />
      ) : (
        <>
          {viewMode === 'list' ? (
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table className="min-w-245">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.nameCol}</TableHead>
                    <TableHead>{t.contactCol}</TableHead>
                    <TableHead>{t.categoryCol}</TableHead>
                    <TableHead>{t.emailCol}</TableHead>
                    <TableHead>{t.phoneCol}</TableHead>
                    <TableHead>{t.cityCol}</TableHead>
                    <TableHead>{t.ibanCol}</TableHead>
                    <TableHead>{t.tagsCol}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => {
                    const tags = getSupplierTags(supplier);
                    return (
                      <TableRow key={supplier._id}>
                        <TableCell>
                          <Link href={`/suppliers/${supplier._id}`} className="font-semibold hover:text-primary">
                            {supplier.fullName}
                          </Link>
                        </TableCell>
                        <TableCell>{supplier.contactName || t.noData}</TableCell>
                        <TableCell>
                          <span className="inline-flex rounded-full bg-background px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {getCategoryLabel(supplier.category)}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-55 truncate">{supplier.email || t.noData}</TableCell>
                        <TableCell>{supplier.phone || t.noData}</TableCell>
                        <TableCell>{supplier.city || t.noData}</TableCell>
                        <TableCell className="max-w-55 truncate font-mono text-xs">{supplier.iban || t.noData}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {tags.length === 0 ? (
                              <span className="text-xs text-muted-foreground">{t.noData}</span>
                            ) : (
                              tags.map((tag) => (
                                <span
                                  key={`${supplier._id}-${tag}`}
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${tagBadgeClass(tag)}`}
                                >
                                  {tag === 'important' ? t.tagImportant : tag === 'pending' ? t.tagPending : t.tagPartner}
                                </span>
                              ))
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div data-tour-suppliers-grid className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {suppliers.map((supplier) => {
                const tags = getSupplierTags(supplier);

                return (
                  <Link
                    key={supplier._id}
                    href={`/suppliers/${supplier._id}`}
                    className="group relative flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-sm transition-all hover:shadow-md sm:p-5"
                  >
                    {/* Avatar + name */}
                    <div className="flex items-start gap-3">
                      <div className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(supplier._id)}`}>
                        {getInitials(supplier.fullName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-foreground group-hover:text-primary dark:group-hover:text-primary/80">
                          {supplier.fullName}
                        </p>
                        {supplier.contactName ? (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <Building2 className="size-3 shrink-0" strokeWidth={1.75} />
                            {supplier.contactName}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs text-muted-foreground/50">{t.noData}</p>
                        )}
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="inline-flex w-fit rounded-full bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {getCategoryLabel(supplier.category)}
                          </span>
                          {tags.map((tag) => (
                            <span
                              key={`${supplier._id}-card-${tag}`}
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${tagBadgeClass(tag)}`}
                            >
                              {tag === 'important' ? t.tagImportant : tag === 'pending' ? t.tagPending : t.tagPartner}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Contact details */}
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      {supplier.email ? (
                        <p className="flex items-center gap-2 truncate">
                          <Mail className="size-3.5 shrink-0 text-primary/50" strokeWidth={1.75} />
                          {supplier.email}
                        </p>
                      ) : null}
                      {supplier.phone ? (
                        <p className="flex items-center gap-2 truncate">
                          <Phone className="size-3.5 shrink-0 text-primary/50" strokeWidth={1.75} />
                          {supplier.phone}
                        </p>
                      ) : null}
                      {supplier.address ? (
                        <p className="flex items-center gap-2 truncate">
                          <MapPin className="size-3.5 shrink-0 text-primary/50" strokeWidth={1.75} />
                          {supplier.address}
                        </p>
                      ) : null}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3">
                      <p className="text-[11px] text-muted-foreground/60">
                        {new Date(supplier.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <span className="text-[11px] font-medium text-primary/70 opacity-0 transition-opacity group-hover:opacity-100 dark:text-primary/60">
                        {t.viewProfile}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {t.page} {pagination.page} {t.of} {Math.max(pagination.totalPages, 1)} — {pagination.total} {t.total}
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              >
                {t.previous}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={pagination.totalPages === 0 || pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                {t.next}
              </Button>
            </div>
          </div>
        </>
      )}
    </CrmShell>
  );
}
