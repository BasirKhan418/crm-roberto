'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { BoxesIcon, PackageIcon, PlusIcon, SearchIcon, WrenchIcon, XIcon } from 'lucide-react';

import LineItemRow, { type CatalogueItemOption, type QuoteLineItem } from '@/components/quotes/LineItemRow';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ErrorMessage from '@/components/ui/ErrorMessage';

interface CatalogueApiResponse {
  success: boolean;
  message?: string;
  data?: CatalogueItemOption[];
}

interface LineItemsBuilderProps {
  lineItems: QuoteLineItem[];
  onChange: (items: QuoteLineItem[]) => void;
  mode?: 'quote' | 'invoice';
}

const EMPTY_ROW: QuoteLineItem = {
  productId: null,
  productImageUrl: null,
  name: '',
  quantity: 1,
  baseUnitPriceExcludingTax: 0,
  unitPriceExcludingTax: 0,
  discountPercentage: 0,
  vatRate: 17,
  lineType: 'custom',
};

export default function LineItemsBuilder({ lineItems, onChange, mode = 'quote' }: LineItemsBuilderProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      loadError: 'Failed to load products/services',
      product: 'Product',
      discount: 'Discount %',
      discountAmount: 'Discount HT',
      qty: 'Qty',
      unitPrice: 'Unit HT',
      vat: 'VAT %',
      totalExclTax: 'Total HT',
      totalInclTax: 'Total TTC',
      noItemsTitle: 'No items yet',
      noItemsSubtitle: 'Click Add a line to start building this quote.',
      addLine: 'Add a line',
      addProductService: 'Add product / service',
      addFreeTextLine: 'Add free text',
      addCustomLine: 'Add custom line',
      pickerTitle: 'Add product / service',
      pickerSearch: 'Search...',
      pickerEmpty: 'No products found',
      pickerAddBlank: 'Add custom line',
      pickerClose: 'Close',
    },
    fr: {
      loadError: 'Impossible de charger les produits/services',
      product: 'Produit',
      discount: 'Remise %',
      discountAmount: 'Remise HT',
      qty: 'Qt\u00e9',
      unitPrice: 'Unit. HT',
      vat: 'TVA %',
      totalExclTax: 'Total HT',
      totalInclTax: 'Total TTC',
      noItemsTitle: 'Aucune ligne',
      noItemsSubtitle: 'Cliquez sur Ajouter une ligne pour commencer ce devis.',
      addLine: 'Ajouter une ligne',
      addProductService: 'Ajouter produit / service',
      addFreeTextLine: 'Ajouter texte libre',
      addCustomLine: 'Ajouter ligne personnalisée',
      pickerTitle: 'Ajouter un produit / service',
      pickerSearch: 'Rechercher...',
      pickerEmpty: 'Aucun produit trouv\u00e9',
      pickerAddBlank: 'Ligne personnalis\u00e9e',
      pickerClose: 'Fermer',
    },
  }[locale];

  const [products, setProducts] = useState<CatalogueItemOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

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

  const addBlankRow = useCallback(() => {
    onChange([...lineItems, { ...EMPTY_ROW, lineType: 'custom' }]);
    setPickerOpen(false);
    setPickerSearch('');
  }, [lineItems, onChange]);

  const addFreeTextRow = useCallback(() => {
    onChange([
      ...lineItems,
      {
        ...EMPTY_ROW,
        lineType: 'free_text',
        vatRate: 0,
      },
    ]);
    setPickerOpen(false);
    setPickerSearch('');
  }, [lineItems, onChange]);

  const addProductRow = useCallback(
    (product: CatalogueItemOption) => {
      const newRow: QuoteLineItem = {
        lineType: 'catalog',
        productId: product._id,
        productImageUrl:
          product.attachmentUrl && /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(product.attachmentUrl)
            ? product.attachmentUrl
            : null,
        name: product.name,
        quantity: 1,
        baseUnitPriceExcludingTax: product.priceExcludingTax,
        unitPriceExcludingTax: product.priceExcludingTax,
        discountPercentage: 0,
        vatRate: product.vatRate,
      };
      onChange([...lineItems, newRow]);
      setPickerOpen(false);
      setPickerSearch('');
    },
    [lineItems, onChange]
  );

  const filteredProducts = useMemo(() => {
    const term = pickerSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => p.name.toLowerCase().includes(term));
  }, [products, pickerSearch]);

  return (
    <>
      {/* ── Product picker modal ─────────────────────────────── */}
      {pickerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { setPickerOpen(false); setPickerSearch(''); }}
          />
          {/* Panel — always centred, capped to available visual viewport */}
          <div
            className="relative z-10 flex w-full max-w-md flex-col rounded-2xl border border-border bg-background shadow-xl"
            style={{ maxHeight: 'min(calc(var(--app-viewport-height, 100dvh) - 32px), 560px)' }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3">
              <h3 className="font-heading text-base font-semibold">{t.pickerTitle}</h3>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                onClick={() => { setPickerOpen(false); setPickerSearch(''); }}
                aria-label={t.pickerClose}
              >
                <XIcon className="size-4" />
              </button>
            </div>

            {/* Search — stays pinned below header, always visible */}
            <div className="relative shrink-0 px-4 py-2.5">
              <SearchIcon className="pointer-events-none absolute left-7 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder={t.pickerSearch}
                className="pl-9"
              />
            </div>

            {/* Product list — scrollable middle section */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
              {error ? <ErrorMessage message={error} /> : null}
              {filteredProducts.length === 0 && !error ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t.pickerEmpty}</p>
              ) : (
                <div className="space-y-1">
                  {filteredProducts.map((product) => (
                    <button
                      key={product._id}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left hover:border-border hover:bg-muted/60 active:bg-muted"
                      onClick={() => addProductRow(product)}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                        {product.type === 'product' ? <PackageIcon className="size-4" /> : <WrenchIcon className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.type === 'product' ? 'Product' : 'Service'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer: add blank — always visible, pinned above keyboard */}
            {mode === 'quote' ? (
              <div className="shrink-0 border-t border-border/70 px-4 py-3">
                <Button type="button" variant="outline" className="w-full" onClick={addBlankRow}>
                  <PlusIcon className="size-4" />
                  {t.pickerAddBlank}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="hidden items-center gap-2 rounded-md border border-dashed border-border/70 bg-secondary/30 px-2 py-1.5 text-xs font-semibold uppercase text-muted-foreground md:grid md:grid-cols-[2fr_0.7fr_1.2fr_0.9fr_1.1fr_0.7fr_1fr_1fr_auto]">
          <span>{t.product}</span>
          <span>{t.qty}</span>
          <span className="text-right">{t.unitPrice}</span>
          <span className="text-right">{t.discount}</span>
          <span className="text-right">{t.discountAmount}</span>
          <span className="text-right">{t.vat}</span>
          <span className="text-right">{t.totalExclTax}</span>
          <span className="text-right">{t.totalInclTax}</span>
          <span />
        </div>

        {error && !pickerOpen ? <ErrorMessage message={error} /> : null}

        {lineItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-linear-to-b from-background to-secondary/20 px-4 py-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground/90">
              <BoxesIcon className="size-4" />
              <span className="font-medium">{t.noItemsTitle}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t.noItemsSubtitle}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
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

        {mode === 'invoice' ? (
          <div className="grid grid-cols-1 gap-2 pt-1 md:grid-cols-3 md:pt-0">
            <Button type="button" className="h-10 w-full gap-2 bg-primary text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90" onClick={() => setPickerOpen(true)}>
              <PlusIcon className="size-4" />
              {t.addProductService}
            </Button>
            <Button type="button" variant="outline" className="h-10 w-full gap-2 border-primary/40 text-sm font-semibold text-primary hover:bg-primary/10 hover:text-primary" onClick={addFreeTextRow}>
              <PlusIcon className="size-4" />
              {t.addFreeTextLine}
            </Button>
            <Button type="button" variant="outline" className="h-10 w-full gap-2 border-primary/40 text-sm font-semibold text-primary hover:bg-primary/10 hover:text-primary" onClick={addBlankRow}>
              <PlusIcon className="size-4" />
              {t.addCustomLine}
            </Button>
          </div>
        ) : (
          <div className="pt-1 md:pt-0">
            <Button type="button" className="h-10 w-full gap-2 bg-primary text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 md:w-auto" onClick={() => setPickerOpen(true)}>
              <PlusIcon className="size-4" />
              {t.addLine}
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
