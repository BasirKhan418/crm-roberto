'use client';

import { useEffect, useState } from 'react';
import { DownloadIcon, FileSpreadsheetIcon, FileTextIcon } from 'lucide-react';
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
      <Card className="border-border/70 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>{t.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FinancialPeriodSelector value={period} onChange={setPeriod} />
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
          { id: 'accounting-rows', title: t.accountingRows, description: t.accountingRowsHelp, icon: FileTextIcon },
          { id: 'vat-summary', title: t.vatSummary, description: t.vatSummaryHelp, icon: DownloadIcon },
          { id: 'general-ledger', title: t.generalLedger, description: t.generalLedgerHelp, icon: FileSpreadsheetIcon },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.id} className="border-border/70 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Icon className="size-5" /> {item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => void handleDownload(item.id as 'accounting-rows' | 'vat-summary' | 'general-ledger', 'csv')} disabled={downloadingKey !== null}>
                  <FileTextIcon className="size-4" />
                  {downloadingKey === `${item.id}-csv` ? '...' : t.csv}
                </Button>
                <Button type="button" onClick={() => void handleDownload(item.id as 'accounting-rows' | 'vat-summary' | 'general-ledger', 'xlsx')} disabled={downloadingKey !== null}>
                  <FileSpreadsheetIcon className="size-4" />
                  {downloadingKey === `${item.id}-xlsx` ? '...' : t.xlsx}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}