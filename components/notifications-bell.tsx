'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Bell, CheckCheck, FileText, Loader2Icon, RefreshCw } from 'lucide-react';

import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatActivityRelativeTime, formatInvoiceDisplayNumber, getActivityHeadline } from '@/lib/i18n/messages';

interface ActivityItem {
  _id: string;
  action: string;
  entityType: string;
  entityName: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  isRead?: boolean;
  createdAt?: string;
}

interface ActivityListResponse {
  success: boolean;
  data?: ActivityItem[];
  unreadCount?: number;
  message?: string;
}

interface ActivitySseEvent {
  id: string;
  type: 'created' | 'updated' | 'deleted' | 'read_all';
  activityId?: string | null;
  at: number;
}

type NotificationsTab = 'unread' | 'read';

const texts = {
  en: {
    title: 'Notifications',
    unread: 'unread',
    unreadTab: 'Unread',
    readTab: 'Read',
    loading: 'Loading notifications...',
    empty: 'No notifications yet.',
    unreadEmpty: 'No unread notifications.',
    readEmpty: 'No read notifications yet.',
    markAll: 'Mark all as read',
    markRead: 'Mark read',
    open: 'Open',
    refresh: 'Refresh',
  },
  fr: {
    title: 'Notifications',
    unread: 'non lues',
    unreadTab: 'Non lues',
    readTab: 'Lues',
    loading: 'Chargement des notifications...',
    empty: 'Aucune notification pour le moment.',
    unreadEmpty: 'Aucune notification non lue.',
    readEmpty: 'Aucune notification lue pour le moment.',
    markAll: 'Tout marquer comme lu',
    markRead: 'Marquer comme lu',
    open: 'Ouvrir',
    refresh: 'Actualiser',
  },
} as const;

function buildActivityPath(item: ActivityItem): string | null {
  if (item.action?.endsWith('_deleted')) {
    return null;
  }

  if (item.entityType === 'note') {
    return '/notes';
  }

  const basePathByEntity: Record<string, string> = {
    quote: 'quotes',
    invoice: 'invoices',
    client: 'clients',
    supplier: 'suppliers',
  };

  const basePath = basePathByEntity[item.entityType];
  if (!basePath) {
    return null;
  }

  return item.entityId ? `/${basePath}/${item.entityId}` : `/${basePath}`;
}

export function NotificationsBell() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = texts[locale];

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [updatingAll, setUpdatingAll] = useState(false);
  const [activeReadId, setActiveReadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NotificationsTab>('unread');

  const isMountedRef = useRef(true);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sortBy: 'createdAt',
        sortOrder: 'desc',
        limit: '10',
        isRead: activeTab === 'read' ? 'true' : 'false',
      });

      const response = await fetch(`/api/activity?${params.toString()}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as ActivityListResponse | null;

      if (!response.ok || !payload?.success) {
        return;
      }

      setItems(Array.isArray(payload.data) ? payload.data : []);
      setUnreadCount(typeof payload.unreadCount === 'number' ? payload.unreadCount : 0);
    } catch {
      // Ignore transient browser/network failures and keep the last known state.
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [activeTab]);

  useEffect(() => {
    isMountedRef.current = true;
    void fetchNotifications();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void fetchNotifications();
  }, [fetchNotifications, open]);

  useEffect(() => {
    const timer = setInterval(() => {
      void fetchNotifications();
    }, 60000);

    return () => clearInterval(timer);
  }, [fetchNotifications]);

  useEffect(() => {
    let source: EventSource | null = null;
    let closedByUnmount = false;

    const connect = () => {
      source = new EventSource('/api/activity/events');

      source.addEventListener('activity_changed', (event) => {
        if (!event.data) {
          return;
        }

        try {
          const payload = JSON.parse(event.data) as ActivitySseEvent;
          if (!payload?.id) {
            return;
          }
          void fetchNotifications();
        } catch {
          // Ignore malformed event payloads.
        }
      });

      source.onerror = () => {
        if (closedByUnmount) {
          source?.close();
          return;
        }
        void fetchNotifications();
      };
    };

    connect();

    return () => {
      closedByUnmount = true;
      source?.close();
    };
  }, [fetchNotifications]);

  const unreadBadge = useMemo(() => (unreadCount > 99 ? '99+' : String(unreadCount)), [unreadCount]);

  async function markAllAsRead() {
    if (updatingAll || unreadCount === 0) {
      return;
    }

    setUpdatingAll(true);
    try {
      const response = await fetch('/api/activity/read-all', { method: 'PATCH' });
      const payload = (await response.json().catch(() => null)) as { success?: boolean } | null;
      if (!response.ok || !payload?.success) {
        return;
      }
      await fetchNotifications();
    } catch {
      // Keep the current UI state if the request fails.
    } finally {
      setUpdatingAll(false);
    }
  }

  async function markOneAsRead(activityId: string) {
    setActiveReadId(activityId);
    try {
      const response = await fetch(`/api/activity/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true, readAt: new Date().toISOString() }),
      });

      const payload = (await response.json().catch(() => null)) as { success?: boolean } | null;
      if (!response.ok || !payload?.success) {
        return;
      }
      await fetchNotifications();
    } catch {
      // Keep the current UI state if the request fails.
    } finally {
      setActiveReadId(null);
    }
  }

  async function handleOpen(item: ActivityItem) {
    if (!item.isRead) {
      await markOneAsRead(item._id);
    }

    const path = buildActivityPath(item);
    if (!path) {
      return;
    }

    setOpen(false);
    router.push(path);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-9 w-9 rounded-full border-slate-200 bg-white/80 text-slate-700 hover:bg-slate-100"
          aria-label={t.title}
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white shadow ring-2 ring-white">
              {unreadBadge}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[calc(100vw-1rem)] max-w-104 rounded-2xl border border-slate-200 bg-white p-0 shadow-xl sm:w-104">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{t.title}</p>
            <p className="text-xs text-slate-500">{unreadCount} {t.unread}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => void fetchNotifications()}
              title={t.refresh}
            >
              <RefreshCw className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => void markAllAsRead()}
              disabled={updatingAll || unreadCount === 0}
            >
              {updatingAll ? <Loader2Icon className="mr-1 size-3.5 animate-spin" /> : <CheckCheck className="mr-1 size-3.5" />}
              {t.markAll}
            </Button>
          </div>
        </div>

        <div className="border-b border-slate-100 px-3 py-2">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              className={cn(
                'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                activeTab === 'unread' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'
              )}
              onClick={() => setActiveTab('unread')}
              aria-pressed={activeTab === 'unread'}
            >
              {t.unreadTab}
            </button>
            <button
              type="button"
              className={cn(
                'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                activeTab === 'read' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'
              )}
              onClick={() => setActiveTab('read')}
              aria-pressed={activeTab === 'read'}
            >
              {t.readTab}
            </button>
          </div>
        </div>

        <div className="max-h-[min(70vh,24rem)] overflow-y-auto px-2 py-2">
          {loading ? <p className="px-2 py-4 text-sm text-slate-500">{t.loading}</p> : null}

          {!loading && items.length === 0 ? (
            <p className="px-2 py-4 text-sm text-slate-500">{activeTab === 'read' ? t.readEmpty : t.unreadEmpty}</p>
          ) : null}

          {!loading
            ? items.map((item) => {
                const headline = getActivityHeadline(locale, item.action, item.metadata);
                const entityName =
                  item.entityType === 'invoice' && item.entityName
                    ? formatInvoiceDisplayNumber(locale, item.entityName)
                    : item.entityName;
                const itemPath = buildActivityPath(item);

                return (
                  <div
                    key={item._id}
                    className={cn(
                      'mb-1 rounded-xl border px-2 py-2 transition-colors',
                      item.isRead ? 'border-slate-100 bg-slate-50' : 'border-blue-200 bg-blue-50/40 shadow-sm'
                    )}
                  >
                    <button type="button" className="w-full text-left" onClick={() => void handleOpen(item)}>
                      <div className="flex items-start gap-2.5">
                        <div className={cn('mt-0.5 rounded-full p-1.5', item.isRead ? 'bg-slate-100' : 'bg-blue-100')}>
                          <FileText className={cn('size-3.5', item.isRead ? 'text-slate-400' : 'text-blue-600')} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{headline}</p>
                          <p className="truncate text-xs text-slate-600">{entityName || '-'}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{formatActivityRelativeTime(locale, item.createdAt)}</p>
                        </div>
                        {!item.isRead ? <span className="mt-1 size-2.5 shrink-0 rounded-full bg-blue-500" aria-hidden /> : null}
                      </div>
                    </button>

                    <div className="mt-2 flex items-center justify-between gap-1.5">
                      {!item.isRead ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 rounded-full px-2 text-[11px] text-slate-500 hover:text-slate-700"
                          onClick={() => void markOneAsRead(item._id)}
                          disabled={activeReadId === item._id}
                        >
                          {activeReadId === item._id ? <Loader2Icon className="mr-1 size-3 animate-spin" /> : <CheckCheck className="mr-1 size-3" />}
                          {t.markRead}
                        </Button>
                      ) : (
                        <div />
                      )}

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-full px-2 text-[11px]"
                        disabled={!itemPath}
                        onClick={() => void handleOpen(item)}
                      >
                        {t.open}
                      </Button>
                    </div>
                  </div>
                );
              })
            : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
