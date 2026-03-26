'use client';

import { useEffect, useState } from 'react';

export type ActivityEntityType = 'client' | 'supplier' | 'note';

export interface ActivityItem {
  _id?: string;
  action?: string;
  entityType?: ActivityEntityType | string;
  entityName?: string;
  createdAt?: string;
}

export interface FollowUpItem {
  _id?: string;
  title?: string;
  followUpDate?: string;
  linkedType?: 'client' | 'supplier' | string;
  linkedId?: {
    _id?: string;
    fullName?: string;
  };
  [key: string]: unknown;
}

interface UseDashboardResult {
  activity: ActivityItem[];
  followUps: FollowUpItem[];
  loading: boolean;
  error: string | null;
  activityError: string | null;
  followUpsError: string | null;
}

export function useDashboard(): UseDashboardResult {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [followUpsError, setFollowUpsError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboardData() {
      setLoading(true);
      setError(null);
      setActivityError(null);
      setFollowUpsError(null);

      try {
        const [activityResult, followUpsResult] = await Promise.allSettled([
          fetch('/api/dashboard/activity', {
            signal: controller.signal,
            cache: 'no-store',
          }),
          fetch('/api/dashboard/followups', {
            signal: controller.signal,
            cache: 'no-store',
          }),
        ]);

        if (activityResult.status === 'fulfilled' && activityResult.value.ok) {
          const activityData = await activityResult.value.json();
          setActivity(Array.isArray(activityData) ? (activityData as ActivityItem[]) : []);
        } else {
          setActivity([]);
          setActivityError('Could not load activity.');
        }

        if (followUpsResult.status === 'fulfilled' && followUpsResult.value.ok) {
          const followUpsData = await followUpsResult.value.json();
          setFollowUps(Array.isArray(followUpsData) ? (followUpsData as FollowUpItem[]) : []);
        } else {
          setFollowUps([]);
          setFollowUpsError('Could not load follow-ups.');
        }

        const failedBoth =
          !(activityResult.status === 'fulfilled' && activityResult.value.ok) &&
          !(followUpsResult.status === 'fulfilled' && followUpsResult.value.ok);

        if (failedBoth) {
          setError('Could not load dashboard data. Check your connection and refresh.');
        }
      } catch {
        setActivity([]);
        setFollowUps([]);
        setError('Failed to load dashboard data');
        setActivityError('Could not load activity.');
        setFollowUpsError('Could not load follow-ups.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();

    return () => controller.abort();
  }, []);

  return { activity, followUps, loading, error, activityError, followUpsError };
}