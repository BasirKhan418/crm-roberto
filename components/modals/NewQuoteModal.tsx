'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import BaseAddModal from '@/components/modals/BaseAddModal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/components/providers/locale-provider';

interface ClientOption {
  _id: string;
  fullName: string;
}

interface NewQuoteModalProps {
  onClose: () => void;
}

export default function NewQuoteModal({ onClose }: NewQuoteModalProps) {
  const router = useRouter();
  const { locale } = useLocale();

  const t = {
    en: {
      title: 'New quote',
      description: 'Pick a client to start the quote.',
      client: 'Client',
      selectClient: 'Select a client',
      loadingClients: 'Loading clients…',
      noClients: 'No clients available',
      cancel: 'Cancel',
      continue: 'Continue',
      clientRequired: 'Please select a client',
    },
    fr: {
      title: 'Nouveau devis',
      description: 'Choisissez un client pour démarrer le devis.',
      client: 'Client',
      selectClient: 'Sélectionner un client',
      loadingClients: 'Chargement des clients…',
      noClients: 'Aucun client disponible',
      cancel: 'Annuler',
      continue: 'Continuer',
      clientRequired: 'Veuillez sélectionner un client',
    },
  }[locale];

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientId, setClientId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setClientsLoading(true);
      try {
        const response = await fetch('/api/clients?page=1&limit=200&sortBy=fullName&sortOrder=asc', {
          cache: 'no-store',
        });
        const data = (await response.json()) as { data?: ClientOption[] };
        if (!cancelled) {
          setClients(data.data ?? []);
        }
      } catch {
        if (!cancelled) {
          setClients([]);
        }
      } finally {
        if (!cancelled) {
          setClientsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleContinue() {
    if (!clientId) {
      setError(t.clientRequired);
      return;
    }

    router.push(`/quotes/new?clientId=${encodeURIComponent(clientId)}`);
    onClose();
  }

  return (
    <BaseAddModal title={t.title} description={t.description} onClose={onClose}>
      {/* Client */}
      <div className="space-y-1.5">
        <Label htmlFor="new-quote-client">{t.client}</Label>
        <select
          id="new-quote-client"
          value={clientId}
          disabled={clientsLoading}
          onChange={(e) => {
            setClientId(e.target.value);
            setError('');
          }}
          className="flex h-9 w-full appearance-none rounded-lg border border-input bg-background px-3 py-1 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <option value="">
            {clientsLoading ? t.loadingClients : clients.length === 0 ? t.noClients : t.selectClient}
          </option>
          {clients.map((c) => (
            <option key={c._id} value={c._id}>
              {c.fullName}
            </option>
          ))}
        </select>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      {/* Footer */}
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button type="button" className="flex-1" disabled={clientsLoading} onClick={handleContinue}>
          {t.continue}
        </Button>
      </div>
    </BaseAddModal>
  );
}
