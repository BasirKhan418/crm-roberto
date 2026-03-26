'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Skeleton } from '@/components/ui/skeleton';
import type { ActivityItem } from '@/hooks/useDashboard';
import { useLocale } from '@/components/providers/locale-provider';

const DOT_CLASS: Record<string, string> = {
  client: 'bg-emerald-500',
  supplier: 'bg-amber-500',
  note: 'bg-sky-500',
};

const ACTION_LABEL: Record<'en' | 'fr', Record<string, string>> = {
  en: {
    client_created: 'Client added',
    client_updated: 'Client updated',
    client_deleted: 'Client deleted',
    supplier_created: 'Supplier added',
    supplier_updated: 'Supplier updated',
    supplier_deleted: 'Supplier deleted',
    note_created: 'Note created',
    note_updated: 'Note updated',
    note_deleted: 'Note deleted',
  },
  fr: {
    client_created: 'Client ajoute',
    client_updated: 'Client mis a jour',
    client_deleted: 'Client supprime',
    supplier_created: 'Fournisseur ajoute',
    supplier_updated: 'Fournisseur mis a jour',
    supplier_deleted: 'Fournisseur supprime',
    note_created: 'Note creee',
    note_updated: 'Note mise a jour',
    note_deleted: 'Note supprimee',
  },
};

interface ActivityFeedProps {
  activity?: ActivityItem[];
  loading?: boolean;
  error?: string | null;
}

function relativeTime(dateString?: string): string {
  if (!dateString) {
    return '--';
  }

  const timestamp = new Date(dateString).getTime();

  if (!Number.isFinite(timestamp)) {
    return '--';
  }

  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / 60000);

  if (mins < 1) {
    return 'Just now';
  }

  if (mins < 60) {
    return `${mins}m ago`;
  }

  if (mins < 1440) {
    return `${Math.floor(mins / 60)}h ago`;
  }

  if (mins < 2880) {
    return 'Yesterday';
  }

  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getActivityText(item: ActivityItem): string {
  const action = item.action ? (ACTION_LABEL.en[item.action] ?? item.action) : 'Activity';
  const name = item.entityName ? ` - ${item.entityName}` : '';

  return `${action}${name}`;
}

export default function ActivityFeed({ activity = [], loading = false, error = null }: ActivityFeedProps) {
  const { locale } = useLocale();
  const t = {
    en: { title: 'Recent activity', empty: 'No activity yet. Add your first client to get started.' },
    fr: { title: 'Activite recente', empty: 'Aucune activite pour le moment. Ajoutez votre premier client pour commencer.' },
  }[locale];
  const items = Array.isArray(activity) ? activity.slice(0, 10) : [];
  const showError = Boolean(error) && items.length === 0;

  return (
    <Card className="h-full gap-0">
      <CardHeader className="border-b">
        <CardTitle className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-4 pt-4">
        {showError ? <ErrorMessage message={error ?? undefined} /> : null}

        {loading &&
          [1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} className="h-4 w-full" style={{ opacity: 1 - index * 0.12 }} />
          ))}

        {!loading &&
          items.map((item, index) => {
            const isLast = index === items.length - 1;

            return (
              <div
                key={item._id ?? `${item.createdAt ?? 'activity'}-${index}`}
                className={`flex items-start gap-3 py-2 ${isLast ? '' : 'border-b border-border/70'}`}
              >
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT_CLASS[item.entityType ?? ''] ?? 'bg-muted-foreground/50'}`}
                />
                <p className="flex-1 text-sm text-foreground">{getActivityText(item)}</p>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {relativeTime(item.createdAt)}
                </span>
              </div>
            );
          })}

        {!loading && !showError && items.length === 0 ? (
          <EmptyState message={t.empty} />
        ) : null}
      </CardContent>
    </Card>
  );
}