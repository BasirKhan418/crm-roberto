'use client';

import { useCallback, useEffect, useState } from 'react';

import { BoxesIcon, PlusIcon } from 'lucide-react';

import LineItemRow, { type CatalogueItemOption, type QuoteLineItem } from '@/components/quotes/LineItemRow';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import ErrorMessage from '@/components/ui/ErrorMessage';

interface CatalogueApiResponse {
  success: boolean;
  message?: string;
  data?: CatalogueItemOption[];
}

interface LineItemsBuilderProps {
  lineItems: QuoteLineItem[];
  onChange: (items: QuoteLineItem[]) => void;
}

const EMPTY_ROW: QuoteLineItem = {
  productId: null,
  name: '',
  quantity: 1,
  unitPriceExcludingTax: 0,
  vatRate: 17,
};

export default function LineItemsBuilder({ lineItems, onChange }: LineItemsBuilderProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      loadError: 'Failed to load products/services',
      product: 'Product',
      name: 'Name',
      qty: 'Qty',
      unitPrice: 'Unit price',
      vat: 'VAT %',
      total: 'Total',
      noItemsTitle: 'No items yet',
      noItemsSubtitle: 'Click Add a line to start building this quote.',
      addLine: 'Add a line',
    },
    fr: {
      loadError: 'Impossible de charger les produits/services',
      product: 'Produit',
      name: 'Nom',
      qty: 'Qte',
      unitPrice: 'Prix unitaire',
      vat: 'TVA %',
      total: 'Total',
      noItemsTitle: 'Aucune ligne',
      noItemsSubtitle: 'Cliquez sur Ajouter une ligne pour commencer ce devis.',
      addLine: 'Ajouter une ligne',
    },
  }[locale];

  const [products, setProducts] = useState<CatalogueItemOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('/api/catalogue?page=1&limit=100&sortBy=name&sortOrder=asc', { cache: 'no-store' });
      const payload = (await response.json()) as CatalogueApiResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t.loadError);
      }

      setProducts(payload.data ?? []);
    } catch (fetchError) {
      setProducts([]);
      setError(fetchError instanceof Error ? fetchError.message : t.loadError);
    }
  }, [t.loadError]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const updateRow = useCallback(
    (index: number, patch: Partial<QuoteLineItem>) => {
      onChange(lineItems.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
    },
    [lineItems, onChange]
  );

  const removeRow = useCallback(
    (index: number) => {
      onChange(lineItems.filter((_, idx) => idx !== index));
    },
    [lineItems, onChange]
  );

  const addRow = useCallback(() => {
    onChange([...lineItems, { ...EMPTY_ROW }]);
  }, [lineItems, onChange]);

  return (
    <section className="space-y-3">
      <div className="hidden items-center gap-2 rounded-md border border-dashed border-border/70 bg-secondary/30 px-2 py-1.5 text-xs font-semibold uppercase text-muted-foreground md:grid md:grid-cols-[2.2fr_2fr_0.8fr_1.2fr_0.8fr_1fr_auto]">
        <span>{t.product}</span>
        <span>{t.name}</span>
        <span>{t.qty}</span>
        <span>{t.unitPrice}</span>
        <span>{t.vat}</span>
        <span className="text-right">{t.total}</span>
        <span />
      </div>

      {error ? <ErrorMessage message={error} /> : null}

      {lineItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/80 bg-linear-to-b from-background to-secondary/20 px-4 py-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 text-foreground/90">
            <BoxesIcon className="size-4" />
            <span className="font-medium">{t.noItemsTitle}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t.noItemsSubtitle}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lineItems.map((row, index) => (
            <LineItemRow
              key={`line-item-${index}`}
              index={index}
              row={row}
              products={products}
              onChange={updateRow}
              onDelete={removeRow}
            />
          ))}
        </div>
      )}

      <Button type="button" variant="outline" className="gap-1.5" onClick={addRow}>
        <PlusIcon className="size-4" />
        {t.addLine}
      </Button>
    </section>
  );
}
