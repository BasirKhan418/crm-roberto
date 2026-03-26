'use client';

import { useState } from 'react';

import { toast } from 'sonner';

import BaseAddModal from '@/components/modals/BaseAddModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/components/providers/locale-provider';

interface AddClientModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddClientModal({ onClose, onSuccess }: AddClientModalProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      nameRequired: 'Client name is required',
      failedCreate: 'Failed to create client',
      created: 'Client created',
      title: 'Add client',
      description: 'Create a client from dashboard quick actions.',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      address: 'Address',
      company: 'Company',
      vat: 'VAT/Tax ID',
      cancel: 'Cancel',
      saving: 'Saving...',
      save: 'Save client',
    },
    fr: {
      nameRequired: 'Le nom du client est requis',
      failedCreate: 'Impossible de creer le client',
      created: 'Client cree',
      title: 'Ajouter un client',
      description: 'Creez un client depuis les actions rapides du tableau de bord.',
      name: 'Nom',
      email: 'E-mail',
      phone: 'Telephone',
      address: 'Adresse',
      company: 'Entreprise',
      vat: 'TVA/ID fiscal',
      cancel: 'Annuler',
      saving: 'Enregistrement...',
      save: 'Enregistrer le client',
    },
  }[locale];

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    companyName: '',
    vatNumber: '',
  });

  async function handleSave() {
    if (!form.fullName.trim()) {
      toast.error(t.nameRequired);
      return;
    }

    setLoading(true);
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
        throw new Error(data.message || t.failedCreate);
      }

      toast.success(t.created);
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.failedCreate);
    } finally {
      setLoading(false);
    }
  }

  return (
    <BaseAddModal
      title={t.title}
      description={t.description}
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>{t.name}</Label>
          <Input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>{t.email}</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>{t.phone}</Label>
          <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>{t.address}</Label>
          <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t.company}</Label>
            <Input value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.vat}</Label>
            <Input value={form.vatNumber} onChange={(e) => setForm((p) => ({ ...p, vatNumber: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>{t.cancel}</Button>
        <Button onClick={handleSave} disabled={loading}>{loading ? t.saving : t.save}</Button>
      </div>
    </BaseAddModal>
  );
}
