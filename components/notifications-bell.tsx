"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, FileText, RefreshCw } from "lucide-react";

import { useLocale } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatActivityRelativeTime, getActivityHeadline } from "@/lib/i18n/messages";

interface NotificationItem {
  _id: string;
  action: string;
  entityType: string;
  entityName: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  isRead?: boolean;
}

interface ActivityListResponse {
  success: boolean;
  data?: NotificationItem[];
  unreadCount?: number;
}

interface ActivitySseEvent {
  id: string;
  type: "created" | "updated" | "deleted" | "read_all";
  activityId?: string | null;
  at: number;
}

const bellMessages = {
  en: {
    title: "Notifications",
    empty: "No new activity right now.",
    markAllRead: "Mark all as read",
    loading: "Loading notifications...",
    viewUpdates: "Update",
    newQuote: "New quote created",
    signedQuote: "Quote accepted",
    newInvoice: "New invoice created",
    quoteSent: "Quote sent",
    quoteUpdated: "Quote updated",
    quoteDeleted: "Quote deleted",
    invoicePaymentReceived: 'Payment received',
    statusChanged: "Status updated",
    amountPaid: 'Amount paid',
    invoiceDueOn: "Due on",
    sentTo: "Sent to",
    movedTo: "Moved to",
    fromQuote: "From quote",
    openItem: "Open item",
    refresh: "Refresh",
    read: "Read",
    newLabel: "new",
  },
  fr: {
    title: "Notifications",
    empty: "Aucune nouvelle activité pour le moment.",
    markAllRead: "Tout marquer comme lu",
    loading: "Chargement des notifications...",
    viewUpdates: "Mise à jour",
    newQuote: "Nouveau devis créé",
    signedQuote: "Devis accepté",
    newInvoice: "Nouvelle facture créée",
    quoteSent: "Devis envoyé",
    quoteUpdated: "Devis mis à jour",
    quoteDeleted: "Devis supprimé",
    invoicePaymentReceived: 'Paiement reçu',
    statusChanged: "Statut mis à jour",
    amountPaid: 'Montant payé',
    invoiceDueOn: "Échéance le",
    sentTo: "Envoyé à",
    movedTo: "Passé à",
    fromQuote: "Depuis le devis",
    openItem: "Ouvrir l'élément",
    refresh: "Actualiser",
    read: "Lu",
    newLabel: "nouveau",
  },
} as const;

function getMetaString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function getStatusLabel(locale: "en" | "fr", status: string | null): string {
  if (!status) {
    return locale === "fr" ? "mis à jour" : "updated";
  }

  const normalized = status.toLowerCase();

  if (locale === "fr") {
    if (normalized === "accepted") return "accepté";
    if (normalized === "refused") return "refusé";
    if (normalized === "rejected") return "rejeté";
    if (normalized === "sent") return "envoyé";
    if (normalized === "draft") return "brouillon";
    return normalized;
  }

  return normalized;
}

function formatNotificationDate(locale: "en" | "fr", dateValue: string | null): string | null {
  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildActivityPath(item: NotificationItem): string | null {
  if (item.action?.endsWith("_deleted")) {
    return null;
  }

  if (item.entityType === "note") {
    return "/notes";
  }

  const basePathByEntity: Record<string, string> = {
    quote: "quotes",
    invoice: "invoices",
    client: "clients",
    supplier: "suppliers",
  };

  const basePath = basePathByEntity[item.entityType];
  if (!basePath) {
    return null;
  }

  return item.entityId ? `/${basePath}/${item.entityId}` : `/${basePath}`;
}

function pickNotificationTitle(item: NotificationItem, locale: "en" | "fr"): string {
  const t = bellMessages[locale];

  if (item.action === "quote_created") {
    return t.newQuote;
  }

  if (item.action === "invoice_created") {
    return t.newInvoice;
  }

  if (item.action === "quote_status_changed") {
    const toStatus = typeof item.metadata?.to === "string" ? item.metadata.to.toLowerCase() : "";
    if (toStatus === "accepted") {
      return t.signedQuote;
    }

    return `${t.statusChanged}: ${getStatusLabel(locale, toStatus)}`;
  }

  if (item.action === "quote_sent") {
    return t.quoteSent;
  }

  if (item.action === "quote_updated") {
    return t.quoteUpdated;
  }

  if (item.action === 'invoice_payment_received') {
    return t.invoicePaymentReceived;
  }

  if (item.action === "quote_deleted") {
    return t.quoteDeleted;
  }

  return t.viewUpdates;
}

function buildNotificationDetails(item: NotificationItem, locale: "en" | "fr"): string {
  const t = bellMessages[locale];
  const headline = getActivityHeadline(locale, item.action);

  if (item.action === "quote_status_changed") {
    const toStatus = getMetaString(item.metadata, "to");
    const fromStatus = getMetaString(item.metadata, "from");
    const targetLabel = getStatusLabel(locale, toStatus);
    const originLabel = getStatusLabel(locale, fromStatus);
    return `${item.entityName} - ${originLabel} -> ${targetLabel}`;
  }

  if (item.action === "quote_sent") {
    const sentTo = getMetaString(item.metadata, "sentTo");
    if (sentTo) {
      return `${item.entityName} - ${t.sentTo} ${sentTo}`;
    }
    return item.entityName || headline;
  }

  if (item.action === "invoice_created") {
    const dueDateText = formatNotificationDate(locale, getMetaString(item.metadata, "dueDate"));
    const quoteNumber = getMetaString(item.metadata, "quoteNumber");

    if (dueDateText && quoteNumber) {
      return `${item.entityName} - ${t.invoiceDueOn} ${dueDateText} - ${t.fromQuote} ${quoteNumber}`;
    }

    if (dueDateText) {
      return `${item.entityName} - ${t.invoiceDueOn} ${dueDateText}`;
    }

    if (quoteNumber) {
      return `${item.entityName} - ${t.fromQuote} ${quoteNumber}`;
    }

    return item.entityName || headline;
  }

  if (item.action === 'invoice_payment_received') {
    const amount = item.metadata?.amount;
    if (typeof amount === 'number' && Number.isFinite(amount)) {
      const formatted = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
        style: 'currency',
        currency: 'EUR',
      }).format(amount / 100);
      return `${item.entityName} - ${t.amountPaid} ${formatted}`;
    }

    return item.entityName || headline;
  }

  return item.entityName || headline;
}

function pickIcon(item: NotificationItem) {
  if (item.action === "invoice_created" || item.action === 'invoice_payment_received') {
    return FileText;
  }

  if (item.action === "quote_created" || item.action === "quote_status_changed") {
    return FileText;
  }

  return Bell;
}

export function NotificationsBell() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = bellMessages[locale];

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const unreadBadgeValue = useMemo(() => {
    if (unreadCount > 99) {
      return "99+";
    }
    return String(unreadCount);
  }, [unreadCount]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/activity?sortBy=createdAt&sortOrder=desc&limit=12", {
        cache: "no-store",
      });
      const payload = (await response.json()) as ActivityListResponse;

      if (!response.ok || !payload.success) {
        return;
      }

      const nextItems = Array.isArray(payload.data) ? payload.data : [];
      setItems(nextItems);
      setUnreadCount(typeof payload.unreadCount === "number" ? payload.unreadCount : 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    let source: EventSource | null = null;
    let closedByUnmount = false;

    const connect = () => {
      source = new EventSource("/api/activity/events");

      source.addEventListener("activity_changed", (event) => {
        if (!event.data) return;

        try {
          const payload = JSON.parse(event.data) as ActivitySseEvent;
          if (!payload?.id) {
            return;
          }
          void fetchNotifications();
        } catch {
          // Ignore malformed SSE payloads.
        }
      });

      source.onerror = () => {
        if (closedByUnmount) {
          source?.close();
          return;
        }

        // Browser reconnects automatically; force a fresh fetch while reconnecting.
        void fetchNotifications();
      };
    };

    connect();

    return () => {
      closedByUnmount = true;
      source?.close();
    };
  }, [fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    if (markingAllRead) {
      return;
    }

    const previousItems = items;
    const previousUnreadCount = unreadCount;
    setMarkingAllRead(true);
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);

    try {
      await fetch("/api/activity/read-all", { method: "PATCH" });
    } catch {
      setItems(previousItems);
      setUnreadCount(previousUnreadCount);
    } finally {
      setMarkingAllRead(false);
    }
  }, [items, markingAllRead, unreadCount]);

  const markNotificationAsRead = useCallback(async (activityId: string) => {
    const existing = items.find((item) => item._id === activityId);
    const wasUnread = Boolean(existing && !existing.isRead);

    if (!wasUnread) {
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item._id === activityId
          ? {
              ...item,
              isRead: true,
            }
          : item
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      const response = await fetch(`/api/activity/${activityId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isRead: true,
          readAt: new Date().toISOString(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as { success?: boolean } | null;
      if (!response.ok || !payload?.success) {
        throw new Error("Failed to mark notification as read");
      }
    } catch {
      setItems((prev) =>
        prev.map((item) =>
          item._id === activityId
            ? {
                ...item,
                isRead: false,
              }
            : item
        )
      );
      setUnreadCount((prev) => prev + 1);
    }
  }, [items]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      void fetchNotifications();
    }
  }, [fetchNotifications]);

  const handleOpenNotification = useCallback((item: NotificationItem) => {
    const path = buildActivityPath(item);
    if (!path) {
      return;
    }

    if (!item.isRead) {
      void markNotificationAsRead(item._id);
    }

    setOpen(false);
    router.push(path);
  }, [markNotificationAsRead, router]);

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
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
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white/80">
              {unreadBadgeValue}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[calc(100vw-1rem)] max-w-104 rounded-2xl border border-slate-200 bg-white p-0 shadow-xl sm:w-104">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{t.title}</p>
            <p className="text-xs text-slate-500">{`${unreadCount} ${t.newLabel}`}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={fetchNotifications}>
              <RefreshCw className="size-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={markAllAsRead} disabled={markingAllRead || unreadCount === 0}>
              <CheckCheck className="size-3.5" />
              <span>{t.markAllRead}</span>
            </Button>
          </div>
        </div>

        <div className="max-h-[min(70vh,26rem)] overflow-y-auto px-2 py-2">
          {loading ? (
            <p className="px-2 py-4 text-sm text-slate-500">{t.loading}</p>
          ) : null}

          {!loading && items.length === 0 ? (
            <p className="px-2 py-4 text-sm text-slate-500">{t.empty}</p>
          ) : null}

          {!loading
            ? items.map((item) => {
                const title = pickNotificationTitle(item, locale);
                const details = buildNotificationDetails(item, locale);
                const path = buildActivityPath(item);
                const Icon = pickIcon(item);

                return (
                  <div
                    key={item._id}
                    className={cn(
                      "mb-1 rounded-xl border px-2 py-2 transition-colors",
                      item.isRead
                        ? "border-slate-100 bg-slate-50"
                        : "border-slate-200 bg-white shadow-[0_1px_0_0_rgba(15,23,42,0.04)]"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cn("mt-0.5 rounded-full p-1.5", item.isRead ? "bg-slate-200" : "bg-slate-100") }>
                        <Icon className="size-3.5 text-slate-700" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
                        <p className="truncate text-xs text-slate-600">{details}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{formatActivityRelativeTime(locale, item.createdAt)}</p>
                      </div>

                      {!item.isRead ? <span className="mt-1 size-2 rounded-full bg-[#001e3c]" aria-hidden /> : null}
                    </div>

                    <div className="mt-2 flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-full px-2 text-[11px]"
                        disabled={!path}
                        onClick={() => handleOpenNotification(item)}
                      >
                        {t.openItem}
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
