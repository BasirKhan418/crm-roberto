'use client';

import { useState } from 'react';

import { toast } from 'sonner';

import BaseAddModal from '@/components/modals/BaseAddModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/components/providers/locale-provider';
import { resolveTranslatedError } from '@/lib/i18n/messages';

interface AddSupplierModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddSupplierModal({ onClose, onSuccess }: AddSupplierModalProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      nameRequired: 'Supplier name is required',
      failedCreate: 'Failed to create supplier',
      created: 'Supplier created',
      title: 'Add supplier',
      description: 'Create a supplier from dashboard quick actions.',
      legalName: 'Company legal name',
      contactName: 'Contact name',
      email: 'Email',
      phone: 'Phone',
      address: 'Street name',
      streetNumber: 'Street number',
      postalCode: 'Postal code',
      city: 'City',
      country: 'Country',
      vat: 'VAT/Tax ID',
      iban: 'IBAN',
      notes: 'Notes',
      cancel: 'Cancel',
      saving: 'Saving...',
      save: 'Save supplier',
    },
    fr: {
      nameRequired: 'Le nom du fournisseur est requis',
      failedCreate: 'Impossible de créer le fournisseur',
      created: 'Fournisseur créé',
      title: 'Ajouter un fournisseur',
      description: 'Créez un fournisseur depuis les actions rapides du tableau de bord.',
      legalName: 'Raison sociale',
      contactName: 'Nom du contact',
      email: 'E-mail',
      phone: 'Téléphone',
      address: 'Nom de rue',
      streetNumber: 'Numéro de rue',
      postalCode: 'Code postal',
      city: 'Ville',
      country: 'Pays',
      vat: 'TVA/ID fiscal',
      iban: 'IBAN',
      notes: 'Notes',
      cancel: 'Annuler',
      saving: 'Enregistrement...',
      save: 'Enregistrer le fournisseur',
    },
  }[locale];

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    contactName: '',
    email: '',
    phone: '',
    streetNumber: '',
    address: '',
    postalCode: '',
    city: '',
    country: '',
    vatNumber: '',
    iban: '',
    notes: '',
  });

  async function handleSave() {
    if (!form.fullName.trim()) {
      toast.error(t.nameRequired);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName,
          contactName: form.contactName || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          streetNumber: form.streetNumber || undefined,
          address: form.address || undefined,
          postalCode: form.postalCode || undefined,
          city: form.city || undefined,
          country: form.country || undefined,
          vatNumber: form.vatNumber || undefined,
          iban: form.iban || undefined,
          notes: form.notes || undefined,
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
      toast.error(resolveTranslatedError(locale, error, t.failedCreate));
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
          <Label>{t.legalName}</Label>
          <Input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>{t.contactName}</Label>
          <Input value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} />
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
          <Label>{t.streetNumber}</Label>
          <Input value={form.streetNumber} onChange={(e) => setForm((p) => ({ ...p, streetNumber: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>{t.address}</Label>
          <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t.postalCode}</Label>
            <Input value={form.postalCode} onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.city}</Label>
            <Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t.country}</Label>
          <Input value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t.vat}</Label>
            <Input value={form.vatNumber} onChange={(e) => setForm((p) => ({ ...p, vatNumber: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.iban}</Label>
            <Input value={form.iban} onChange={(e) => setForm((p) => ({ ...p, iban: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t.notes}</Label>
          <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>{t.cancel}</Button>
        <Button onClick={handleSave} disabled={loading}>{loading ? t.saving : t.save}</Button>
      </div>
    </BaseAddModal>
  );
}
