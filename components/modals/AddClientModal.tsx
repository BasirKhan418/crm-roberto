'use client';

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';

import { toast } from 'sonner';

import BaseAddModal from '@/components/modals/BaseAddModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocale } from '@/components/providers/locale-provider';
import { resolveTranslatedError } from '@/lib/i18n/messages';

type ClientType = 'company' | 'individual';

const TITLE_PRESETS = ['Mr', 'Mrs'] as const;

type TitlePreset = (typeof TITLE_PRESETS)[number];
type TitleSelectValue = TitlePreset | 'Other';

function isTitlePreset(value: string): value is TitlePreset {
  return TITLE_PRESETS.includes(value as TitlePreset);
}

function FieldLabel({
  text,
  required = false,
  action,
}: {
  text: string;
  required?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label>
        {text}
        {required ? <span className="ml-1 text-red-600 dark:text-red-400">*</span> : null}
      </Label>
      {action}
    </div>
  );
}

function FieldActionButton({
  text,
  onClick,
  disabled = false,
}: {
  text: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto px-0 text-xs"
      onClick={onClick}
      disabled={disabled}
    >
      {text}
    </Button>
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
      streetNumber?: string | null;
      streetName?: string | null;
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
      streetNumber?: string | null;
      streetName?: string | null;
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
      streetNumber?: string | null;
      streetName?: string | null;
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
      otherTitle: 'Other',
      customTitle: 'Custom title',
      customTitlePlaceholder: 'Enter custom title',
      firstName: 'First Name',
      lastName: 'Last Name',
      companyName: 'Company Name',
      vatNumber: 'VAT Number',
      rcsNumber: 'RCS Number',
      businessAuthorizationNumber: 'Business Authorization Number',
      matriculeNumber: 'Matricule Number',
      street: 'Street',
      streetNumber: 'Street Number',
      streetName: 'Street Name',
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
      sameAsMain: 'Same as main',
      additionalDescription: 'Additional Description',
      cancel: 'Cancel',
      saving: 'Saving...',
      saveCreate: 'Save client',
      saveEdit: 'Save changes',
    },
    fr: {
      typeRequired: 'Le type de client est requis',
      companyNameRequired: "Le nom de l'entreprise est requis",
      firstNameRequired: 'Le pr\u00e9nom est requis',
      lastNameRequired: 'Le nom est requis',
      missingClientId: 'Identifiant client manquant pour la modification',
      failedCreate: 'Impossible de cr\u00e9er le client',
      failedUpdate: 'Impossible de modifier le client',
      created: 'Client cr\u00e9\u00e9',
      updated: 'Client mis \u00e0 jour',
      addTitle: 'Ajouter un client',
      addDescription: 'Cr\u00e9ez un client depuis les actions rapides du tableau de bord.',
      editTitle: 'Modifier le client',
      editDescription: 'Mettez \u00e0 jour les informations de ce client.',
      type: 'Type de client',
      companyType: 'Entreprise',
      individualType: 'Particulier',
      titleLabel: 'Civilit\u00e9',
      otherTitle: 'Autre',
      customTitle: 'Civilit\u00e9 personnalis\u00e9e',
      customTitlePlaceholder: 'Saisissez une civilit\u00e9',
      firstName: 'Pr\u00e9nom',
      lastName: 'Nom',
      companyName: "Nom de l'entreprise",
      vatNumber: 'Num\u00e9ro TVA',
      rcsNumber: 'Num\u00e9ro RCS',
      businessAuthorizationNumber: 'Num\u00e9ro autorisation commerciale',
      matriculeNumber: 'Matricule',
      street: 'Rue',
      streetNumber: 'Numéro de rue',
      streetName: 'Nom de rue',
      postalCode: 'Code postal',
      city: 'Ville',
      country: 'Pays',
      bankName: 'Nom de la banque',
      iban: 'IBAN',
      responsibleEmail: 'E-mail responsable',
      billingEmail: 'E-mail de facturation',
      companyPhone: 'T\u00e9l\u00e9phone entreprise',
      privatePhone: 'T\u00e9l\u00e9phone priv\u00e9',
      mobilePhone: 'T\u00e9l\u00e9phone mobile',
      sameAsMain: 'Identique au principal',
      additionalDescription: 'Description compl\u00e9mentaire',
      cancel: 'Annuler',
      saving: 'Enregistrement...',
      saveCreate: 'Enregistrer le client',
      saveEdit: 'Enregistrer les modifications',
    },
  }[locale];

  const [loading, setLoading] = useState(false);
  const [titleSelection, setTitleSelection] = useState<TitleSelectValue>('Mr');
  const [customTitle, setCustomTitle] = useState('');
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
    streetNumber: '',
    streetName: '',
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
  const initializedClientIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isEditMode) {
      initializedClientIdRef.current = null;
    }

    if (!isEditMode || !initialData) {
      setTitleSelection('Mr');
      setCustomTitle('');
      return;
    }

    const currentClientId = clientId || null;
    if (initializedClientIdRef.current === currentClientId) {
      return;
    }
    initializedClientIdRef.current = currentClientId;

    const initialTitle = initialData.title?.trim() || '';
    const initialTitleSelection: TitleSelectValue = initialTitle
      ? (isTitlePreset(initialTitle) ? initialTitle : 'Other')
      : 'Mr';

    setTitleSelection(initialTitleSelection);
    setCustomTitle(initialTitleSelection === 'Other' ? initialTitle : '');

    setForm({
      clientType: (initialData.clientType as '' | ClientType | undefined) || '',
      title: initialTitleSelection === 'Other' ? initialTitle : initialTitle || 'Mr',
      firstName: initialData.firstName || '',
      lastName: initialData.lastName || '',
      companyName: initialData.companyName || '',
      vatNumber: initialData.vatNumber || '',
      rcsNumber: initialData.rcsNumber || '',
      businessAuthorizationNumber: initialData.businessAuthorizationNumber || '',
      matriculeNumber: initialData.matriculeNumber || '',
      streetNumber: initialData.addressDetails?.streetNumber || '',
      streetName: initialData.addressDetails?.streetName || '',
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
  }, [clientId, initialData, isEditMode]);

  function handleTitleSelectionChange(value: TitleSelectValue) {
    setTitleSelection(value);
    setForm((prev) => ({
      ...prev,
      title: value === 'Other' ? (customTitle || (isTitlePreset(prev.title) ? '' : prev.title)) : value,
    }));
  }

  function handleCustomTitleChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setCustomTitle(value);
    setForm((prev) => ({
      ...prev,
      title: value,
    }));
  }

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
          streetNumber: valueOr(form.streetNumber, emptyValue),
          streetName: valueOr(form.streetName, emptyValue),
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
            streetNumber?: string | null;
            streetName?: string | null;
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
      toast.error(resolveTranslatedError(locale, error, isEditMode ? t.failedUpdate : t.failedCreate));
    } finally {
      setLoading(false);
    }
  }

  const showCustomTitleField =
    form.clientType === 'individual' &&
    (titleSelection === 'Other' || (form.title.trim().length > 0 && !isTitlePreset(form.title.trim())));

  return (
    <BaseAddModal
      title={isEditMode ? t.editTitle : t.addTitle}
      description={isEditMode ? t.editDescription : t.addDescription}
      onClose={onClose}
      panelClassName="max-w-3xl"
    >
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="space-y-1.5">
          <FieldLabel text={t.type} required />
          <div className="mx-auto grid w-full max-w-sm grid-cols-1 gap-2 sm:max-w-none sm:grid-cols-2">
            <Button
              type="button"
              variant={form.clientType === 'company' ? 'default' : 'outline'}
              className="w-full"
              onClick={() => setForm((p) => ({ ...p, clientType: 'company' }))}
            >
              {t.companyType}
            </Button>
            <Button
              type="button"
              variant={form.clientType === 'individual' ? 'default' : 'outline'}
              className="w-full"
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
              <Select value={titleSelection} onValueChange={(value) => handleTitleSelectionChange(value as TitleSelectValue)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mr">Mr</SelectItem>
                  <SelectItem value="Mrs">Mrs</SelectItem>
                  <SelectItem value="Other">{t.otherTitle}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {showCustomTitleField ? (
              <div className="space-y-1.5">
                <FieldLabel text={t.customTitle} />
                <Input
                  value={customTitle}
                  placeholder={t.customTitlePlaceholder}
                  onChange={handleCustomTitleChange}
                />
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FieldLabel text={t.firstName} required /><Input value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} /></div>
              <div className="space-y-1.5"><FieldLabel text={t.lastName} required /><Input value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} /></div>
            </div>
          </>
        ) : null}

        {form.clientType ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FieldLabel text={t.streetNumber} /><Input value={form.streetNumber} onChange={(e) => setForm((p) => ({ ...p, streetNumber: e.target.value }))} /></div>
              <div className="space-y-1.5"><FieldLabel text={t.streetName} /><Input value={form.streetName} onChange={(e) => setForm((p) => ({ ...p, streetName: e.target.value }))} /></div>
              <div className="space-y-1.5"><FieldLabel text={t.postalCode} /><Input value={form.postalCode} onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))} /></div>
              <div className="space-y-1.5"><FieldLabel text={t.city} /><Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} /></div>
              <div className="space-y-1.5 sm:col-span-2"><FieldLabel text={t.country} /><Input value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FieldLabel text={t.bankName} /><Input value={form.bankName} onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))} /></div>
              <div className="space-y-1.5"><FieldLabel text={t.iban} /><Input value={form.iban} onChange={(e) => setForm((p) => ({ ...p, iban: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><FieldLabel text={t.responsibleEmail} /><Input type="email" value={form.responsibleEmail} onChange={(e) => setForm((p) => ({ ...p, responsibleEmail: e.target.value }))} /></div>
              <div className="space-y-1.5">
                <FieldLabel
                  text={t.billingEmail}
                  action={
                    <FieldActionButton
                      text={t.sameAsMain}
                      onClick={() => setForm((p) => ({ ...p, billingEmail: p.responsibleEmail }))}
                      disabled={!form.responsibleEmail.trim()}
                    />
                  }
                />
                <Input type="email" value={form.billingEmail} onChange={(e) => setForm((p) => ({ ...p, billingEmail: e.target.value }))} />
              </div>
            </div>
            {form.clientType === 'company' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><FieldLabel text={t.companyPhone} /><Input value={form.companyPhone} onChange={(e) => setForm((p) => ({ ...p, companyPhone: e.target.value }))} /></div>
                <div className="space-y-1.5">
                  <FieldLabel
                    text={t.mobilePhone}
                    action={
                      <FieldActionButton
                        text={t.sameAsMain}
                        onClick={() => setForm((p) => ({ ...p, mobilePhone: p.companyPhone }))}
                        disabled={!form.companyPhone.trim()}
                      />
                    }
                  />
                  <Input value={form.mobilePhone} onChange={(e) => setForm((p) => ({ ...p, mobilePhone: e.target.value }))} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><FieldLabel text={t.privatePhone} /><Input value={form.privatePhone} onChange={(e) => setForm((p) => ({ ...p, privatePhone: e.target.value }))} /></div>
                <div className="space-y-1.5">
                  <FieldLabel
                    text={t.mobilePhone}
                    action={
                      <FieldActionButton
                        text={t.sameAsMain}
                        onClick={() => setForm((p) => ({ ...p, mobilePhone: p.privatePhone }))}
                        disabled={!form.privatePhone.trim()}
                      />
                    }
                  />
                  <Input value={form.mobilePhone} onChange={(e) => setForm((p) => ({ ...p, mobilePhone: e.target.value }))} />
                </div>
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

      <div className="mx-auto mt-5 flex w-full max-w-2xl flex-col-reverse items-stretch justify-center gap-2 sm:flex-row sm:justify-end">
        <Button className="w-full sm:w-auto" variant="outline" onClick={onClose}>{t.cancel}</Button>
        <Button className="w-full sm:w-auto" onClick={handleSave} disabled={loading}>{loading ? t.saving : isEditMode ? t.saveEdit : t.saveCreate}</Button>
      </div>
    </BaseAddModal>
  );
}
