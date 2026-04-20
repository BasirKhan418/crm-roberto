'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';

import ActivityFeed from '@/components/dashboard/ActivityFeed';
import CollectionWidget from '@/components/dashboard/CollectionWidget';
import PriorityActionsPanel from '@/components/dashboard/PriorityActionsPanel';
import QuickAddButtons from '@/components/dashboard/QuickAddButtons';
import RecentQuotes from '@/components/dashboard/RecentQuotes';
import StatCards from '@/components/dashboard/StatCards';
import UpcomingRecurrencesWidget from '@/components/dashboard/UpcomingRecurrencesWidget';
import CrmShell from '@/components/crm-shell';
import BaseAddModal from '@/components/modals/BaseAddModal';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { useDashboard } from '@/hooks/useDashboard';

type DashboardBlockKey = 'smartActions' | 'stats' | 'activity' | 'recentQuotes';
type DashboardPrefs = {
  order: DashboardBlockKey[];
  visible: Record<DashboardBlockKey, boolean>;
};

const DASHBOARD_PREFS_KEY = 'crm.dashboard.blocks.v2';
const LEGACY_DASHBOARD_PREFS_KEY = 'crm.dashboard.blocks.v1';
const DEFAULT_BLOCK_ORDER: DashboardBlockKey[] = ['smartActions', 'stats', 'activity', 'recentQuotes'];
const DEFAULT_BLOCK_VISIBILITY: Record<DashboardBlockKey, boolean> = {
  smartActions: true,
  stats: true,
  activity: true,
  recentQuotes: true,
};

function normalizeDashboardPrefs(raw: unknown): DashboardPrefs {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as {
    order?: unknown;
    visible?: unknown;
  };

  const orderCandidate = Array.isArray(parsed.order)
    ? parsed.order.filter((key): key is DashboardBlockKey => DEFAULT_BLOCK_ORDER.includes(key as DashboardBlockKey))
    : [];

  const dedupedOrder = Array.from(new Set(orderCandidate));
  const normalizedOrder = dedupedOrder.length
    ? [...dedupedOrder, ...DEFAULT_BLOCK_ORDER.filter((key) => !dedupedOrder.includes(key))]
    : [...DEFAULT_BLOCK_ORDER];

  const visibleCandidate = parsed.visible && typeof parsed.visible === 'object'
    ? (parsed.visible as Partial<Record<DashboardBlockKey, unknown>>)
    : {};

  const visible: Record<DashboardBlockKey, boolean> = {
    smartActions: typeof visibleCandidate.smartActions === 'boolean' ? visibleCandidate.smartActions : DEFAULT_BLOCK_VISIBILITY.smartActions,
    stats: typeof visibleCandidate.stats === 'boolean' ? visibleCandidate.stats : DEFAULT_BLOCK_VISIBILITY.stats,
    activity: typeof visibleCandidate.activity === 'boolean' ? visibleCandidate.activity : DEFAULT_BLOCK_VISIBILITY.activity,
    recentQuotes: typeof visibleCandidate.recentQuotes === 'boolean' ? visibleCandidate.recentQuotes : DEFAULT_BLOCK_VISIBILITY.recentQuotes,
  };

  return { order: normalizedOrder, visible };
}

function persistDashboardPrefs(prefs: DashboardPrefs) {
  const payload = JSON.stringify(prefs);
  window.localStorage.setItem(DASHBOARD_PREFS_KEY, payload);
  window.localStorage.setItem(LEGACY_DASHBOARD_PREFS_KEY, payload);
}

export default function DashboardPage() {
  const { locale } = useLocale();
  const t = {
    en: {
      title: 'Dashboard',
      heading: 'Business Overview',
      subtitle: `Key metrics and activity as of ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      customizeDashboard: 'Customize dashboard',
      customizeTitle: 'Customize Dashboard',
      customizeDescription: 'Choose visible blocks and reorder them for your workflow.',
      saveLayout: 'Save layout',
      cancel: 'Cancel',
      moveUp: 'Move up',
      moveDown: 'Move down',
      blockSmartActions: 'Smart Actions',
      blockStats: 'Top insights',
      blockActivity: 'Recent Activity',
      blockRecentQuotes: 'Recent Quotes',
      sectionAria: 'Dashboard content',
    },
    fr: {
      title: 'Tableau de bord',
      heading: 'Vue d\'affaires',
      subtitle: `Indicateurs clés au ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      customizeDashboard: 'Personnaliser le tableau de bord',
      customizeTitle: 'Personnaliser le tableau de bord',
      customizeDescription: 'Choisissez les blocs visibles et réorganisez-les selon votre travail.',
      saveLayout: 'Enregistrer',
      cancel: 'Annuler',
      moveUp: 'Monter',
      moveDown: 'Descendre',
      blockSmartActions: 'Actions intelligentes',
      blockStats: 'Indicateurs clés',
      blockActivity: 'Activité récente',
      blockRecentQuotes: 'Devis récents',
      sectionAria: 'Contenu du tableau de bord',
    },
  }[locale];

  const { activity, followUps, loading, error, activityError, followUpsError, refetch } = useDashboard();
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [visibleBlocks, setVisibleBlocks] = useState<Record<DashboardBlockKey, boolean>>(DEFAULT_BLOCK_VISIBILITY);
  const [blockOrder, setBlockOrder] = useState<DashboardBlockKey[]>(DEFAULT_BLOCK_ORDER);
  const [draftVisibleBlocks, setDraftVisibleBlocks] = useState<Record<DashboardBlockKey, boolean>>(DEFAULT_BLOCK_VISIBILITY);
  const [draftBlockOrder, setDraftBlockOrder] = useState<DashboardBlockKey[]>(DEFAULT_BLOCK_ORDER);
  const [hasLoadedPrefs, setHasLoadedPrefs] = useState(false);

  const blockLabels: Record<DashboardBlockKey, string> = useMemo(
    () => ({
      smartActions: t.blockSmartActions,
      stats: t.blockStats,
      activity: t.blockActivity,
      recentQuotes: t.blockRecentQuotes,
    }),
    [t.blockActivity, t.blockRecentQuotes, t.blockSmartActions, t.blockStats],
  );

  useEffect(() => {
    try {
      const rawV2 = window.localStorage.getItem(DASHBOARD_PREFS_KEY);
      const rawV1 = window.localStorage.getItem(LEGACY_DASHBOARD_PREFS_KEY);
      const raw = rawV2 ?? rawV1;
      if (!raw) return;
      const normalized = normalizeDashboardPrefs(JSON.parse(raw));

      setBlockOrder(normalized.order);
      setVisibleBlocks(normalized.visible);
      setDraftBlockOrder(normalized.order);
      setDraftVisibleBlocks(normalized.visible);

      persistDashboardPrefs(normalized);
    } catch {
      setBlockOrder(DEFAULT_BLOCK_ORDER);
      setVisibleBlocks(DEFAULT_BLOCK_VISIBILITY);
      setDraftBlockOrder(DEFAULT_BLOCK_ORDER);
      setDraftVisibleBlocks(DEFAULT_BLOCK_VISIBILITY);
    } finally {
      setHasLoadedPrefs(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedPrefs) {
      return;
    }

    try {
      persistDashboardPrefs({ order: blockOrder, visible: visibleBlocks });
    } catch {
      // Ignore storage write failures.
    }
  }, [blockOrder, hasLoadedPrefs, visibleBlocks]);

  function handleQuickAddSuccess() {
    setStatsRefreshKey((prev) => prev + 1);
    refetch();
  }

  function moveDraftBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draftBlockOrder.length) return;
    setDraftBlockOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function openCustomize() {
    setDraftBlockOrder(blockOrder);
    setDraftVisibleBlocks(visibleBlocks);
    setIsCustomizeOpen(true);
  }

  function saveCustomize() {
    setBlockOrder(draftBlockOrder);
    setVisibleBlocks(draftVisibleBlocks);
    try {
      persistDashboardPrefs({ order: draftBlockOrder, visible: draftVisibleBlocks });
    } catch {
      // Ignore storage write failures.
    }
    setIsCustomizeOpen(false);
  }

  const renderedBlocks = blockOrder.filter((key) => visibleBlocks[key]);

  return (
    <CrmShell title={t.title} contentClassName="gap-4 px-4 py-3 lg:px-6 lg:py-4">
      {/* Page header */}
      <div data-tour-dashboard-header className="flex flex-col gap-2.5 rounded-2xl bg-card/70 p-3 text-left shadow-sm sm:p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{t.heading}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <QuickAddButtons onSuccess={handleQuickAddSuccess} onCustomize={openCustomize} customizeLabel={t.customizeDashboard} />
      </div>

      {error ? <ErrorMessage message={error} /> : null}

      <section className="space-y-4" aria-label={t.sectionAria}>
        {renderedBlocks.map((blockKey) => {
          if (blockKey === 'smartActions') {
            return (
              <div key={blockKey} data-tour-dashboard-priority>
                <PriorityActionsPanel
                  followUps={followUps}
                  loading={loading}
                  error={followUpsError}
                  onActionSuccess={handleQuickAddSuccess}
                />
              </div>
            );
          }

          if (blockKey === 'stats') {
            return (
              <div key={blockKey} data-tour-dashboard-stats>
                <StatCards key={statsRefreshKey} />
              </div>
            );
          }

          if (blockKey === 'activity') {
            return (
              <div key={blockKey} data-tour-dashboard-activity>
                <ActivityFeed activity={activity} loading={loading} error={activityError} onActionSuccess={handleQuickAddSuccess} />
              </div>
            );
          }

          return (
            <div key={blockKey} data-tour-dashboard-recent-quotes>
              <RecentQuotes refreshKey={statsRefreshKey} />
            </div>
          );
        })}

        <CollectionWidget />
        <UpcomingRecurrencesWidget />
      </section>

      {isCustomizeOpen ? (
        <BaseAddModal title={t.customizeTitle} description={t.customizeDescription} onClose={() => setIsCustomizeOpen(false)}>
          <div className="space-y-2.5">
            {draftBlockOrder.map((blockKey, index) => (
              <div key={blockKey} className="flex flex-col gap-2 rounded-xl bg-muted/40 p-2.5 sm:flex-row sm:items-center">
                <input
                  type="checkbox"
                  checked={draftVisibleBlocks[blockKey]}
                  onChange={(event) => setDraftVisibleBlocks((prev) => ({ ...prev, [blockKey]: event.target.checked }))}
                  className="size-4"
                />
                <span className="flex-1 text-sm font-medium text-foreground">{blockLabels[blockKey]}</span>
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <Button type="button" size="sm" variant="outline" className="h-8 w-8 rounded-full p-0" onClick={() => moveDraftBlock(index, -1)} disabled={index === 0} title={t.moveUp}>
                    <ArrowUpIcon className="size-3.5" />
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-8 w-8 rounded-full p-0" onClick={() => moveDraftBlock(index, 1)} disabled={index === draftBlockOrder.length - 1} title={t.moveDown}>
                    <ArrowDownIcon className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsCustomizeOpen(false)}>{t.cancel}</Button>
            <Button type="button" className="flex-1" onClick={saveCustomize}>{t.saveLayout}</Button>
          </div>
        </BaseAddModal>
      ) : null}
    </CrmShell>
  );
}