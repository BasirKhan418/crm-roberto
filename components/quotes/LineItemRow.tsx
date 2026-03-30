'use client';

import { useMemo, useState } from 'react';

import { Trash2Icon } from 'lucide-react';

import { centsToEuros, eurosToCents } from '@/lib/price';
import { computeQuoteLine, deriveUnitPriceFromDiscount } from '@/lib/quote-calculations';
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
  baseUnitPriceExcludingTax: number;
  unitPriceExcludingTax: number;
  discountPercentage: number;
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

function getEffectiveBaseUnitPrice(row: QuoteLineItem): number {
  const base = row.baseUnitPriceExcludingTax;
  if (Number.isFinite(base) && base > 0) {
    return Math.round(base);
  }

  const unit = Number.isFinite(row.unitPriceExcludingTax) ? row.unitPriceExcludingTax : 0;
  return Math.max(0, Math.round(unit));
}

function toEditableNumberString(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return String(value);
}

export default function LineItemRow({ row, index, products, onChange, onDelete }: LineItemRowProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      product: 'Product',
      discount: 'Discount %',
      discountAmount: 'Discount HT',
      qty: 'Qty',
      unitPrice: 'Unit price HT',
      vatRate: 'VAT %',
      totalExclTax: 'Total HT',
      totalInclTax: 'Total TTC',
      removeLine: 'Delete line',
      searchPlaceholder: 'Search product/service',
      noMatches: 'No matches',
    },
    fr: {
      product: 'Produit',
      discount: 'Remise %',
      discountAmount: 'Remise HT',
      qty: 'Qte',
      unitPrice: 'Prix unitaire HT',
      vatRate: 'TVA %',
      totalExclTax: 'Total HT',
      totalInclTax: 'Total TTC',
      removeLine: 'Supprimer la ligne',
      searchPlaceholder: 'Rechercher un produit/service',
      noMatches: 'Aucun resultat',
    },
  }[locale];

  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [discountInputDraft, setDiscountInputDraft] = useState('0');
  const [isEditingDiscountAmount, setIsEditingDiscountAmount] = useState(false);
  const [discountAmountInputDraft, setDiscountAmountInputDraft] = useState('0.00');
  const [isEditingUnitPrice, setIsEditingUnitPrice] = useState(false);
  const [unitPriceInputDraft, setUnitPriceInputDraft] = useState('0.00');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return products;
    }

    return products.filter((item) => item.name.toLowerCase().includes(term));
  }, [products, search]);

  const computed = computeQuoteLine({
    quantity: row.quantity,
    unitPriceExcludingTax: row.unitPriceExcludingTax,
    baseUnitPriceExcludingTax: row.baseUnitPriceExcludingTax,
    discountPercentage: row.discountPercentage,
    vatRate: row.vatRate,
  });

  const discountInputValue = isEditingDiscount
    ? discountInputDraft
    : toEditableNumberString(Number(computed.discountPercentage.toFixed(2)));
  const discountAmountInputValue = isEditingDiscountAmount
    ? discountAmountInputDraft
    : centsToEuros(computed.discountAmountExcludingTax);
  const unitPriceInputValue = isEditingUnitPrice
    ? unitPriceInputDraft
    : centsToEuros(getEffectiveBaseUnitPrice(row));

  function handleProductSelect(product: CatalogueItemOption) {
    onChange(index, {
      productId: product._id,
      productImageUrl: isImageAttachment(product.attachmentUrl, product.attachmentMimeType) ? product.attachmentUrl ?? null : null,
      name: product.name,
      baseUnitPriceExcludingTax: product.priceExcludingTax,
      unitPriceExcludingTax: product.priceExcludingTax,
      discountPercentage: 0,
      vatRate: product.vatRate,
    });
    setSearch(product.name);
    setIsOpen(false);
  }

  function handleDiscountChange(value: string) {
    const base = getEffectiveBaseUnitPrice(row);
    const discount = Math.min(100, Math.max(0, Number(value) || 0));

    onChange(index, {
      baseUnitPriceExcludingTax: base,
      discountPercentage: discount,
      unitPriceExcludingTax: deriveUnitPriceFromDiscount(base, discount),
    });
  }

  function handleDiscountAmountChange(value: string) {
    const base = getEffectiveBaseUnitPrice(row);
    const qty = Math.max(1, Number(row.quantity) || 1);
    const maxDiscountAmount = base * qty;
    const requested = eurosToCents(value || 0);
    const clamped = Math.min(maxDiscountAmount, Math.max(0, requested));
    const discountPercent = maxDiscountAmount > 0 ? (clamped / maxDiscountAmount) * 100 : 0;

    onChange(index, {
      baseUnitPriceExcludingTax: base,
      discountPercentage: discountPercent,
      unitPriceExcludingTax: deriveUnitPriceFromDiscount(base, discountPercent),
    });
  }

  function handleUnitPriceChange(value: string) {
    const normalizedBasePrice = Math.max(0, eurosToCents(value || 0));
    const currentDiscount = Math.min(100, Math.max(0, Number(row.discountPercentage) || 0));

    onChange(index, {
      // Keep the current discount when base price changes, and recompute negotiated unit price.
      baseUnitPriceExcludingTax: normalizedBasePrice,
      unitPriceExcludingTax: deriveUnitPriceFromDiscount(normalizedBasePrice, currentDiscount),
      discountPercentage: currentDiscount,
    });
  }

  return (
    <div className="rounded-xl border border-border/70 bg-linear-to-b from-background to-secondary/25 p-3 md:p-3.5">
      <div className="grid items-center gap-2 sm:grid-cols-2 md:grid-cols-[2fr_0.9fr_1.1fr_0.7fr_1.2fr_0.7fr_1fr_1fr_auto]">
        <div className="relative sm:col-span-2 md:col-span-1">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:hidden">{t.product}</p>
          <div className="relative">
            {row.productImageUrl ? (
              <img
                src={row.productImageUrl}
                alt={row.name || 'Product'}
                className="absolute left-2 top-1/2 h-5 w-5 -translate-y-1/2 rounded border border-border/60 object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
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
              className={row.productImageUrl ? 'pl-9' : ''}
            />
          </div>
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

        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:hidden">{t.discount}</p>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            className="text-right"
            value={discountInputValue}
            onFocus={() => {
              setIsEditingDiscount(true);
              setDiscountInputDraft(discountInputValue);
            }}
            onChange={(event) => setDiscountInputDraft(event.target.value)}
            onBlur={() => {
              setIsEditingDiscount(false);
              handleDiscountChange(discountInputDraft);
            }}
          />
        </div>

        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:hidden">{t.discountAmount}</p>
          <Input
            type="number"
            min={0}
            step="0.01"
            className="text-right text-destructive"
            value={discountAmountInputValue}
            onFocus={() => {
              setIsEditingDiscountAmount(true);
              setDiscountAmountInputDraft(discountAmountInputValue);
            }}
            onChange={(event) => setDiscountAmountInputDraft(event.target.value)}
            onBlur={() => {
              setIsEditingDiscountAmount(false);
              handleDiscountAmountChange(discountAmountInputDraft);
            }}
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
            className="text-right"
            value={unitPriceInputValue}
            onFocus={() => {
              setIsEditingUnitPrice(true);
              setUnitPriceInputDraft(unitPriceInputValue);
            }}
            onChange={(event) => setUnitPriceInputDraft(event.target.value)}
            onBlur={() => {
              setIsEditingUnitPrice(false);
              handleUnitPriceChange(unitPriceInputDraft);
            }}
          />
        </div>

        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:hidden">{t.vatRate}</p>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.1"
            className="text-right"
            value={row.vatRate}
            onChange={(event) => onChange(index, { vatRate: Number(event.target.value) || 0 })}
          />
        </div>

        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:hidden">{t.totalExclTax}</p>
          <div className="flex h-9 items-center justify-end">
            <PriceDisplay cents={computed.totalExcludingTax} className="whitespace-nowrap text-sm font-semibold" />
          </div>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:hidden">{t.totalInclTax}</p>
          <div className="flex h-9 items-center justify-end">
            <PriceDisplay cents={computed.totalIncludingTax} className="whitespace-nowrap text-sm font-semibold" />
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-full shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive sm:col-span-2 md:col-span-1 md:w-9"
          onClick={() => onDelete(index)}
        >
          <Trash2Icon className="size-4" />
          <span className="ml-1.5 md:hidden">{t.removeLine}</span>
        </Button>
      </div>
    </div>
  );
}
