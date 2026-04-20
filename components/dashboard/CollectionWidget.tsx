'use client';

import { AlertTriangleIcon, BellIcon, PauseCircleIcon } from 'lucide-react';
import useSWR from 'swr';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardRemindersPayload {
  success?: boolean;
  message?: string;
  data?: DashboardRemindersData;
}

interface DashboardRemindersData {
  level0?: number;
  level1?: number;
  level2?: number;
  level3?: number;
  level4?: number;
  paused?: number;
  overdueCount?: number;
  upcomingRecurrences?: Array<{
    id: string;
    invoiceNumber: string;
    clientName: string;
    nextOccurrenceAt: string | null;
  }>;
}

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json()) as DashboardRemindersPayload;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.message || 'Failed to load collection KPIs');
  }

  return payload.data;
};

export default function CollectionWidget() {
  const { data, error, isLoading } = useSWR('/api/dashboard/reminders', fetcher);

  const stats = [
    { label: 'No reminder', value: data?.level0 ?? 0 },
    { label: 'Soft', value: data?.level1 ?? 0 },
    { label: 'Medium', value: data?.level2 ?? 0 },
    { label: 'Firm', value: data?.level3 ?? 0 },
    { label: 'Formal Notice', value: data?.level4 ?? 0 },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangleIcon className="size-4 text-amber-600" />
          Collection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-destructive">Failed to load collection KPIs.</p> : null}

        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {stats.map((item) => (
            <div key={item.label} className="rounded-lg border bg-muted/20 p-2.5">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{isLoading ? '-' : item.value}</p>
            </div>
          ))}
        </div>

        {typeof data?.paused === 'number' ? (
          <div className="flex items-center gap-2 rounded-md border border-slate-300/80 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <PauseCircleIcon className="size-4" />
            {data.paused} paused reminder flow(s)
          </div>
        ) : null}

        {(data?.overdueCount ?? 0) > 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-red-300/80 bg-red-50 px-3 py-2 text-sm text-red-700">
            <BellIcon className="size-4" />
            {data?.overdueCount} invoice(s) past formal notice deadline - action required
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
