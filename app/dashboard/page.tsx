'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';

import ActivityFeed from '@/components/dashboard/ActivityFeed';
import FollowUpsList from '@/components/dashboard/FollowUpsList';
import QuickAddButtons from '@/components/dashboard/QuickAddButtons';
import RecentQuotes from '@/components/dashboard/RecentQuotes';
import StatCards from '@/components/dashboard/StatCards';
import { useLocale } from '@/components/providers/locale-provider';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useDashboard } from '@/hooks/useDashboard';

export default function DashboardPage() {
  const { locale } = useLocale();
  const t = {
    en: {
      title: 'Dashboard',
      heading: 'Dashboard',
      subtitle: 'Overview of your CRM activity and upcoming work.',
      sectionAria: 'Dashboard content',
    },
    fr: {
      title: 'Tableau de bord',
      heading: 'Tableau de bord',
      subtitle: 'Vue d\'ensemble de votre activite CRM et du travail a venir.',
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
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title={t.title} />
        <main className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-5 px-4 py-4 lg:px-6 lg:py-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.heading}</h1>
                <p className="text-sm text-muted-foreground">{t.subtitle}</p>
              </div>
              <QuickAddButtons onSuccess={handleQuickAddSuccess} />
            </div>

            {error ? <ErrorMessage message={error} /> : null}

            <StatCards key={statsRefreshKey} />

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]" aria-label={t.sectionAria}>
              <ActivityFeed activity={activity} loading={loading} error={activityError} />
              <FollowUpsList followUps={followUps} loading={loading} error={followUpsError} />
            </section>

            <RecentQuotes refreshKey={statsRefreshKey} />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}