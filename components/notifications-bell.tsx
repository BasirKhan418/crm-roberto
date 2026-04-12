"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, FileText, RefreshCw, Search } from "lucide-react";

import { useLocale } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatActivityRelativeTime, formatInvoiceDisplayNumber, getActivityHeadline } from "@/lib/i18n/messages";

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

type NotificationsTab = "unread" | "read";

const bellMessages = {
  en: {
    title: "Notifications",
    empty: "No new activity right now.",
    noResults: "No notifications match your search.",
    searchPlaceholder: "Search notifications…",
    markAllRead: "Mark all as read",
    loading: "Loading notifications...",
    unreadTab: "Unread",
    readTab: "Read",
    viewUpdates: "Update",
    newQuote: "New quote created",
    signedQuote: "Quote accepted",
    newInvoice: "New invoice created",
    quoteSent: "Quote sent",
    clientReply: "Client replied",
    quoteUpdated: "Quote updated",
    quoteDeleted: "Quote deleted",
    invoicePaymentReceived: 'Payment received',
    statusChanged: "Status updated",
    amountPaid: 'Amount paid',
    invoiceDueOn: "Due on",
    sentTo: "Sent to",
    fromClient: "From",
    movedTo: "Moved to",
    fromQuote: "From quote",
    openItem: "Open item",
    refresh: "Refresh",
    read: "Read",
    newLabel: "new",
    unreadEmpty: "No unread notifications.",
    readEmpty: "No read notifications yet.",
  },
  fr: {
    title: "Notifications",
    empty: "Aucune nouvelle activité pour le moment.",
    noResults: "Aucune notification ne correspond à votre recherche.",
    searchPlaceholder: "Rechercher…",
    markAllRead: "Tout marquer comme lu",
    loading: "Chargement des notifications...",
    unreadTab: "Non lues",
    readTab: "Lues",
    viewUpdates: "Mise à jour",
    newQuote: "Nouveau devis créé",
    signedQuote: "Devis accepté",
    newInvoice: "Nouvelle facture créée",
    quoteSent: "Devis envoyé",
    clientReply: "Le client a répondu",
    quoteUpdated: "Devis mis à jour",
    quoteDeleted: "Devis supprimé",
    invoicePaymentReceived: 'Paiement reçu',
    statusChanged: "Statut mis à jour",
    amountPaid: 'Montant payé',
    invoiceDueOn: "Échéance le",
    sentTo: "Envoyé à",
    fromClient: "De la part de",
    movedTo: "Passé à",
    fromQuote: "Depuis le devis",
    openItem: "Ouvrir l'élément",
    refresh: "Actualiser",
    read: "Lu",
    newLabel: "nouveau",
    unreadEmpty: "Aucune notification non lue.",
    readEmpty: "Aucune notification lue pour le moment.",
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

  if (item.action === "quote_client_replied") {
    return t.clientReply;
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

function getNotificationEntityName(item: NotificationItem, locale: "en" | "fr"): string {
  if (item.entityType === "invoice" && item.entityName) {
    return formatInvoiceDisplayNumber(locale, item.entityName);
  }

  return item.entityName;
}

function buildNotificationDetails(item: NotificationItem, locale: "en" | "fr"): string {
  const t = bellMessages[locale];
  const headline = getActivityHeadline(locale, item.action);
  const entityName = getNotificationEntityName(item, locale);

  if (item.action === "quote_status_changed") {
    const toStatus = getMetaString(item.metadata, "to");
    const fromStatus = getMetaString(item.metadata, "from");
    const targetLabel = getStatusLabel(locale, toStatus);
    const originLabel = getStatusLabel(locale, fromStatus);
    return `${entityName} - ${originLabel} -> ${targetLabel}`;
  }

  if (item.action === "quote_sent") {
    const sentTo = getMetaString(item.metadata, "sentTo");
    if (sentTo) {
      return `${entityName} - ${t.sentTo} ${sentTo}`;
    }
    return entityName || headline;
  }

  if (item.action === "quote_client_replied") {
    const clientName = getMetaString(item.metadata, "clientName");
    const messagePreview = getMetaString(item.metadata, "messagePreview");

    if (clientName && messagePreview) {
      return `${entityName} - ${t.fromClient} ${clientName} - ${messagePreview}`;
    }

    if (clientName) {
      return `${entityName} - ${t.fromClient} ${clientName}`;
    }

    return entityName || headline;
  }

  if (item.action === "invoice_created") {
    const dueDateText = formatNotificationDate(locale, getMetaString(item.metadata, "dueDate"));
    const quoteNumber = getMetaString(item.metadata, "quoteNumber");

    if (dueDateText && quoteNumber) {
      return `${entityName} - ${t.invoiceDueOn} ${dueDateText} - ${t.fromQuote} ${quoteNumber}`;
    }

    if (dueDateText) {
      return `${entityName} - ${t.invoiceDueOn} ${dueDateText}`;
    }

    if (quoteNumber) {
      return `${entityName} - ${t.fromQuote} ${quoteNumber}`;
    }

    return entityName || headline;
  }

  if (item.action === 'invoice_payment_received') {
    const amount = item.metadata?.amount;
    if (typeof amount === 'number' && Number.isFinite(amount)) {
      const formatted = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
        style: 'currency',
        currency: 'EUR',
      }).format(amount / 100);
      return `${entityName} - ${t.amountPaid} ${formatted}`;
    }

    return entityName || headline;
  }

  return entityName || headline;
}

function pickIcon(item: NotificationItem) {
  if (item.action === "invoice_created" || item.action === 'invoice_payment_received') {
    return FileText;
  }

  if (item.action === "quote_created" || item.action === "quote_status_changed" || item.action === "quote_client_replied") {
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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<NotificationsTab>("unread");
  const searchQueryRef = useRef("");
  const activeTabRef = useRef<NotificationsTab>("unread");

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const unreadBadgeValue = useMemo(() => {
    if (unreadCount > 99) {
      return "99+";
    }
    return String(unreadCount);
  }, [unreadCount]);

  const fetchNotifications = useCallback(async (tab?: NotificationsTab) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sortBy: "createdAt", sortOrder: "desc", limit: "12" });
      const search = searchQueryRef.current.trim();
      if (search) params.set("search", search);
      const targetTab = tab ?? activeTabRef.current;
      params.set("isRead", targetTab === "read" ? "true" : "false");
      const response = await fetch(`/api/activity?${params.toString()}`, {
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
    void fetchNotifications(activeTab);
  }, [activeTab, fetchNotifications]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void fetchNotifications(activeTab);
  }, [activeTab, fetchNotifications, open]);

  // Debounced re-fetch when search query changes (skip initial mount)
  const isFirstSearchRender = useRef(true);
  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false;
      return;
    }
    const timer = setTimeout(() => { void fetchNotifications(activeTabRef.current); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchNotifications]);

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
          // Only re-fetch for externally triggered events.
          // read/read_all are optimistically updated locally — re-fetching
          // on those events risks a race that reverts the optimistic state.
          if (payload.type === "created" || payload.type === "deleted") {
            void fetchNotifications(activeTabRef.current);
          }
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
        void fetchNotifications(activeTabRef.current);
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
    setItems([]);
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

    setItems((prev) => prev.filter((item) => item._id !== activityId));
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
      void fetchNotifications(activeTabRef.current);
    }
  }, [fetchNotifications, items]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      void fetchNotifications(activeTabRef.current);
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
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white shadow ring-2 ring-white">
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
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => void fetchNotifications(activeTabRef.current)}>
              <RefreshCw className="size-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={markAllAsRead} disabled={markingAllRead || unreadCount === 0}>
              <CheckCheck className="size-3.5" />
              <span>{t.markAllRead}</span>
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="border-b border-slate-100 px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              className={cn(
                "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                activeTab === "unread" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"
              )}
              onClick={() => setActiveTab("unread")}
              aria-pressed={activeTab === "unread"}
            >
              {t.unreadTab}
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                activeTab === "read" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"
              )}
              onClick={() => setActiveTab("read")}
              aria-pressed={activeTab === "read"}
            >
              {t.readTab}
            </button>
          </div>
        </div>

        <div className="max-h-[min(70vh,24rem)] overflow-y-auto px-2 py-2">
          {loading ? (
            <p className="px-2 py-4 text-sm text-slate-500">{t.loading}</p>
          ) : null}

          {!loading && items.length === 0 ? (
            <p className="px-2 py-4 text-sm text-slate-500">
              {searchQuery.trim() ? t.noResults : activeTab === "read" ? t.readEmpty : t.unreadEmpty}
            </p>
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
                        : "border-blue-200 bg-blue-50/40 shadow-sm"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cn("mt-0.5 rounded-full p-1.5", item.isRead ? "bg-slate-100" : "bg-blue-100") }>
                        <Icon className={cn("size-3.5", item.isRead ? "text-slate-400" : "text-blue-600")} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
                        <p className="truncate text-xs text-slate-600">{details}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{formatActivityRelativeTime(locale, item.createdAt)}</p>
                      </div>

                      {!item.isRead ? <span className="mt-1 size-2.5 shrink-0 rounded-full bg-blue-500" aria-hidden /> : null}
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-1.5">
                      {!item.isRead && activeTab === "unread" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 rounded-full px-2 text-[11px] text-slate-500 hover:text-slate-700"
                          onClick={() => void markNotificationAsRead(item._id)}
                        >
                          <CheckCheck className="mr-0.5 size-3" />
                          {t.read}
                        </Button>
                      ) : (
                        <div />
                      )}
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
