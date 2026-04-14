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

interface NewInvoiceModalProps {
  onClose: () => void;
}

export default function NewInvoiceModal({ onClose }: NewInvoiceModalProps) {
  const router = useRouter();
  const { locale } = useLocale();

  const t = {
    en: {
      title: 'New invoice',
      description: 'Pick a client and a due date to start the invoice.',
      client: 'Client',
      selectClient: 'Select a client',
      loadingClients: 'Loading clients…',
      noClients: 'No clients available',
      dueDate: 'Due date',
      cancel: 'Cancel',
      continue: 'Continue',
      clientRequired: 'Please select a client',
      dueDateRequired: 'Due date is required',
    },
    fr: {
      title: 'Nouvelle facture',
      description: 'Choisissez un client et une échéance pour démarrer la facture.',
      client: 'Client',
      selectClient: 'Sélectionner un client',
      loadingClients: 'Chargement des clients…',
      noClients: 'Aucun client disponible',
      dueDate: 'Échéance',
      cancel: 'Annuler',
      continue: 'Continuer',
      clientRequired: 'Veuillez sélectionner un client',
      dueDateRequired: "L'échéance est requise",
    },
  }[locale];

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientId, setClientId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<{ clientId?: string; dueDate?: string }>({});

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
    const nextErrors: { clientId?: string; dueDate?: string } = {};
    if (!clientId) nextErrors.clientId = t.clientRequired;
    if (!dueDate) nextErrors.dueDate = t.dueDateRequired;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const params = new URLSearchParams({ clientId, dueDate });
    router.push(`/invoices/new?${params.toString()}`);
    onClose();
  }

  return (
    <BaseAddModal title={t.title} description={t.description} onClose={onClose}>
      {/* Client */}
      <div className="space-y-1.5">
        <Label htmlFor="new-invoice-client">{t.client}</Label>
        <select
          id="new-invoice-client"
          value={clientId}
          disabled={clientsLoading}
          onChange={(e) => setClientId(e.target.value)}
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
        {errors.clientId ? <p className="text-xs text-destructive">{errors.clientId}</p> : null}
      </div>

      {/* Due date */}
      <div className="space-y-1.5">
        <Label htmlFor="new-invoice-due">{t.dueDate}</Label>
        <input
          id="new-invoice-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {errors.dueDate ? <p className="text-xs text-destructive">{errors.dueDate}</p> : null}
      </div>

      {/* Footer */}
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button type="button" className="flex-1" onClick={handleContinue}>
          {t.continue}
        </Button>
      </div>
    </BaseAddModal>
  );
}
