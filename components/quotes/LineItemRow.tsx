'use client';

import { useMemo, useState } from 'react';

import { Trash2Icon } from 'lucide-react';

import { centsToEuros, eurosToCents } from '@/lib/price';
import { useLocale } from '@/components/providers/locale-provider';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface CatalogueItemOption {
  _id: string;
  name: string;
  type: 'product' | 'service';
  priceExcludingTax: number;
  vatRate: number;
  attachmentUrl?: string | null;
  attachmentMimeType?: string | null;
  description?: string | null;
}

export interface QuoteLineItem {
  productId: string | null;
  productImageUrl?: string | null;
  name: string;
  quantity: number;
  unitPriceExcludingTax: number;
  vatRate: number;
}

interface LineItemRowProps {
  row: QuoteLineItem;
  index: number;
  products: CatalogueItemOption[];
  onChange: (index: number, patch: Partial<QuoteLineItem>) => void;
  onDelete: (index: number) => void;
}

function isImageMimeType(value?: string | null): boolean {
  return Boolean(value && value.startsWith('image/'));
}

function isImageAttachment(url?: string | null, mime?: string | null): boolean {
  if (isImageMimeType(mime)) {
    return true;
  }

  if (!url) {
    return false;
  }

  return /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(url);
}

export default function LineItemRow({ row, index, products, onChange, onDelete }: LineItemRowProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      product: 'Product',
      name: 'Name',
      qty: 'Qty',
      unitPrice: 'Unit price',
      vatRate: 'VAT %',
      vatAmount: 'VAT',
      total: 'Total',
      totalExclTax: 'Total HT',
      totalInclTax: 'Total TTC',
      removeLine: 'Delete line',
      searchPlaceholder: 'Search product/service',
      lineNamePlaceholder: 'Line name',
      noMatches: 'No matches',
    },
    fr: {
      product: 'Produit',
      name: 'Nom',
      qty: 'Qte',
      unitPrice: 'Prix unitaire',
      vatRate: 'TVA %',
      vatAmount: 'TVA',
      total: 'Total',
      totalExclTax: 'Total HT',
      totalInclTax: 'Total TTC',
      removeLine: 'Supprimer la ligne',
      searchPlaceholder: 'Rechercher un produit/service',
      lineNamePlaceholder: 'Nom de ligne',
      noMatches: 'Aucun resultat',
    },
  }[locale];

  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return products;
    }

    return products.filter((item) => item.name.toLowerCase().includes(term));
  }, [products, search]);

  const rowTotalCents = row.unitPriceExcludingTax * row.quantity;
  const rowVatCents = Math.round(rowTotalCents * (row.vatRate / 100));
  const rowTotalInclCents = rowTotalCents + rowVatCents;

  function handleProductSelect(product: CatalogueItemOption) {
    onChange(index, {
      productId: product._id,
      productImageUrl: isImageAttachment(product.attachmentUrl, product.attachmentMimeType) ? product.attachmentUrl ?? null : null,
      name: product.name,
      unitPriceExcludingTax: product.priceExcludingTax,
      vatRate: product.vatRate,
    });
    setSearch(product.name);
    setIsOpen(false);
  }

  return (
    <div className="rounded-xl border border-border/70 bg-linear-to-b from-background to-secondary/25 p-3 md:p-3.5">
      <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-[2.2fr_2fr_0.8fr_1.2fr_0.8fr_1.6fr_auto] md:items-start">
        <div className="relative sm:col-span-2 md:col-span-1">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:hidden">{t.product}</p>
          <Input
            value={search || row.name}
            onFocus={() => setIsOpen(true)}
            onChange={(event) => {
              const next = event.target.value;
              setSearch(next);
              onChange(index, { name: next, productId: null, productImageUrl: null });
              setIsOpen(true);
            }}
            placeholder={t.searchPlaceholder}
          />
          {row.productImageUrl ? (
            <img
              src={row.productImageUrl}
              alt={row.name || 'Product'}
              className="mt-1 h-7 w-7 rounded border border-border/60 object-cover"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
          {isOpen ? (
            <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-md border border-border bg-background p-1 shadow-lg">
              {filtered.length === 0 ? (
                <p className="px-2 py-1 text-xs text-muted-foreground">{t.noMatches}</p>
              ) : (
                filtered.slice(0, 8).map((product) => (
                  <button
                    key={product._id}
                    type="button"
                    className="w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
                    onClick={() => handleProductSelect(product)}
                  >
                    <span className="inline-flex items-center gap-2">
                      {product.attachmentUrl && isImageAttachment(product.attachmentUrl, product.attachmentMimeType) ? (
                        <img
                          src={product.attachmentUrl}
                          alt={product.name}
                          className="h-6 w-6 rounded object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                      <span className="font-medium">{product.name}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        <div className="sm:col-span-2 md:col-span-1">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:hidden">{t.name}</p>
          <Input
            value={row.name}
            onChange={(event) => onChange(index, { name: event.target.value })}
            placeholder={t.lineNamePlaceholder}
          />
        </div>

        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:hidden">{t.qty}</p>
          <Input
            type="number"
            min={1}
            value={row.quantity}
            onChange={(event) => onChange(index, { quantity: Math.max(1, Number(event.target.value) || 1) })}
          />
        </div>

        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:hidden">{t.unitPrice}</p>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={centsToEuros(row.unitPriceExcludingTax)}
            onChange={(event) => onChange(index, { unitPriceExcludingTax: eurosToCents(event.target.value || 0) })}
          />
        </div>

        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:hidden">{t.vatRate}</p>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={row.vatRate}
            onChange={(event) => onChange(index, { vatRate: Number(event.target.value) || 0 })}
          />
        </div>

        <div className="rounded-lg border border-border/70 bg-background px-2.5 py-2.5 sm:col-span-2 md:col-span-1">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.total}</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <span className="whitespace-nowrap">{t.totalExclTax}</span>
              <PriceDisplay cents={rowTotalCents} className="whitespace-nowrap" />
            </div>
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <span className="whitespace-nowrap">{t.vatAmount} ({row.vatRate}%)</span>
              <PriceDisplay cents={rowVatCents} className="whitespace-nowrap" />
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-1.5 text-sm font-semibold text-foreground">
              <span className="whitespace-nowrap">{t.totalInclTax}</span>
              <PriceDisplay cents={rowTotalInclCents} className="whitespace-nowrap font-semibold" />
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="destructive"
          className="w-full sm:col-span-2 md:col-span-1 md:h-full md:w-10 md:px-0"
          onClick={() => onDelete(index)}
        >
          <Trash2Icon className="size-4" />
          <span className="md:hidden">{t.removeLine}</span>
        </Button>
      </div>
    </div>
  );
}
