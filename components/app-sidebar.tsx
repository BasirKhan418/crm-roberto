"use client"

import * as React from "react"
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
import { Building2Icon, FileTextIcon, LayoutDashboard, LayoutDashboardIcon, NotebookPenIcon, PackageSearchIcon, ReceiptTextIcon, SettingsIcon, TruckIcon, UsersIcon, WalletCardsIcon } from "lucide-react"
import { useLocale } from "@/components/providers/locale-provider"
import { useSidebarBadges } from "@/hooks/useSidebarBadges"

type NavKey =
  | "dashboard"
  | "clients"
  | "suppliers"
  | "catalogue"
  | "quotes"
  | "invoices"
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
    },
    nav: {
      dashboard: "Tableau de bord",
      clients: "Clients",
      suppliers: "Fournisseurs",
      catalogue: "Produits & Services",
      quotes: "Devis",
      notes: "Notes",
      expenses: "Depenses",
      settings: "Paramètres",
      invoices: "Factures",
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
  const { badges } = useSidebarBadges()

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu className="px-1 pt-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-auto rounded-xl border border-sidebar-border/80 bg-sidebar-accent/50 p-2 data-[slot=sidebar-menu-button]:p-2!"
            >
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary p-1.5 text-primary-foreground">
                  <LayoutDashboard className="size-4" />
                </div>
                <div className="grid text-left leading-tight">
                  <span className="text-base font-semibold">CRM Roberto</span>
                  <span className="text-xs text-muted-foreground">{t.tagline}</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="pt-1">
          <SidebarGroupLabel>{t.workspace}</SidebarGroupLabel>
          <SidebarMenu className="px-2">
            {navItems.map((item) => {
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
