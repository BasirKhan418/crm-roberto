'use client';

import { useEffect, useState } from 'react';
import { DownloadIcon, FileSpreadsheetIcon, FileTextIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { FinancialPeriodSelector } from '@/components/dashboard/financial-period-selector';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { buildFinancialPeriodSearchParams, getDefaultFinancialPeriodSelection, type FinancialPeriodSelection } from '@/lib/financial-periods';
import { cn } from '@/lib/utils';

type LookupData = {
  suppliers: Array<{ id: string; fullName: string; companyName: string | null }>;
  categories: Array<{ id: string; name: string; nameEn: string | null; nameFr: string | null }>;
};

function extractFileName(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;
  const match = disposition.match(/filename="?([^\"]+)"?/i);
  return match?.[1] || fallback;
}

const copy = {
  en: {
    title: 'Exports',
    subtitle: 'Download accounting rows, VAT summaries, and a general ledger using the same company filters as the dashboard.',
    type: 'Dataset scope',
    status: 'Status',
    category: 'Category',
    all: 'All',
    purchase: 'Purchase only',
    sale: 'Sales only',
    accountingRows: 'Accounting rows',
    accountingRowsHelp: 'Detailed purchase and sales rows with counterparty, reference, category, and VAT amounts.',
    vatSummary: 'VAT summary',
    vatSummaryHelp: 'Collected VAT, deductible VAT, and net balance for the selected period.',
    generalLedger: 'General ledger',
    generalLedgerHelp: 'Journal-style debit and credit rows built from purchase and sales documents.',
    csv: 'CSV',
    xlsx: 'XLSX',
    filterHint: 'Each export card is color-coded by dataset so accounting, VAT, and ledger outputs are easier to distinguish.',
    accountingRowsTone: 'Operational rows',
    vatSummaryTone: 'Tax summary',
    generalLedgerTone: 'Ledger pack',
    preparing: 'Preparing...',
  },
  fr: {
    title: 'Exports',
    subtitle: 'Telechargez les ecritures comptables, le resume TVA et le grand livre avec les memes filtres que le tableau.',
    type: 'Perimetre',
    status: 'Statut',
    category: 'Categorie',
    all: 'Tous',
    purchase: 'Achats seulement',
    sale: 'Ventes seulement',
    accountingRows: 'Ecritures comptables',
    accountingRowsHelp: 'Lignes detaillees achats et ventes avec tiers, reference, categorie et TVA.',
    vatSummary: 'Resume TVA',
    vatSummaryHelp: 'TVA collectee, TVA deductible et solde net pour la periode choisie.',
    generalLedger: 'Grand livre',
    generalLedgerHelp: 'Lignes debit et credit de style journal a partir des achats et ventes.',
    csv: 'CSV',
    xlsx: 'XLSX',
    filterHint: 'Chaque carte export est coloree par dataset pour mieux distinguer les sorties comptables, TVA et grand livre.',
    accountingRowsTone: 'Lignes operationnelles',
    vatSummaryTone: 'Synthese TVA',
    generalLedgerTone: 'Pack grand livre',
    preparing: 'Preparation...',
  },
} as const;

const EXPORT_CARD_TONES = {
  'accounting-rows': {
    card: 'border-sky-200/80 bg-sky-50/70 dark:border-sky-950/50 dark:bg-sky-950/20',
    icon: 'bg-white/80 text-sky-700 dark:bg-slate-950/60 dark:text-sky-300',
    button: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-950/50',
  },
  'vat-summary': {
    card: 'border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-950/50 dark:bg-emerald-950/20',
    icon: 'bg-white/80 text-emerald-700 dark:bg-slate-950/60 dark:text-emerald-300',
    button: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50',
  },
  'general-ledger': {
    card: 'border-amber-200/80 bg-amber-50/70 dark:border-amber-950/50 dark:bg-amber-950/20',
    icon: 'bg-white/80 text-amber-700 dark:bg-slate-950/60 dark:text-amber-300',
    button: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50',
  },
} as const;

export default function AccountantPortalExportsPage() {
  const { locale } = useLocale();
  const t = copy[locale];

  const [period, setPeriod] = useState<FinancialPeriodSelection>(getDefaultFinancialPeriodSelection());
  const [scope, setScope] = useState<'all' | 'purchase' | 'sale'>('all');
  const [status, setStatus] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [exportsEnabled, setExportsEnabled] = useState<boolean | null>(null);
  const [lookups, setLookups] = useState<LookupData>({ suppliers: [], categories: [] });
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSession() {
      try {
        const response = await fetch('/api/accountant/auth/me', { cache: 'no-store', signal: controller.signal });
        const payload = (await response.json().catch(() => null)) as { success?: boolean; user?: { featureFlags?: { exports?: boolean } } } | null;
        if (!response.ok || !payload?.success) {
          setExportsEnabled(false);
          return;
        }

        setExportsEnabled(payload.user?.featureFlags?.exports !== false);
      } catch {
        if (!controller.signal.aborted) {
          setExportsEnabled(false);
        }
      }
    }

    void loadSession();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (exportsEnabled !== true) {
      return;
    }

    const controller = new AbortController();

    async function loadLookups() {
      setLookupError(null);
      try {
        const response = await fetch('/api/accountant/lookups', { cache: 'no-store', signal: controller.signal });
        const payload = (await response.json().catch(() => null)) as { success?: boolean; data?: LookupData; message?: string } | null;
        if (!response.ok || !payload?.success || !payload.data) {
          throw new Error(payload?.message || 'Failed to load export lookups');
        }
        setLookups(payload.data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLookupError(error instanceof Error ? error.message : 'Failed to load export lookups');
        }
      }
    }

    void loadLookups();
    return () => controller.abort();
  }, [exportsEnabled]);

  async function handleDownload(dataset: 'accounting-rows' | 'vat-summary' | 'general-ledger', format: 'csv' | 'xlsx') {
    const key = `${dataset}-${format}`;
    setDownloadingKey(key);

    try {
      const params = buildFinancialPeriodSearchParams(period);
      params.set('format', format);
      params.set('type', scope);
      if (status !== 'all') params.set('status', status);
      if (categoryId !== 'all' && scope !== 'sale') params.set('categoryId', categoryId);

      const response = await fetch(`/api/accountant/exports/${dataset}?${params.toString()}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || 'Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = extractFileName(response.headers.get('Content-Disposition'), `${dataset}.${format}`);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setDownloadingKey(null);
    }
  }

  if (exportsEnabled === false) {
    return <EmptyState message={locale === 'fr' ? 'Les exports sont desactives pour cette entreprise.' : 'Exports are disabled for this company.'} />;
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-white/90 py-0 shadow-sm">
        <CardHeader className="pt-3 xl:pt-4">
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>{t.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pb-4 xl:pb-5">
          <FinancialPeriodSelector value={period} onChange={setPeriod} />
          <p className="text-sm text-muted-foreground">{t.filterHint}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t.type}</Label>
              <Select value={scope} onValueChange={(value) => setScope(value as 'all' | 'purchase' | 'sale')}>
                <SelectTrigger><SelectValue placeholder={t.type} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.all}</SelectItem>
                  <SelectItem value="purchase">{t.purchase}</SelectItem>
                  <SelectItem value="sale">{t.sale}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t.status}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder={t.status} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.all}</SelectItem>
                  {scope === 'sale' ? (
                    ['unpaid', 'partial_paid', 'paid', 'overdue'].map((value) => <SelectItem key={value} value={value}>{value.replace('_', ' ')}</SelectItem>)
                  ) : scope === 'purchase' ? (
                    ['unpaid', 'partial', 'paid'].map((value) => <SelectItem key={value} value={value}>{value.replace('_', ' ')}</SelectItem>)
                  ) : (
                    ['unpaid', 'partial', 'partial_paid', 'paid', 'overdue'].map((value) => <SelectItem key={value} value={value}>{value.replace('_', ' ')}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t.category}</Label>
              <Select value={categoryId} onValueChange={setCategoryId} disabled={scope === 'sale'}>
                <SelectTrigger><SelectValue placeholder={t.category} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.all}</SelectItem>
                  {lookups.categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>{locale === 'fr' ? category.nameFr || category.name : category.nameEn || category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {lookupError ? <ErrorMessage message={lookupError} /> : null}

      <div className="grid gap-4 xl:grid-cols-3">
        {[
          { id: 'accounting-rows', title: t.accountingRows, description: t.accountingRowsHelp, eyebrow: t.accountingRowsTone, icon: FileTextIcon },
          { id: 'vat-summary', title: t.vatSummary, description: t.vatSummaryHelp, eyebrow: t.vatSummaryTone, icon: DownloadIcon },
          { id: 'general-ledger', title: t.generalLedger, description: t.generalLedgerHelp, eyebrow: t.generalLedgerTone, icon: FileSpreadsheetIcon },
        ].map((item) => {
          const Icon = item.icon;
          const tone = EXPORT_CARD_TONES[item.id as keyof typeof EXPORT_CARD_TONES];
          return (
            <Card key={item.id} className={cn('rounded-[24px] shadow-sm', tone.card)}>
              <CardHeader>
                <div className="space-y-3">
                  <span className="inline-flex w-fit items-center rounded-full border border-white/70 bg-white/75 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-300">
                    {item.eyebrow}
                  </span>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className={cn('rounded-2xl p-2 shadow-sm', tone.icon)}>
                      <Icon className="size-5" />
                    </span>
                    {item.title}
                  </CardTitle>
                </div>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className={cn('shadow-sm', tone.button)}
                  onClick={() => void handleDownload(item.id as 'accounting-rows' | 'vat-summary' | 'general-ledger', 'csv')}
                  disabled={downloadingKey !== null}
                >
                  {downloadingKey === `${item.id}-csv` ? <Loader2 className="size-4 animate-spin" /> : <FileTextIcon className="size-4" />}
                  {downloadingKey === `${item.id}-csv` ? t.preparing : t.csv}
                </Button>
                <Button
                  type="button"
                  className="shadow-sm"
                  onClick={() => void handleDownload(item.id as 'accounting-rows' | 'vat-summary' | 'general-ledger', 'xlsx')}
                  disabled={downloadingKey !== null}
                >
                  {downloadingKey === `${item.id}-xlsx` ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheetIcon className="size-4" />}
                  {downloadingKey === `${item.id}-xlsx` ? t.preparing : t.xlsx}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}