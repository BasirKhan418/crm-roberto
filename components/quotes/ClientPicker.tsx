'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Building2Icon, PlusIcon, SearchIcon, XIcon } from 'lucide-react';

import AddClientModal from '@/components/modals/AddClientModal';
import { useLocale } from '@/components/providers/locale-provider';
import { useClients, type ClientOption } from '@/hooks/useClients';
import { Input } from '@/components/ui/input';

interface ClientPickerProps {
  value: string;
  onChange: (clientId: string) => void;
  onClientSelected: (client: ClientOption | null) => void;
}

export default function ClientPicker({ value, onChange, onClientSelected }: ClientPickerProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      searchPlaceholder: 'Search client by name or company',
      loading: 'Loading...',
      noClients: 'No clients found',
      newClient: 'New client',
      clientInfo: 'Client info',
      name: 'Name',
      company: 'Company',
      phone: 'Phone',
      email: 'Email',
      address: 'Address',
      vat: 'VAT',
      noCompany: 'No company',
      change: 'Change',
      emptyField: '-',
    },
    fr: {
      searchPlaceholder: 'Rechercher un client par nom ou entreprise',
      loading: 'Chargement...',
      noClients: 'Aucun client trouve',
      newClient: 'Nouveau client',
      clientInfo: 'Infos client',
      name: 'Nom',
      company: 'Entreprise',
      phone: 'Telephone',
      email: 'E-mail',
      address: 'Adresse',
      vat: 'TVA',
      noCompany: 'Sans entreprise',
      change: 'Changer',
      emptyField: '-',
    },
  }[locale];

  const { clients, loading, refetch } = useClients();
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);

  const selectedClient = useMemo(() => clients.find((client) => client._id === value) || null, [clients, value]);
  const inputValue = selectedClient ? (isOpen ? search : selectedClient.fullName) : search;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return clients;
    }

    return clients.filter(
      (client) =>
        client.fullName.toLowerCase().includes(term) ||
        (client.companyName || '').toLowerCase().includes(term)
    );
  }, [clients, search]);

  useEffect(() => {
    if (selectedClient) {
      onClientSelected(selectedClient);
    } else if (!value) {
      onClientSelected(null);
    }
  }, [selectedClient, value, onClientSelected]);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (!rootRef.current) {
        return;
      }

      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  function handleSelect(client: ClientOption) {
    onChange(client._id);
    onClientSelected(client);
    setSearch(client.fullName);
    setIsOpen(false);
  }

  async function handleClientCreated(createdClient: ClientOption) {
    await refetch();
    onChange(createdClient._id);
    onClientSelected(createdClient);
    setSearch(createdClient.fullName);
    setIsOpen(false);
  }

  return (
    <div ref={rootRef} className="space-y-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={inputValue}
          onFocus={() => {
            if (selectedClient) {
              setSearch(selectedClient.fullName);
            }
            setIsOpen(true);
          }}
          onChange={(event) => {
            setSearch(event.target.value);
            if (value) {
              onChange('');
            }
            setIsOpen(true);
          }}
          placeholder={t.searchPlaceholder}
          className="pl-9"
        />

        {isOpen ? (
          <div className="absolute z-30 mt-2 w-full rounded-lg border border-border bg-background p-1.5 shadow-lg">
            <div className="max-h-72 overflow-auto">
              {loading ? (
                <p className="px-2 py-2 text-xs text-muted-foreground">{t.loading}</p>
              ) : filtered.length === 0 ? (
                <p className="px-2 py-2 text-xs text-muted-foreground">{t.noClients}</p>
              ) : (
                filtered.slice(0, 8).map((client) => (
                  <button
                    key={client._id}
                    type="button"
                    className="w-full rounded-md border border-transparent px-2 py-2 text-left transition-colors hover:border-border hover:bg-muted/70"
                    onClick={() => handleSelect(client)}
                  >
                    <p className="text-sm font-medium text-foreground">{client.fullName}</p>
                    <p className="text-xs text-muted-foreground">{client.companyName || t.noCompany}</p>
                  </button>
                ))
              )}
            </div>

            <button
              type="button"
              className="mt-1 inline-flex w-full items-center gap-1 rounded-md border border-dashed border-border px-2 py-1.5 text-sm text-(--color-text-info) hover:bg-muted"
              onClick={() => {
                setShowAddModal(true);
                setIsOpen(false);
              }}
            >
              <PlusIcon className="size-3.5" />
              {t.newClient}
            </button>
          </div>
        ) : null}
      </div>

      {selectedClient ? (
        <div className="rounded-xl border border-border/70 bg-muted/30 p-3 sm:p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-base font-semibold tracking-tight">{t.clientInfo}</h3>
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2Icon className="size-3.5" />
                {selectedClient.fullName}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                onChange('');
                onClientSelected(null);
                setSearch('');
                setIsOpen(true);
              }}
            >
              <XIcon className="size-3" />
              {t.change}
            </button>
          </div>

          <div className="space-y-1.5 rounded-lg border border-border/60 bg-background/90 px-3 py-2.5 text-sm">
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
              <p className="text-muted-foreground">{t.name}</p>
              <p className="min-w-0 text-right font-medium wrap-break-word break-all">{selectedClient.fullName || t.emptyField}</p>
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
              <p className="text-muted-foreground">{t.company}</p>
              <p className="min-w-0 text-right font-medium wrap-break-word break-all">{selectedClient.companyName || t.noCompany}</p>
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
              <p className="text-muted-foreground">{t.phone}</p>
              <p className="min-w-0 text-right font-medium wrap-break-word break-all">{selectedClient.phone || t.emptyField}</p>
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
              <p className="text-muted-foreground">{t.email}</p>
              <p className="min-w-0 text-right font-medium wrap-break-word break-all">{selectedClient.email || t.emptyField}</p>
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
              <p className="text-muted-foreground">{t.address}</p>
              <p className="min-w-0 text-right font-medium wrap-break-word break-all">{selectedClient.address || t.emptyField}</p>
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
              <p className="text-muted-foreground">{t.vat}</p>
              <p className="min-w-0 text-right font-medium wrap-break-word break-all">{selectedClient.vatNumber || t.emptyField}</p>
            </div>
          </div>
        </div>
      ) : null}

      {showAddModal ? (
        <AddClientModal
          onClose={() => setShowAddModal(false)}
          onCreated={handleClientCreated}
        />
      ) : null}
    </div>
  );
}
