'use client';

import { useEffect, useMemo, useState } from 'react';

import { createCatalogueItemSchema, updateCatalogueItemSchema } from '@/validators/catalogue.schema';
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

export interface CatalogueItemFormValue {
  _id: string;
  name: string;
  type: CatalogueType;
  priceExcludingTax: number;
  vatRate: number;
  description?: string | null;
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
  vatRate?: string;
  description?: string;
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
  return null;
}

export default function CatalogueItemModal({ open, mode, item, onClose, onSaved }: CatalogueItemModalProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      newTitle: 'New product/service',
      editTitle: 'Edit',
      subtitleAdd: 'Create a reusable catalogue item for quotes.',
      subtitleEdit: 'Update this catalogue item.',
      name: 'Name',
      type: 'Type',
      product: 'Product',
      service: 'Service',
      priceExcludingTax: 'Price excl. tax',
      vatRate: 'VAT rate',
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
    },
    fr: {
      newTitle: 'Nouveau produit/service',
      editTitle: 'Modifier',
      subtitleAdd: 'Creez un element catalogue reutilisable pour les devis.',
      subtitleEdit: 'Mettez a jour cet element catalogue.',
      name: 'Nom',
      type: 'Type',
      product: 'Produit',
      service: 'Service',
      priceExcludingTax: 'Prix HT',
      vatRate: 'Taux TVA',
      description: 'Description',
      descriptionPlaceholder: 'Details optionnels sur cet element',
      cancel: 'Annuler',
      saveAdd: 'Enregistrer l\'element',
      saveEdit: 'Enregistrer les modifications',
      saving: 'Enregistrement...',
      genericError: 'Impossible d\'enregistrer l\'element',
      requiredName: 'Le nom est requis',
      requiredType: 'Le type est requis',
      requiredPrice: 'Le prix est requis',
      requiredVat: 'Le taux TVA est requis',
    },
  }[locale];

  const [name, setName] = useState('');
  const [type, setType] = useState<CatalogueType | ''>('');
  const [priceInput, setPriceInput] = useState('');
  const [vatRate, setVatRate] = useState('17');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === 'edit' && item) {
      setName(item.name);
      setType(item.type);
      setPriceInput(centsToEuros(item.priceExcludingTax));
      setVatRate(String(item.vatRate));
      setDescription(item.description ?? '');
    } else {
      setName('');
      setType('');
      setPriceInput('');
      setVatRate('17');
      setDescription('');
    }

    setApiError(null);
    setErrors({});
  }, [open, mode, item]);

  const title = useMemo(() => {
    if (mode === 'edit' && item?.name) {
      return `${t.editTitle} ${item.name}`;
    }

    return t.newTitle;
  }, [mode, item, t]);

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
      vatRate: Number(vatRate),
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
          vatRate: apiFieldErrors.vatRate?.[0] ?? prev.vatRate,
          type: apiFieldErrors.type?.[0] ?? prev.type,
          description: apiFieldErrors.description?.[0] ?? prev.description,
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
      <DialogContent className="max-w-120 p-6 sm:p-7">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{mode === 'add' ? t.subtitleAdd : t.subtitleEdit}</DialogDescription>
        </DialogHeader>

        {apiError ? <ErrorMessage message={apiError} /> : null}

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="catalogue-name">{t.name}</Label>
            <Input
              id="catalogue-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>{t.type}</Label>
            <div className={`grid grid-cols-2 rounded-lg border p-1.5 ${errors.type ? 'border-destructive' : 'border-border'}`}>
              <Button
                type="button"
                variant="ghost"
                className={`h-8 ${
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
                className={`h-8 ${
                  type === 'service'
                    ? 'bg-[#EEEDFE] text-[#2E245F] hover:bg-[#EEEDFE] hover:text-[#2E245F]'
                    : 'text-foreground/75 hover:bg-muted/60 hover:text-foreground'
                }`}
                onClick={() => setType('service')}
              >
                {t.service}
              </Button>
            </div>
            {errors.type ? <p className="text-xs text-destructive">{errors.type}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="catalogue-price">{t.priceExcludingTax}</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                <Input
                  id="catalogue-price"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  className="pl-7"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  aria-invalid={Boolean(errors.priceInput)}
                />
              </div>
              {errors.priceInput ? <p className="text-xs text-destructive">{errors.priceInput}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="catalogue-vat">{t.vatRate}</Label>
              <div className="relative">
                <Input
                  id="catalogue-vat"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  className="pr-7"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  aria-invalid={Boolean(errors.vatRate)}
                />
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[13px] text-muted-foreground">%</span>
              </div>
              {errors.vatRate ? <p className="text-xs text-destructive">{errors.vatRate}</p> : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="catalogue-description">{t.description}</Label>
            <textarea
              id="catalogue-description"
              className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
              placeholder={t.descriptionPlaceholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description ? <p className="text-xs text-destructive">{errors.description}</p> : null}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? t.saving : mode === 'add' ? t.saveAdd : t.saveEdit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
