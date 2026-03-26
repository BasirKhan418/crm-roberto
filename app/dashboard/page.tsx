'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';

import ActivityFeed from '@/components/dashboard/ActivityFeed';
import FollowUpsList from '@/components/dashboard/FollowUpsList';
import QuickAddButtons from '@/components/dashboard/QuickAddButtons';
import StatCards from '@/components/dashboard/StatCards';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useDashboard } from '@/hooks/useDashboard';

export default function DashboardPage() {
  const { activity, followUps, loading, error, activityError, followUpsError } = useDashboard();
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);

  function refetchStats() {
    setStatsRefreshKey((prev) => prev + 1);
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
        <SiteHeader title="Dashboard" />
        <main className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
                <p className="text-sm text-muted-foreground">Overview of your CRM activity and upcoming work.</p>
              </div>
              <QuickAddButtons onSuccess={refetchStats} />
            </div>

            {error ? <ErrorMessage message={error} /> : null}

            <StatCards key={statsRefreshKey} />

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]" aria-label="Dashboard content">
              <ActivityFeed activity={activity} loading={loading} error={activityError} />
              <FollowUpsList followUps={followUps} loading={loading} error={followUpsError} />
            </section>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}