'use client';

import { useEffect, useMemo, useState } from 'react';

import { toast } from 'sonner';

import BaseAddModal from '@/components/modals/BaseAddModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocale } from '@/components/providers/locale-provider';

interface LinkedEntity {
  _id: string;
  fullName: string;
}

interface AddNoteModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddNoteModal({ onClose, onSuccess }: AddNoteModalProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      titleRequired: 'Note title is required',
      descriptionRequired: 'Description is required',
      dateRequired: 'Follow-up date is required',
      selectLinked: 'Please select a',
      failedCreate: 'Failed to create note',
      created: 'Note created',
      title: 'Add note',
      description: 'Create a note and schedule a follow-up date.',
      noteTitle: 'Title',
      noteDescription: 'Description',
      linkedType: 'Linked type',
      linkedRecord: 'Linked record',
      loading: 'Loading...',
      select: 'Select',
      noneAvailable: 'No',
      availableSuffix: 'available',
      client: 'Client',
      supplier: 'Supplier',
      followUp: 'Follow-up date',
      cancel: 'Cancel',
      saving: 'Saving...',
      save: 'Save note',
    },
    fr: {
      titleRequired: 'Le titre de la note est requis',
      descriptionRequired: 'La description est requise',
      dateRequired: 'La date de suivi est requise',
      selectLinked: 'Veuillez selectionner un',
      failedCreate: 'Impossible de creer la note',
      created: 'Note creee',
      title: 'Ajouter une note',
      description: 'Creez une note et planifiez une date de suivi.',
      noteTitle: 'Titre',
      noteDescription: 'Description',
      linkedType: 'Type lie',
      linkedRecord: 'Element lie',
      loading: 'Chargement...',
      select: 'Selectionner',
      noneAvailable: 'Aucun',
      availableSuffix: 'disponible',
      client: 'Client',
      supplier: 'Fournisseur',
      followUp: 'Date de suivi',
      cancel: 'Annuler',
      saving: 'Enregistrement...',
      save: 'Enregistrer la note',
    },
  }[locale];

  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [clients, setClients] = useState<LinkedEntity[]>([]);
  const [suppliers, setSuppliers] = useState<LinkedEntity[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    linkedType: 'client' as 'client' | 'supplier',
    linkedId: '',
    followUpDate: '',
  });

  const linkedOptions = useMemo(
    () => (form.linkedType === 'client' ? clients : suppliers),
    [clients, suppliers, form.linkedType]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      setOptionsLoading(true);
      try {
        const [clientsRes, suppliersRes] = await Promise.all([
          fetch('/api/clients?page=1&limit=100&sortBy=fullName&sortOrder=asc', { cache: 'no-store' }),
          fetch('/api/suppliers?page=1&limit=100&sortBy=fullName&sortOrder=asc', { cache: 'no-store' }),
        ]);

        const [clientsData, suppliersData] = await Promise.all([clientsRes.json(), suppliersRes.json()]);
        if (cancelled) {
          return;
        }

        setClients((clientsData?.data ?? []) as LinkedEntity[]);
        setSuppliers((suppliersData?.data ?? []) as LinkedEntity[]);
      } catch {
        if (!cancelled) {
          setClients([]);
          setSuppliers([]);
        }
      } finally {
        if (!cancelled) {
          setOptionsLoading(false);
        }
      }
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error(t.titleRequired);
      return;
    }
    if (!form.description.trim()) {
      toast.error(t.descriptionRequired);
      return;
    }
    if (!form.linkedId) {
      toast.error(`${t.selectLinked} ${form.linkedType === 'client' ? t.client.toLowerCase() : t.supplier.toLowerCase()}`);
      return;
    }
    if (!form.followUpDate) {
      toast.error(t.dateRequired);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          linkedType: form.linkedType,
          linkedId: form.linkedId,
          followUpDate: form.followUpDate,
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
          <Label>{t.noteTitle}</Label>
          <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>{t.noteDescription}</Label>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            rows={4}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t.linkedType}</Label>
            <Select
              value={form.linkedType}
              onValueChange={(value: 'client' | 'supplier') =>
                setForm((p) => ({ ...p, linkedType: value, linkedId: '' }))
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="client">{t.client}</SelectItem>
                <SelectItem value="supplier">{t.supplier}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.linkedRecord}</Label>
            <Select value={form.linkedId} onValueChange={(value) => setForm((p) => ({ ...p, linkedId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder={optionsLoading ? t.loading : `${t.select} ${form.linkedType === 'client' ? t.client.toLowerCase() : t.supplier.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {linkedOptions.length > 0 ? (
                  linkedOptions.map((item) => (
                    <SelectItem key={item._id} value={item._id}>
                      {item.fullName}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    {t.noneAvailable} {form.linkedType === 'client' ? `${t.client.toLowerCase()}s` : `${t.supplier.toLowerCase()}s`} {t.availableSuffix}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t.followUp}</Label>
          <Input
            type="date"
            value={form.followUpDate}
            onChange={(e) => setForm((p) => ({ ...p, followUpDate: e.target.value }))}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>{t.cancel}</Button>
        <Button onClick={handleSave} disabled={loading}>{loading ? t.saving : t.save}</Button>
      </div>
    </BaseAddModal>
  );
}
