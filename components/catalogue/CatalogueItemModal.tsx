'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Loader2, PaperclipIcon, UploadIcon, X } from 'lucide-react';

import { createCatalogueItemSchema, updateCatalogueItemSchema } from '@/validators/catalogue.schema';
import { resolveTranslatedText } from '@/lib/i18n/messages';
import { centsToEuros, eurosToCents } from '@/lib/price';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type CatalogueType = 'product' | 'service';
type CatalogueCurrency = 'EUR';
const VAT_PRESET_OPTIONS = [17, 8, 3, 0, 20] as const;
const ALLOWED_ATTACHMENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;
const MAX_ATTACHMENT_SIZE = 8 * 1024 * 1024;

function isImageMimeType(value?: string | null): boolean {
  return Boolean(value && value.startsWith('image/'));
}

export interface CatalogueItemFormValue {
  _id: string;
  name: string;
  type: CatalogueType;
  priceExcludingTax: number;
  priceIncludingTax: number;
  vatRate: number;
  currency: CatalogueCurrency;
  description?: string | null;
  attachmentUrl?: string | null;
  attachmentKey?: string | null;
  attachmentMimeType?: string | null;
  attachmentName?: string | null;
}

interface CatalogueItemModalProps {
  open: boolean;
  mode: 'add' | 'edit';
  item?: CatalogueItemFormValue | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

interface FieldErrors {
  name?: string;
  type?: string;
  priceInput?: string;
  priceIncludingTax?: string;
  vatRate?: string;
  currency?: string;
  description?: string;
  attachment?: string;
}

function issueToField(path: PropertyKey[]): keyof FieldErrors | null {
  const first = path[0];
  if (typeof first !== 'string') {
    return null;
  }

  if (first === 'name') return 'name';
  if (first === 'type') return 'type';
  if (first === 'vatRate') return 'vatRate';
  if (first === 'description') return 'description';
  if (first === 'priceExcludingTax') return 'priceInput';
  if (first === 'priceIncludingTax') return 'priceIncludingTax';
  if (first === 'currency') return 'currency';
  if (first === 'attachmentUrl' || first === 'attachmentKey' || first === 'attachmentMimeType' || first === 'attachmentName') {
    return 'attachment';
  }
  return null;
}

export default function CatalogueItemModal({ open, mode, item, onClose, onSaved }: CatalogueItemModalProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      newTitle: 'New product/service',
      editTitle: 'Edit',
      close: 'Close modal',
      subtitleAdd: 'Create a reusable catalogue item for quotes.',
      subtitleEdit: 'Update this catalogue item.',
      name: 'Name',
      type: 'Type',
      product: 'Product',
      service: 'Service',
      priceExcludingTax: 'Unit price HT',
      priceIncludingTax: 'Unit price TTC',
      vatRate: 'VAT rate',
      vatCustom: 'Custom VAT',
      vatOther: 'Other',
      currency: 'Currency',
      currencyEur: 'EUR',
      attachment: 'Attachment',
      viewAttachment: 'View file',
      replaceAttachment: 'Replace file',
      uploadAttachment: 'Upload file',
      removeAttachment: 'Remove file',
      uploading: 'Uploading...',
      attachmentHint: 'PNG, JPG, WEBP, GIF or PDF (max 8 MB)',
      description: 'Description',
      descriptionPlaceholder: 'Optional details about this item',
      cancel: 'Cancel',
      saveAdd: 'Save item',
      saveEdit: 'Save changes',
      saving: 'Saving...',
      genericError: 'Failed to save item',
      requiredName: 'Name is required',
      requiredType: 'Type is required',
      requiredPrice: 'Price is required',
      requiredVat: 'VAT rate is required',
      attachmentTypeError: 'Unsupported file type',
      attachmentSizeError: 'File is too large (max 8 MB)',
      attachmentUploadError: 'Failed to upload file',
    },
    fr: {
      newTitle: 'Nouveau produit/service',
      editTitle: 'Modifier',
      close: 'Fermer la fenêtre',
      subtitleAdd: 'Créez un élément catalogue réutilisable pour les devis.',
      subtitleEdit: 'Mettez à jour cet élément catalogue.',
      name: 'Nom',
      type: 'Type',
      product: 'Produit',
      service: 'Service',
      priceExcludingTax: 'Prix Unitaire HT',
      priceIncludingTax: 'Prix Unitaire TTC',
      vatRate: 'Taux TVA',
      vatCustom: 'TVA personnalisée',
      vatOther: 'Autre',
      currency: 'Devise',
      currencyEur: 'EUR',
      attachment: 'Pièce jointe',
      viewAttachment: 'Voir le fichier',
      replaceAttachment: 'Remplacer le fichier',
      uploadAttachment: 'Ajouter une pièce jointe',
      removeAttachment: 'Retirer la pièce jointe',
      uploading: 'Téléchargement...',
      attachmentHint: 'PNG, JPG, WEBP, GIF ou PDF (max 8 Mo)',
      description: 'Description',
      descriptionPlaceholder: 'Détails optionnels sur cet élément',
      cancel: 'Annuler',
      saveAdd: "Enregistrer l'élément",
      saveEdit: 'Enregistrer les modifications',
      saving: 'Enregistrement...',
      genericError: "Impossible d'enregistrer l'élément",
      requiredName: 'Le nom est requis',
      requiredType: 'Le type est requis',
      requiredPrice: 'Le prix est requis',
      requiredVat: 'Le taux TVA est requis',
      attachmentTypeError: 'Type de fichier non supporté',
      attachmentSizeError: 'Le fichier est trop volumineux (max 8 Mo)',
      attachmentUploadError: 'Impossible de télécharger la pièce jointe',
    },
  }[locale];

  const [name, setName] = useState('');
  const [type, setType] = useState<CatalogueType | ''>('');
  const [priceInput, setPriceInput] = useState('');
  const [vatRate, setVatRate] = useState('17');
  const [vatMode, setVatMode] = useState<'preset' | 'custom'>('preset');
  const [currency, setCurrency] = useState<CatalogueCurrency>('EUR');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentKey, setAttachmentKey] = useState<string | null>(null);
  const [attachmentMimeType, setAttachmentMimeType] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const modalBodyRef = useRef<HTMLDivElement | null>(null);

  const unitPriceExcludingTax = useMemo(() => {
    const parsed = Number(priceInput);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [priceInput]);

  const unitPriceIncludingTax = useMemo(
    () => unitPriceExcludingTax * (1 + Number(vatRate || 0) / 100),
    [unitPriceExcludingTax, vatRate]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === 'edit' && item) {
      setName(item.name);
      setType(item.type);
      setPriceInput(centsToEuros(item.priceExcludingTax));
      setVatRate(String(item.vatRate));
      setVatMode(VAT_PRESET_OPTIONS.includes(item.vatRate as (typeof VAT_PRESET_OPTIONS)[number]) ? 'preset' : 'custom');
      setCurrency(item.currency ?? 'EUR');
      setAttachmentUrl(item.attachmentUrl ?? null);
      setAttachmentKey(item.attachmentKey ?? null);
      setAttachmentMimeType(item.attachmentMimeType ?? null);
      setAttachmentName(item.attachmentName ?? null);
      setDescription(item.description ?? '');
    } else {
      setName('');
      setType('');
      setPriceInput('');
      setVatRate('17');
      setVatMode('preset');
      setCurrency('EUR');
      setAttachmentUrl(null);
      setAttachmentKey(null);
      setAttachmentMimeType(null);
      setAttachmentName(null);
      setDescription('');
    }

    setApiError(null);
    setErrors({});
  }, [open, mode, item]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function scrollFieldIntoView(target: EventTarget | null) {
      const container = modalBodyRef.current;
      if (!(target instanceof HTMLElement) || !container || !container.contains(target)) {
        return;
      }

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
          const targetRect = target.getBoundingClientRect();
          const desiredBottom = viewportHeight - 88;

          if (targetRect.bottom > desiredBottom || targetRect.top < 16) {
            target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
          }
        });
      });
    }

    function handleFocusIn(event: FocusEvent) {
      scrollFieldIntoView(event.target);
    }

    function handleViewportChange() {
      scrollFieldIntoView(document.activeElement);
    }

    const viewport = window.visualViewport;

    document.addEventListener('focusin', handleFocusIn);
    viewport?.addEventListener('resize', handleViewportChange);
    viewport?.addEventListener('scroll', handleViewportChange);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      viewport?.removeEventListener('resize', handleViewportChange);
      viewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, [open]);

  const title = useMemo(() => {
    if (mode === 'edit' && item?.name) {
      return `${t.editTitle} ${item.name}`;
    }

    return t.newTitle;
  }, [mode, item, t]);

  async function handleAttachmentFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setErrors((prev) => ({ ...prev, attachment: undefined }));

    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type as (typeof ALLOWED_ATTACHMENT_TYPES)[number])) {
      setErrors((prev) => ({ ...prev, attachment: t.attachmentTypeError }));
      event.target.value = '';
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
      setErrors((prev) => ({ ...prev, attachment: t.attachmentSizeError }));
      event.target.value = '';
      return;
    }

    setUploadingAttachment(true);
    try {
      const presignRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          folder: 'catalogue',
        }),
      });

      const presignJson = (await presignRes.json()) as {
        success?: boolean;
        message?: string;
        uploadUrl?: string;
        fileUrl?: string;
        key?: string;
      };

      if (!presignRes.ok || !presignJson.success || !presignJson.uploadUrl || !presignJson.fileUrl || !presignJson.key) {
        throw new Error(presignJson.message || t.attachmentUploadError);
      }

      const uploadRes = await fetch(presignJson.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(t.attachmentUploadError);
      }

      setAttachmentUrl(presignJson.fileUrl);
      setAttachmentKey(presignJson.key);
      setAttachmentMimeType(file.type);
      setAttachmentName(file.name);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        attachment: error instanceof Error ? error.message : t.attachmentUploadError,
      }));
    } finally {
      setUploadingAttachment(false);
      event.target.value = '';
    }
  }

  function removeAttachment() {
    setAttachmentUrl(null);
    setAttachmentKey(null);
    setAttachmentMimeType(null);
    setAttachmentName(null);
    setErrors((prev) => ({ ...prev, attachment: undefined }));
  }

  async function handleSubmit() {
    setErrors({});
    setApiError(null);

    if (!name.trim() || !priceInput.trim() || !vatRate.trim()) {
      setErrors({
        name: !name.trim() ? t.requiredName : undefined,
        type: !type ? t.requiredType : undefined,
        priceInput: !priceInput.trim() ? t.requiredPrice : undefined,
        vatRate: !vatRate.trim() ? t.requiredVat : undefined,
      });
      return;
    }

    const payload = {
      name,
      type,
      priceExcludingTax: eurosToCents(priceInput),
        priceIncludingTax: Math.round(unitPriceIncludingTax * 100),
      vatRate: Number(vatRate),
        currency,
        attachmentUrl,
        attachmentKey,
        attachmentMimeType,
        attachmentName,
      description: description.trim() ? description : undefined,
    };

    const parsed = mode === 'add'
      ? createCatalogueItemSchema.safeParse(payload)
      : updateCatalogueItemSchema.safeParse(payload);

    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issueToField(issue.path);
        if (field && !nextErrors[field]) {
          nextErrors[field] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const endpoint = mode === 'add' ? '/api/catalogue' : `/api/catalogue/${item?._id}`;
      const method = mode === 'add' ? 'POST' : 'PATCH';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        fieldErrors?: Record<string, string[]>;
      };

      if (!response.ok || !data.success) {
        const apiFieldErrors = data.fieldErrors ?? {};
        setErrors((prev) => ({
          ...prev,
          name: apiFieldErrors.name?.[0] ?? prev.name,
          priceInput: apiFieldErrors.priceExcludingTax?.[0] ?? prev.priceInput,
          priceIncludingTax: apiFieldErrors.priceIncludingTax?.[0] ?? prev.priceIncludingTax,
          vatRate: apiFieldErrors.vatRate?.[0] ?? prev.vatRate,
          currency: apiFieldErrors.currency?.[0] ?? prev.currency,
          type: apiFieldErrors.type?.[0] ?? prev.type,
          description: apiFieldErrors.description?.[0] ?? prev.description,
          attachment:
            apiFieldErrors.attachmentUrl?.[0] ??
            apiFieldErrors.attachmentKey?.[0] ??
            apiFieldErrors.attachmentMimeType?.[0] ??
            apiFieldErrors.attachmentName?.[0] ??
            prev.attachment,
        }));
        throw new Error(data.message || t.genericError);
      }

      await onSaved();
      onClose();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : t.genericError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="flex w-[calc(100vw-1rem)] max-w-2xl max-h-[calc(100dvh-1rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))] flex-col gap-2.5 overflow-hidden p-3.5 [&_input[data-slot=input]]:focus-visible:ring-2 [&_input[data-slot=input]]:focus-visible:ring-inset [&_select]:focus-visible:ring-2 [&_select]:focus-visible:ring-inset [&_textarea]:focus-visible:ring-2 [&_textarea]:focus-visible:ring-inset sm:max-h-[calc(100dvh-2rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))] sm:p-5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-3 right-3"
          aria-label={t.close}
          onClick={onClose}
          disabled={saving}
        >
          <X className="size-4" />
        </Button>

        <DialogHeader className="gap-1 px-1">
          <DialogTitle className="pr-8 text-base sm:text-lg">{title}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">{mode === 'add' ? t.subtitleAdd : t.subtitleEdit}</DialogDescription>
        </DialogHeader>

        {apiError ? <ErrorMessage message={apiError} /> : null}

        <div ref={modalBodyRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-1 pt-0.5 text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="catalogue-name" className="text-xs">{t.name}</Label>
            <Input
              id="catalogue-name"
              className="text-sm md:text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name ? <p className="text-xs text-destructive">{resolveTranslatedText(locale, errors.name)}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t.type}</Label>
            <div className={`grid grid-cols-2 rounded-lg border p-1.5 ${errors.type ? 'border-destructive' : 'border-border'}`}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`${
                  type === 'product'
                    ? 'bg-(--color-background-info) text-(--color-text-info) hover:bg-(--color-background-info) hover:text-(--color-text-info)'
                    : 'text-foreground/75 hover:bg-muted/60 hover:text-foreground'
                }`}
                onClick={() => setType('product')}
              >
                {t.product}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`${
                  type === 'service'
                    ? 'bg-[#EEEDFE] text-[#2E245F] hover:bg-[#EEEDFE] hover:text-[#2E245F]'
                    : 'text-foreground/75 hover:bg-muted/60 hover:text-foreground'
                }`}
                onClick={() => setType('service')}
              >
                {t.service}
              </Button>
            </div>
            {errors.type ? <p className="text-xs text-destructive">{resolveTranslatedText(locale, errors.type)}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="catalogue-price" className="text-xs">{t.priceExcludingTax}</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                <Input
                  id="catalogue-price"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  className="no-number-spinner pl-6.5 text-sm md:text-sm"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  aria-invalid={Boolean(errors.priceInput)}
                />
              </div>
              {errors.priceInput ? <p className="text-xs text-destructive">{resolveTranslatedText(locale, errors.priceInput)}</p> : null}
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="catalogue-vat-select" className="text-xs">{t.vatRate}</Label>
              <select
                id="catalogue-vat-select"
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm leading-none shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={vatMode === 'custom' ? 'other' : vatRate}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === 'other') {
                    setVatMode('custom');
                    if (VAT_PRESET_OPTIONS.includes(Number(vatRate) as (typeof VAT_PRESET_OPTIONS)[number])) {
                      setVatRate('');
                    }
                    return;
                  }

                  setVatMode('preset');
                  setVatRate(next);
                }}
              >
                {VAT_PRESET_OPTIONS.map((value) => (
                  <option key={value} value={String(value)}>
                    {value}%
                  </option>
                ))}
                <option value="other">{t.vatOther}</option>
              </select>
              {vatMode === 'custom' ? (
                <div className="relative">
                  <Input
                    id="catalogue-vat-custom"
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    className="no-number-spinner pr-6.5 text-sm md:text-sm"
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    placeholder={t.vatCustom}
                    aria-invalid={Boolean(errors.vatRate)}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[13px] text-muted-foreground">%</span>
                </div>
              ) : null}
              {errors.vatRate ? <p className="text-xs text-destructive">{resolveTranslatedText(locale, errors.vatRate)}</p> : null}
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="catalogue-price-ttc" className="text-xs">{t.priceIncludingTax}</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                <Input
                  id="catalogue-price-ttc"
                  value={unitPriceIncludingTax.toFixed(2)}
                  readOnly
                  className="pl-6.5 text-sm md:text-sm bg-muted/30"
                />
              </div>
              {errors.priceIncludingTax ? <p className="text-xs text-destructive">{resolveTranslatedText(locale, errors.priceIncludingTax)}</p> : null}
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="catalogue-currency" className="text-xs">{t.currency}</Label>
              <Input id="catalogue-currency" value={currency} readOnly className="text-sm md:text-sm bg-muted/30" />
              {errors.currency ? <p className="text-xs text-destructive">{resolveTranslatedText(locale, errors.currency)}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">{t.attachment}</Label>
            <div className="rounded-lg border border-border/70 bg-background px-3 py-2">
              {attachmentUrl ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    {isImageMimeType(attachmentMimeType) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={attachmentUrl}
                        alt={attachmentName || 'Attachment preview'}
                        className="h-10 w-10 rounded-md border border-border/70 object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <PaperclipIcon className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <p className="truncate text-xs text-foreground/90">{attachmentName || attachmentUrl}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <a
                      href={attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center justify-center rounded-md border border-input px-2.5 text-xs hover:bg-muted/60"
                    >
                      {t.viewAttachment}
                    </a>

                    <label className="inline-flex">
                      <input
                        type="file"
                        className="hidden"
                        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                        onChange={handleAttachmentFileChange}
                        disabled={uploadingAttachment || saving}
                      />
                      <span className="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input px-2.5 text-xs hover:bg-muted/60">
                        {uploadingAttachment ? <Loader2 className="size-3.5 animate-spin" /> : <UploadIcon className="size-3.5" />}
                        {uploadingAttachment ? t.uploading : t.replaceAttachment}
                      </span>
                    </label>

                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={removeAttachment} disabled={saving || uploadingAttachment}>
                      {t.removeAttachment}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">{t.attachmentHint}</p>
                  <label className="inline-flex">
                    <input
                      type="file"
                      className="hidden"
                      accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                      onChange={handleAttachmentFileChange}
                      disabled={uploadingAttachment || saving}
                    />
                    <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-input px-2.5 text-xs hover:bg-muted/60">
                      {uploadingAttachment ? <Loader2 className="size-3.5 animate-spin" /> : <UploadIcon className="size-3.5" />}
                      {uploadingAttachment ? t.uploading : t.uploadAttachment}
                    </span>
                  </label>
                </div>
              )}
            </div>
            {errors.attachment ? <p className="text-xs text-destructive">{resolveTranslatedText(locale, errors.attachment)}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="catalogue-description" className="text-xs">{t.description}</Label>
            <textarea
              id="catalogue-description"
              className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive sm:text-sm"
              placeholder={t.descriptionPlaceholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description ? <p className="text-xs text-destructive">{resolveTranslatedText(locale, errors.description)}</p> : null}
          </div>
        </div>

        <DialogFooter className="border-t border-border/70 bg-popover px-1 pt-2.5 flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={onClose} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="button" size="sm" className="w-full sm:w-auto" onClick={handleSubmit} disabled={saving}>
            {saving ? t.saving : mode === 'add' ? t.saveAdd : t.saveEdit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
