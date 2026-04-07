'use client';

import { useState } from 'react';

import ActivityFeed from '@/components/dashboard/ActivityFeed';
import FollowUpsList from '@/components/dashboard/FollowUpsList';
import PriorityActionsPanel from '@/components/dashboard/PriorityActionsPanel';
import QuickAddButtons from '@/components/dashboard/QuickAddButtons';
import RecentQuotes from '@/components/dashboard/RecentQuotes';
import StatCards from '@/components/dashboard/StatCards';
import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { useDashboard } from '@/hooks/useDashboard';

export default function DashboardPage() {
  const { locale } = useLocale();
  const t = {
    en: {
      title: 'Dashboard',
      heading: 'Business Overview',
      subtitle: `Key metrics and activity as of ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      metricsLabel: 'Key Performance Indicators',
      activitySection: 'Activity & Follow-ups',
      sectionAria: 'Dashboard content',
    },
    fr: {
      title: 'Tableau de bord',
      heading: 'Vue d\'affaires',
      subtitle: `Indicateurs clés au ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      metricsLabel: 'Indicateurs de performance',
      activitySection: 'Activité & Suivis',
      sectionAria: 'Contenu du tableau de bord',
    },
  }[locale];

  const { activity, followUps, loading, error, activityError, followUpsError, refetch } = useDashboard();
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);

  function handleQuickAddSuccess() {
    setStatsRefreshKey((prev) => prev + 1);
    refetch();
  }

  return (
    <CrmShell title={t.title} contentClassName="gap-6 px-4 py-5 lg:px-6 lg:py-6">
      {/* Page header */}
      <div data-tour-dashboard-header className="flex flex-col items-center gap-3 border-b border-border/60 pb-5 text-center lg:flex-row lg:items-end lg:justify-between lg:text-left">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{t.heading}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <QuickAddButtons onSuccess={handleQuickAddSuccess} />
      </div>

      {error ? <ErrorMessage message={error} /> : null}

      <div data-tour-dashboard-priority>
      <PriorityActionsPanel
        followUps={followUps}
        loading={loading}
        error={followUpsError}
        onActionSuccess={handleQuickAddSuccess}
      />
      </div>

      {/* KPI Cards */}
      <div data-tour-dashboard-stats>
        <StatCards key={statsRefreshKey} />
      </div>

      {/* Activity + Follow-ups */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]" aria-label={t.sectionAria}>
        <div data-tour-dashboard-activity>
          <ActivityFeed activity={activity} loading={loading} error={activityError} onActionSuccess={handleQuickAddSuccess} />
        </div>
        <div data-tour-dashboard-followups>
        <FollowUpsList
          followUps={followUps}
          loading={loading}
          error={followUpsError}
          onMarkDone={refetch}
          onActionSuccess={handleQuickAddSuccess}
        />
        </div>
      </section>

      {/* Recent Quotes */}
      <div data-tour-dashboard-recent-quotes>
        <RecentQuotes refreshKey={statsRefreshKey} />
      </div>
    </CrmShell>
  );
}