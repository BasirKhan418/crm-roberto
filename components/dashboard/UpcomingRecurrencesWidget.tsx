'use client';

import { useMemo, useState } from 'react';

import { Loader2Icon, Repeat2Icon } from 'lucide-react';
import { toast } from 'sonner';
import useSWR from 'swr';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RecurrenceRow {
  id: string;
  invoiceNumber: string;
  clientName: string;
  nextOccurrenceAt: string | null;
}

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
  upcomingRecurrences?: RecurrenceRow[];
}

function daysUntil(value: string | null): number {
  if (!value) {
    return 0;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return 0;
  }

  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000));
}

async function parseActionResponse(response: Response): Promise<{ success?: boolean; message?: string }> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return (await response.json()) as { success?: boolean; message?: string };
  }

  const text = await response.text();
  return {
    success: false,
    message: text.includes('<!DOCTYPE') ? 'Unexpected non-JSON response from server' : text || 'Unexpected response',
  };
}

const fetcher = async (url: string): Promise<DashboardRemindersData> => {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json()) as DashboardRemindersPayload;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.message || 'Failed to load upcoming recurrences');
  }

  return payload.data;
};

export default function UpcomingRecurrencesWidget() {
  const { data, error, isLoading, mutate } = useSWR('/api/dashboard/reminders', fetcher);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const rows = useMemo(() => (Array.isArray(data?.upcomingRecurrences) ? data.upcomingRecurrences : []), [data]);

  async function handleGenerate(invoiceId: string) {
    if (generatingId) {
      return;
    }

    setGeneratingId(invoiceId);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/recurrence/generate`, { method: 'POST' });
      const payload = await parseActionResponse(response);

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to generate recurrence invoice');
      }

      toast.success('Recurrence generated successfully');
      await mutate();
    } catch (errorCaught) {
      toast.error(errorCaught instanceof Error ? errorCaught.message : 'Failed to generate recurrence invoice');
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Repeat2Icon className="size-4 text-blue-600" />
          Upcoming recurrences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-sm text-destructive">Failed to load upcoming recurrences.</p> : null}

        {!isLoading && !error && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recurrences due in the next 14 days</p>
        ) : null}

        {rows.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">{item.invoiceNumber}</p>
              <p className="truncate text-xs text-muted-foreground">{item.clientName}</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                due in {daysUntil(item.nextOccurrenceAt)} days
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleGenerate(item.id)}
                disabled={generatingId === item.id}
              >
                {generatingId === item.id ? <Loader2Icon className="size-4 animate-spin" /> : null}
                Generate
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
