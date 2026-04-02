'use client';

import { useEffect, useState } from 'react';

import { toast } from 'sonner';

import BaseAddModal from '@/components/modals/BaseAddModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocale } from '@/components/providers/locale-provider';

type ClientType = 'company' | 'individual';

function FieldLabel({
  text,
  required = false,
}: {
  text: string;
  required?: boolean;
}) {
  return (
    <Label>
      {text}
      {required ? <span className="ml-1 text-red-600 dark:text-red-400">*</span> : null}
    </Label>
  );
}

interface AddClientModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
  clientId?: string;
  initialData?: {
    clientType?: ClientType | null;
    title?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    vatNumber?: string | null;
    rcsNumber?: string | null;
    businessAuthorizationNumber?: string | null;
    matriculeNumber?: string | null;
    bankName?: string | null;
    iban?: string | null;
    responsibleEmail?: string | null;
    billingEmail?: string | null;
    companyPhone?: string | null;
    privatePhone?: string | null;
    mobilePhone?: string | null;
    additionalDescription?: string | null;
    billingAddress?: string | null;
    addressDetails?: {
      street?: string | null;
      postalCode?: string | null;
      city?: string | null;
      country?: string | null;
    } | null;
  };
  onCreated?: (client: {
    _id: string;
    clientType?: ClientType;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    companyName?: string | null;
    vatNumber?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    title?: string | null;
    rcsNumber?: string | null;
    businessAuthorizationNumber?: string | null;
    matriculeNumber?: string | null;
    bankName?: string | null;
    iban?: string | null;
    responsibleEmail?: string | null;
    companyPhone?: string | null;
    privatePhone?: string | null;
    mobilePhone?: string | null;
    additionalDescription?: string | null;
    addressDetails?: {
      street?: string | null;
      postalCode?: string | null;
      city?: string | null;
      country?: string | null;
    } | null;
  }) => void;
  onUpdated?: (client: {
    _id: string;
    clientType?: ClientType;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    companyName?: string | null;
    vatNumber?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    title?: string | null;
    rcsNumber?: string | null;
    businessAuthorizationNumber?: string | null;
    matriculeNumber?: string | null;
    bankName?: string | null;
    iban?: string | null;
    responsibleEmail?: string | null;
    billingEmail?: string | null;
    companyPhone?: string | null;
    privatePhone?: string | null;
    mobilePhone?: string | null;
    additionalDescription?: string | null;
    billingAddress?: string | null;
    addressDetails?: {
      street?: string | null;
      postalCode?: string | null;
      city?: string | null;
      country?: string | null;
    } | null;
  }) => void;
}

export default function AddClientModal({
  onClose,
  onSuccess,
  mode = 'create',
  clientId,
  initialData,
  onCreated,
  onUpdated,
}: AddClientModalProps) {
  const isEditMode = mode === 'edit';
  const { locale } = useLocale();
  const t = {
    en: {
      typeRequired: 'Client type is required',
      companyNameRequired: 'Company name is required',
      firstNameRequired: 'First name is required',
      lastNameRequired: 'Last name is required',
      missingClientId: 'Client id is missing for edit',
      failedCreate: 'Failed to create client',
      failedUpdate: 'Failed to update client',
      created: 'Client created',
      updated: 'Client updated',
      addTitle: 'Add client',
      addDescription: 'Create a client from dashboard quick actions.',
      editTitle: 'Edit client',
      editDescription: 'Update this client information.',
      type: 'Client type',
      companyType: 'Company',
      individualType: 'Individual',
      titleLabel: 'Title',
      firstName: 'First Name',
      lastName: 'Last Name',
      companyName: 'Company Name',
      vatNumber: 'VAT Number',
      rcsNumber: 'RCS Number',
      businessAuthorizationNumber: 'Business Authorization Number',
      matriculeNumber: 'Matricule Number',
      street: 'Street',
      postalCode: 'Postal Code',
      city: 'City',
      country: 'Country',
      bankName: 'Bank Name',
      iban: 'IBAN',
      responsibleEmail: 'Responsible Email',
      billingEmail: 'Billing Email',
      companyPhone: 'Company Phone',
      privatePhone: 'Private Phone',
      mobilePhone: 'Mobile Phone',
      additionalDescription: 'Additional Description',
      cancel: 'Cancel',
      saving: 'Saving...',
      saveCreate: 'Save client',
      saveEdit: 'Save changes',
    },
    fr: {
      typeRequired: 'Le type de client est requis',
      companyNameRequired: 'Le nom de l entreprise est requis',
      firstNameRequired: 'Le prenom est requis',
      lastNameRequired: 'Le nom est requis',
      missingClientId: 'Identifiant client manquant pour la modification',
      failedCreate: 'Impossible de creer le client',
      failedUpdate: 'Impossible de modifier le client',
      created: 'Client cree',
      updated: 'Client mis a jour',
      addTitle: 'Ajouter un client',
      addDescription: 'Creez un client depuis les actions rapides du tableau de bord.',
      editTitle: 'Modifier le client',
      editDescription: 'Mettez a jour les informations de ce client.',
      type: 'Type de client',
      companyType: 'Entreprise',
      individualType: 'Particulier',
      titleLabel: 'Civilite',
      firstName: 'Prenom',
      lastName: 'Nom',
      companyName: 'Nom de l entreprise',
      vatNumber: 'Numero TVA',
      rcsNumber: 'Numero RCS',
      businessAuthorizationNumber: 'Numero autorisation commerciale',
      matriculeNumber: 'Matricule',
      street: 'Rue',
      postalCode: 'Code postal',
      city: 'Ville',
      country: 'Pays',
      bankName: 'Nom de la banque',
      iban: 'IBAN',
      responsibleEmail: 'E-mail responsable',
      billingEmail: 'E-mail de facturation',
      companyPhone: 'Telephone entreprise',
      privatePhone: 'Telephone prive',
      mobilePhone: 'Telephone mobile',
      additionalDescription: 'Description complementaire',
      cancel: 'Annuler',
      saving: 'Enregistrement...',
      saveCreate: 'Enregistrer le client',
      saveEdit: 'Enregistrer les modifications',
    },
  }[locale];

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    clientType: '' as '' | ClientType,
    title: 'Mr',
    firstName: '',
    lastName: '',
    companyName: '',
    vatNumber: '',
    rcsNumber: '',
    businessAuthorizationNumber: '',
    matriculeNumber: '',
    street: '',
    postalCode: '',
    city: '',
    country: '',
    bankName: '',
    iban: '',
    responsibleEmail: '',
    billingEmail: '',
    companyPhone: '',
    privatePhone: '',
    mobilePhone: '',
    additionalDescription: '',
  });

  useEffect(() => {
    if (!isEditMode || !initialData) {
      return;
    }

    setForm({
      clientType: (initialData.clientType as '' | ClientType | undefined) || '',
      title: initialData.title || 'Mr',
      firstName: initialData.firstName || '',
      lastName: initialData.lastName || '',
      companyName: initialData.companyName || '',
      vatNumber: initialData.vatNumber || '',
      rcsNumber: initialData.rcsNumber || '',
      businessAuthorizationNumber: initialData.businessAuthorizationNumber || '',
      matriculeNumber: initialData.matriculeNumber || '',
      street: initialData.addressDetails?.street || '',
      postalCode: initialData.addressDetails?.postalCode || '',
      city: initialData.addressDetails?.city || '',
      country: initialData.addressDetails?.country || '',
      bankName: initialData.bankName || '',
      iban: initialData.iban || '',
      responsibleEmail: initialData.responsibleEmail || '',
      billingEmail: initialData.billingEmail || '',
      companyPhone: initialData.companyPhone || '',
      privatePhone: initialData.privatePhone || '',
      mobilePhone: initialData.mobilePhone || '',
      additionalDescription: initialData.additionalDescription || '',
    });
  }, [initialData, isEditMode]);

  async function handleSave() {
    if (!form.clientType) {
      toast.error(t.typeRequired);
      return;
    }
    if (form.clientType === 'company' && !form.companyName.trim()) {
      toast.error(t.companyNameRequired);
      return;
    }
    if (form.clientType === 'individual' && !form.firstName.trim()) {
      toast.error(t.firstNameRequired);
      return;
    }
    if (form.clientType === 'individual' && !form.lastName.trim()) {
      toast.error(t.lastNameRequired);
      return;
    }

    setLoading(true);
    try {
      if (isEditMode && !clientId) {
        throw new Error(t.missingClientId);
      }

      const valueOr = (value: string, whenEmpty: null | undefined) => {
        const trimmed = value.trim();
        return trimmed ? trimmed : whenEmpty;
      };
      const emptyValue = isEditMode ? null : undefined;

      const payload = {
        clientType: form.clientType,
        fullName:
          form.clientType === 'company'
            ? form.companyName.trim()
            : `${form.firstName} ${form.lastName}`.trim(),
        companyName: form.clientType === 'company' ? valueOr(form.companyName, emptyValue) : emptyValue,
        title: form.clientType === 'individual' ? valueOr(form.title, emptyValue) : emptyValue,
        firstName: form.clientType === 'individual' ? valueOr(form.firstName, emptyValue) : emptyValue,
        lastName: form.clientType === 'individual' ? valueOr(form.lastName, emptyValue) : emptyValue,
        vatNumber: form.clientType === 'company' ? valueOr(form.vatNumber, emptyValue) : emptyValue,
        rcsNumber: form.clientType === 'company' ? valueOr(form.rcsNumber, emptyValue) : emptyValue,
        businessAuthorizationNumber:
          form.clientType === 'company' ? valueOr(form.businessAuthorizationNumber, emptyValue) : emptyValue,
        matriculeNumber: form.clientType === 'company' ? valueOr(form.matriculeNumber, emptyValue) : emptyValue,
        addressDetails: {
          street: valueOr(form.street, emptyValue),
          postalCode: valueOr(form.postalCode, emptyValue),
          city: valueOr(form.city, emptyValue),
          country: valueOr(form.country, emptyValue),
        },
        bankName: valueOr(form.bankName, emptyValue),
        iban: valueOr(form.iban, emptyValue),
        responsibleEmail: valueOr(form.responsibleEmail, emptyValue),
        billingEmail: valueOr(form.billingEmail, emptyValue),
        companyPhone: form.clientType === 'company' ? valueOr(form.companyPhone, emptyValue) : emptyValue,
        privatePhone: form.clientType === 'individual' ? valueOr(form.privatePhone, emptyValue) : emptyValue,
        mobilePhone: valueOr(form.mobilePhone, emptyValue),
        additionalDescription: valueOr(form.additionalDescription, emptyValue),
        billingAddress: isEditMode ? (initialData?.billingAddress ?? null) : undefined,
      };

      const endpoint = isEditMode ? `/api/clients/${clientId}` : '/api/clients';
      const method = isEditMode ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        success: boolean;
        message?: string;
        data?: {
          _id: string;
          clientType?: ClientType;
          fullName: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          companyName?: string | null;
          vatNumber?: string | null;
          firstName?: string | null;
          lastName?: string | null;
          title?: string | null;
          rcsNumber?: string | null;
          businessAuthorizationNumber?: string | null;
          matriculeNumber?: string | null;
          bankName?: string | null;
          iban?: string | null;
          responsibleEmail?: string | null;
          billingEmail?: string | null;
          companyPhone?: string | null;
          privatePhone?: string | null;
          mobilePhone?: string | null;
          additionalDescription?: string | null;
          addressDetails?: {
            street?: string | null;
            postalCode?: string | null;
            city?: string | null;
            country?: string | null;
          } | null;
        };
      };
      if (!response.ok || !data.success) {
        throw new Error(data.message || (isEditMode ? t.failedUpdate : t.failedCreate));
      }

      toast.success(isEditMode ? t.updated : t.created);
      if (data.data) {
        if (isEditMode) {
          onUpdated?.(data.data);
        } else {
          onCreated?.(data.data);
        }
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (isEditMode ? t.failedUpdate : t.failedCreate));
    } finally {
      setLoading(false);
    }
  }

  return (
    <BaseAddModal
      title={isEditMode ? t.editTitle : t.addTitle}
      description={isEditMode ? t.editDescription : t.addDescription}
      onClose={onClose}
      panelClassName="max-w-3xl"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <FieldLabel text={t.type} required />
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={form.clientType === 'company' ? 'default' : 'outline'}
              onClick={() => setForm((p) => ({ ...p, clientType: 'company' }))}
            >
              {t.companyType}
            </Button>
            <Button
              type="button"
              variant={form.clientType === 'individual' ? 'default' : 'outline'}
              onClick={() => setForm((p) => ({ ...p, clientType: 'individual' }))}
            >
              {t.individualType}
            </Button>
          </div>
        </div>

        {form.clientType === 'company' ? (
          <>
            <div className="space-y-1.5"><FieldLabel text={t.companyName} required /><Input value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FieldLabel text={t.vatNumber} /><Input value={form.vatNumber} onChange={(e) => setForm((p) => ({ ...p, vatNumber: e.target.value }))} /></div>
              <div className="space-y-1.5"><FieldLabel text={t.rcsNumber} /><Input value={form.rcsNumber} onChange={(e) => setForm((p) => ({ ...p, rcsNumber: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FieldLabel text={t.businessAuthorizationNumber} /><Input value={form.businessAuthorizationNumber} onChange={(e) => setForm((p) => ({ ...p, businessAuthorizationNumber: e.target.value }))} /></div>
              <div className="space-y-1.5"><FieldLabel text={t.matriculeNumber} /><Input value={form.matriculeNumber} onChange={(e) => setForm((p) => ({ ...p, matriculeNumber: e.target.value }))} /></div>
            </div>
          </>
        ) : null}

        {form.clientType === 'individual' ? (
          <>
            <div className="space-y-1.5">
              <FieldLabel text={t.titleLabel} />
              <Select value={form.title} onValueChange={(value) => setForm((p) => ({ ...p, title: value }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mr">Mr</SelectItem>
                  <SelectItem value="Mrs">Mrs</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FieldLabel text={t.firstName} required /><Input value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} /></div>
              <div className="space-y-1.5"><FieldLabel text={t.lastName} required /><Input value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} /></div>
            </div>
          </>
        ) : null}

        {form.clientType ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FieldLabel text={t.street} /><Input value={form.street} onChange={(e) => setForm((p) => ({ ...p, street: e.target.value }))} /></div>
              <div className="space-y-1.5"><FieldLabel text={t.postalCode} /><Input value={form.postalCode} onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FieldLabel text={t.city} /><Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} /></div>
              <div className="space-y-1.5"><FieldLabel text={t.country} /><Input value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FieldLabel text={t.bankName} /><Input value={form.bankName} onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))} /></div>
              <div className="space-y-1.5"><FieldLabel text={t.iban} /><Input value={form.iban} onChange={(e) => setForm((p) => ({ ...p, iban: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FieldLabel text={t.responsibleEmail} /><Input type="email" value={form.responsibleEmail} onChange={(e) => setForm((p) => ({ ...p, responsibleEmail: e.target.value }))} /></div>
              <div className="space-y-1.5"><FieldLabel text={t.billingEmail} /><Input type="email" value={form.billingEmail} onChange={(e) => setForm((p) => ({ ...p, billingEmail: e.target.value }))} /></div>
            </div>
            {form.clientType === 'company' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><FieldLabel text={t.companyPhone} /><Input value={form.companyPhone} onChange={(e) => setForm((p) => ({ ...p, companyPhone: e.target.value }))} /></div>
                <div className="space-y-1.5"><FieldLabel text={t.mobilePhone} /><Input value={form.mobilePhone} onChange={(e) => setForm((p) => ({ ...p, mobilePhone: e.target.value }))} /></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><FieldLabel text={t.privatePhone} /><Input value={form.privatePhone} onChange={(e) => setForm((p) => ({ ...p, privatePhone: e.target.value }))} /></div>
                <div className="space-y-1.5"><FieldLabel text={t.mobilePhone} /><Input value={form.mobilePhone} onChange={(e) => setForm((p) => ({ ...p, mobilePhone: e.target.value }))} /></div>
              </div>
            )}
            <div className="space-y-1.5">
              <FieldLabel text={t.additionalDescription} />
              <textarea
                className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={form.additionalDescription}
                onChange={(e) => setForm((p) => ({ ...p, additionalDescription: e.target.value }))}
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>{t.cancel}</Button>
        <Button onClick={handleSave} disabled={loading}>{loading ? t.saving : isEditMode ? t.saveEdit : t.saveCreate}</Button>
      </div>
    </BaseAddModal>
  );
}
