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
  description?: string | null;
}

export interface QuoteLineItem {
  productId: string | null;
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

export default function LineItemRow({ row, index, products, onChange, onDelete }: LineItemRowProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      product: 'Product',
      name: 'Name',
      qty: 'Qty',
      unitPrice: 'Unit price',
      vat: 'VAT %',
      total: 'Total',
      searchPlaceholder: 'Search product/service',
      lineNamePlaceholder: 'Line name',
      noMatches: 'No matches',
    },
    fr: {
      product: 'Produit',
      name: 'Nom',
      qty: 'Qte',
      unitPrice: 'Prix unitaire',
      vat: 'TVA %',
      total: 'Total',
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

  function handleProductSelect(product: CatalogueItemOption) {
    onChange(index, {
      productId: product._id,
      name: product.name,
      unitPriceExcludingTax: product.priceExcludingTax,
      vatRate: product.vatRate,
    });
    setSearch(product.name);
    setIsOpen(false);
  }

  return (
    <div className="rounded-lg border border-border/70 bg-secondary/20 p-2.5 md:p-3">
      <div className="grid gap-2 md:grid-cols-[2.2fr_2fr_0.8fr_1.2fr_0.8fr_1fr_auto] md:items-center">
        <div className="relative">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:hidden">{t.product}</p>
          <Input
            value={search || row.name}
            onFocus={() => setIsOpen(true)}
            onChange={(event) => {
              const next = event.target.value;
              setSearch(next);
              onChange(index, { name: next, productId: null });
              setIsOpen(true);
            }}
            placeholder={t.searchPlaceholder}
          />
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
                    <span className="font-medium">{product.name}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        <div>
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
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:hidden">{t.vat}</p>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={row.vatRate}
            onChange={(event) => onChange(index, { vatRate: Number(event.target.value) || 0 })}
          />
        </div>

        <div className="rounded-md border border-border/60 bg-background px-2 py-2 text-right text-sm font-semibold">
          <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:hidden">{t.total}</p>
          <PriceDisplay cents={rowTotalCents} />
        </div>

        <Button type="button" size="icon-sm" variant="destructive" className="mt-1 md:mt-0" onClick={() => onDelete(index)}>
          <Trash2Icon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
