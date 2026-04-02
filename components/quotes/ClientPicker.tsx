'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

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
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const dropdownAnchorRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAdjustedOpenRef = useRef(false);

  function updateDropdownPosition() {
    const anchor = dropdownAnchorRef.current;
    if (!anchor) {
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportOffsetTop = viewport?.offsetTop ?? 0;
    const viewportOffsetLeft = viewport?.offsetLeft ?? 0;
    const horizontalPadding = 8;
    const verticalPadding = 8;
    const gap = 8;
    const availableBelow = Math.max(
      0,
      viewportOffsetTop + viewportHeight - rect.bottom - gap - verticalPadding
    );
    const left = Math.max(
      viewportOffsetLeft + horizontalPadding,
      Math.min(rect.left, viewportOffsetLeft + viewportWidth - rect.width - horizontalPadding)
    );

    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + gap,
      left,
      width: rect.width,
      maxHeight: Math.max(96, Math.min(260, availableBelow)),
    });
  }

  // Nudge the page only when there is not enough visible room below the input
  // for the dropdown. The global keyboard manager already handles the main
  // focus scroll, so this correction needs to stay small.
  function scrollAnchorIntoView() {
    const anchor = dropdownAnchorRef.current;
    if (!anchor) return;

    const vp = window.visualViewport;
    const vpHeight = vp?.height ?? window.innerHeight;
    const vpOffsetTop = vp?.offsetTop ?? 0;
    const rect = anchor.getBoundingClientRect();

    const desiredDropdownSpace = Math.min(220, Math.max(160, vpHeight * 0.38));
    const currentSpaceBelow = vpOffsetTop + vpHeight - rect.bottom - 16;
    const missingSpace = desiredDropdownSpace - currentSpaceBelow;

    if (missingSpace > 24) {
      window.scrollBy({
        top: Math.min(missingSpace, 180),
        behavior: 'smooth',
      });
    }
  }

  function openDropdown({ adjustViewport = false }: { adjustViewport?: boolean } = {}) {
    setIsOpen(true);
    if (!adjustViewport || hasAdjustedOpenRef.current) {
      return;
    }

    hasAdjustedOpenRef.current = true;
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      scrollAnchorIntoView();
    }, 380);
  }

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
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      setDropdownStyle(null);
      return;
    }

    updateDropdownPosition();

    let recheckTimer: ReturnType<typeof setTimeout> | null = null;
    const handleUpdate = () => updateDropdownPosition();
    const viewport = window.visualViewport;

    recheckTimer = setTimeout(handleUpdate, 420);

    window.addEventListener('resize', handleUpdate);
    document.addEventListener('scroll', handleUpdate, true);
    viewport?.addEventListener('resize', handleUpdate);
    viewport?.addEventListener('scroll', handleUpdate);

    return () => {
      if (recheckTimer) {
        clearTimeout(recheckTimer);
      }
      window.removeEventListener('resize', handleUpdate);
      document.removeEventListener('scroll', handleUpdate, true);
      viewport?.removeEventListener('resize', handleUpdate);
      viewport?.removeEventListener('scroll', handleUpdate);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      hasAdjustedOpenRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedClient) {
      onClientSelected(selectedClient);
    } else if (!value) {
      onClientSelected(null);
    }
  }, [selectedClient, value, onClientSelected]);

  useEffect(() => {
    function handleOutside(event: PointerEvent) {
      if (!rootRef.current) {
        return;
      }

      const target = event.target as Node;
      if (!rootRef.current.contains(target) && !dropdownRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, []);

  function handleSelect(client: ClientOption) {
    onChange(client._id);
    onClientSelected(client);
    setSearch(client.fullName);
    setIsOpen(false);

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
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
      <div ref={dropdownAnchorRef} className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={inputValue}
          onFocus={() => {
            if (selectedClient) {
              setSearch(selectedClient.fullName);
            }
            openDropdown({ adjustViewport: true });
          }}
          onChange={(event) => {
            setSearch(event.target.value);
            if (value) {
              onChange('');
            }
            openDropdown();
          }}
          placeholder={t.searchPlaceholder}
          className="pl-9"
        />

      </div>

      {isOpen && dropdownStyle
        ? createPortal(
            <div
              ref={dropdownRef}
              className="z-70 flex flex-col overflow-hidden rounded-lg border border-border bg-background p-1.5 shadow-lg"
              style={dropdownStyle}
            >
              <div className="min-h-0 overflow-auto overscroll-contain">
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
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
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
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  setShowAddModal(true);
                  setIsOpen(false);
                }}
              >
                <PlusIcon className="size-3.5" />
                {t.newClient}
              </button>
            </div>,
            document.body
          )
        : null}

      {selectedClient ? (
        <div className="rounded-xl border border-border/70 bg-muted/30 p-3 sm:p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
              <p className="text-muted-foreground">{t.name}</p>
              <p className="min-w-0 font-medium wrap-break-word break-all sm:text-right">{selectedClient.fullName || t.emptyField}</p>
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
              <p className="text-muted-foreground">{t.company}</p>
              <p className="min-w-0 font-medium wrap-break-word break-all sm:text-right">{selectedClient.companyName || t.noCompany}</p>
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
              <p className="text-muted-foreground">{t.phone}</p>
              <p className="min-w-0 font-medium wrap-break-word break-all sm:text-right">{selectedClient.phone || t.emptyField}</p>
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
              <p className="text-muted-foreground">{t.email}</p>
              <p className="min-w-0 font-medium wrap-break-word break-all sm:text-right">{selectedClient.email || t.emptyField}</p>
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
              <p className="text-muted-foreground">{t.address}</p>
              <p className="min-w-0 font-medium wrap-break-word break-all sm:text-right">{selectedClient.address || t.emptyField}</p>
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
              <p className="text-muted-foreground">{t.vat}</p>
              <p className="min-w-0 font-medium wrap-break-word break-all sm:text-right">{selectedClient.vatNumber || t.emptyField}</p>
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
