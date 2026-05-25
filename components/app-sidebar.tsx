"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Building2Icon, FileTextIcon, LayoutDashboardIcon, MessageSquareIcon, NotebookPenIcon, PackageSearchIcon, ReceiptTextIcon, SettingsIcon, TruckIcon, UsersIcon, WalletCardsIcon } from "lucide-react"
import { useLocale } from "@/components/providers/locale-provider"
import { useAuthMe } from "@/hooks/useAuthMe"
import { useSidebarBadges } from "@/hooks/useSidebarBadges"

type NavKey =
  | "dashboard"
  | "clients"
  | "suppliers"
  | "catalogue"
  | "quotes"
  | "invoices"
  | "tickets"
  | "expenses"
  | "notes"
  | "settings"
  | "companyProfile"

const navItems: ReadonlyArray<{
  key: NavKey
  url: string
  icon: React.ReactNode
}> = [
  { key: "dashboard", url: "/dashboard", icon: <LayoutDashboardIcon /> },
  { key: "clients", url: "/clients", icon: <UsersIcon /> },
  { key: "suppliers", url: "/suppliers", icon: <TruckIcon /> },
  { key: "catalogue", url: "/catalogue", icon: <PackageSearchIcon /> },
  { key: "quotes", url: "/quotes", icon: <ReceiptTextIcon /> },
  { key: "invoices", url: "/invoices", icon: <FileTextIcon /> },
  { key: "tickets", url: "/tickets", icon: <MessageSquareIcon /> },
  { key: "expenses", url: "/expenses", icon: <WalletCardsIcon /> },
  { key: "notes", url: "/notes", icon: <NotebookPenIcon /> },
  { key: "settings", url: "/settings", icon: <SettingsIcon /> },
  { key: "companyProfile", url: "/profile", icon: <Building2Icon /> },
]

const sidebarMessages = {
  en: {
    tagline: "Business context, always ready",
    workspace: "Workspace",
    badgeTitles: {
      accepted: (n: number) => `${n} new accepted`,
      pending: (n: number) => `${n} new pending`,
      rejected: (n: number) => `${n} new rejected`,
      paid: (n: number) => `${n} new paid`,
      overdue: (n: number) => `${n} new overdue`,
      unreadTickets: (n: number) => `${n} unread tickets`,
      unpaidExpenses: (n: number) => `${n} unpaid expenses`,
      overdueExpenses: (n: number) => `${n} overdue expenses`,
    },
    nav: {
      dashboard: "Dashboard",
      clients: "Clients",
      suppliers: "Suppliers",
      catalogue: "Products & Services",
      quotes: "Quotes",
      notes: "Notes",
      expenses: "Expenses",
      settings: "Settings",
      invoices: "Invoices",
      tickets: "Tickets",
      companyProfile: "Company profile",
    },
  },
  fr: {
    tagline: "Contexte métier, toujours prêt",
    workspace: "Espace de travail",
    badgeTitles: {
      accepted: (n: number) => `${n} nouveau(x) accepté(s)`,
      pending: (n: number) => `${n} nouveau(x) en attente`,
      rejected: (n: number) => `${n} nouveau(x) refusé(s)`,
      paid: (n: number) => `${n} nouvelle(s) payée(s)`,
      overdue: (n: number) => `${n} nouvelle(s) en retard`,
      unreadTickets: (n: number) => `${n} ticket(s) non lu(s)`,
      unpaidExpenses: (n: number) => `${n} depense(s) impayee(s)`,
      overdueExpenses: (n: number) => `${n} depense(s) en retard`,
    },
    nav: {
      dashboard: "Tableau de bord",
      clients: "Clients",
      suppliers: "Fournisseurs",
      catalogue: "Produits & Services",
      quotes: "Devis",
      notes: "Notes",
      expenses: "Dépenses",
      settings: "Paramètres",
      invoices: "Factures",
      tickets: "Tickets",
      companyProfile: "Profil d'entreprise",
    },
  },
} as const

type BadgeTone = "green" | "orange" | "red"

const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  green: "bg-emerald-500",
  orange: "bg-amber-500",
  red: "bg-red-600",
}

function StatusBadge({ count, tone, title }: { count: number; tone: BadgeTone; title: string }) {
  if (count <= 0) return null
  return (
    <span
      className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${BADGE_TONE_CLASSES[tone]}`}
      title={title}
      aria-label={title}
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { locale } = useLocale()
  const t = sidebarMessages[locale]
  const { user } = useAuthMe()
  const { badges } = useSidebarBadges()
  const visibleNavItems = navItems.filter((item) => {
    if (item.key === "dashboard") {
      return user?.featureFlags?.financialDashboard !== false
    }
    if (item.key === "tickets") {
      return user?.featureFlags?.tickets !== false
    }
    if (item.key === "expenses") {
      return user?.featureFlags?.expenses !== false
    }
    return true
  })

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu className="px-1 pt-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-auto rounded-xl border border-sidebar-border/60 bg-sidebar-accent/40 px-3 py-3 data-[slot=sidebar-menu-button]:p-3! hover:bg-sidebar-accent/60"
            >
              <div className="flex w-full flex-col items-center gap-1.5">
                <Image
                  src="/logo.png"
                  alt="Roby"
                  width={110}
                  height={38}
                  style={{ height: "auto" }}
                  className="mix-blend-multiply dark:mix-blend-normal dark:brightness-0 dark:invert"
                />
                <span className="text-[11px] text-muted-foreground tracking-wide">{t.tagline}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="pt-1">
          <SidebarGroupLabel>{t.workspace}</SidebarGroupLabel>
          <SidebarMenu className="px-2">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.url || pathname.startsWith(`${item.url}/`)

              let badgeNode: React.ReactNode = null
              if (item.key === "quotes") {
                const { accepted, pending, rejected } = badges.quotes
                if (accepted + pending + rejected > 0) {
                  badgeNode = (
                    <span className="ml-auto flex items-center gap-1">
                      <StatusBadge count={accepted} tone="green" title={t.badgeTitles.accepted(accepted)} />
                      <StatusBadge count={pending} tone="orange" title={t.badgeTitles.pending(pending)} />
                      <StatusBadge count={rejected} tone="red" title={t.badgeTitles.rejected(rejected)} />
                    </span>
                  )
                }
              } else if (item.key === "invoices") {
                const { paid, pending, overdue } = badges.invoices
                if (paid + pending + overdue > 0) {
                  badgeNode = (
                    <span className="ml-auto flex items-center gap-1">
                      <StatusBadge count={paid} tone="green" title={t.badgeTitles.paid(paid)} />
                      <StatusBadge count={pending} tone="orange" title={t.badgeTitles.pending(pending)} />
                      <StatusBadge count={overdue} tone="red" title={t.badgeTitles.overdue(overdue)} />
                    </span>
                  )
                }
              } else if (item.key === "tickets") {
                const unread = badges.tickets.unread
                if (unread > 0) {
                  badgeNode = (
                    <span className="ml-auto flex items-center gap-1">
                      <StatusBadge count={unread} tone="red" title={t.badgeTitles.unreadTickets(unread)} />
                    </span>
                  )
                }
              } else if (item.key === "expenses") {
                const { unpaid, overdue } = badges.expenses
                if (unpaid + overdue > 0) {
                  badgeNode = (
                    <span className="ml-auto flex items-center gap-1">
                      <StatusBadge count={unpaid} tone="orange" title={t.badgeTitles.unpaidExpenses(unpaid)} />
                      <StatusBadge count={overdue} tone="red" title={t.badgeTitles.overdueExpenses(overdue)} />
                    </span>
                  )
                }
              }

              return (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="h-10 bg-transparent text-(--color-text-secondary) hover:bg-transparent hover:text-(--color-text-secondary) data-[active=true]:bg-(--color-background-info) data-[active=true]:text-(--color-text-info)"
                  >
                    <Link href={item.url}>
                      {item.icon}
                      <span>{t.nav[item.key]}</span>
                      {badgeNode}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
