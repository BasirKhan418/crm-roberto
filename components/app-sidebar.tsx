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
import { Building2Icon, FileTextIcon, LayoutDashboard, LayoutDashboardIcon, NotebookPenIcon, PackageSearchIcon, ReceiptTextIcon, SettingsIcon, TruckIcon, UsersIcon } from "lucide-react"
import { useLocale } from "@/components/providers/locale-provider"
import { useInvoicesActionCount } from "@/hooks/useInvoicesActionCount"
import { useQuotesActionCount } from "@/hooks/useQuotesActionCount"

const navItems = [
  { key: "dashboard", url: "/dashboard", icon: <LayoutDashboardIcon /> },
  { key: "clients", url: "/clients", icon: <UsersIcon /> },
  { key: "suppliers", url: "/suppliers", icon: <TruckIcon /> },
  { key: "catalogue", url: "/catalogue", icon: <PackageSearchIcon /> },
  { key: "quotes", url: "/quotes", icon: <ReceiptTextIcon /> },
  { key: "invoices", url: "/invoices", icon: <FileTextIcon /> },
  { key: "notes", url: "/notes", icon: <NotebookPenIcon /> },
  { key: "settings", url: "/settings", icon: <SettingsIcon /> },
  { key: "companyProfile", url: "/profile", icon: <Building2Icon /> },
] as const

const sidebarMessages = {
  en: {
    tagline: "Business context, always ready",
    workspace: "Workspace",
    preferences: "Preferences",
    language: "Language",
    badges: {
      declined: (count: number) => `${count} declined — mark as reviewed`,
      pendingInvoice: (count: number) => `${count} to invoice`,
      overdue: (count: number) => `${count} overdue`,
      partialPaid: (count: number) => `${count} partially paid`,
      unpaid: (count: number) => `${count} unpaid`,
    },
    nav: {
      dashboard: "Dashboard",
      clients: "Clients",
      suppliers: "Suppliers",
      catalogue: "Products & Services",
      quotes: "Quotes",
      notes: "Notes",
      settings: "Settings",
      invoices: "Invoices",
      companyProfile: "Company profile",
    },
  },
  fr: {
    tagline: "Contexte métier, toujours prêt",
    workspace: "Espace de travail",
    preferences: "Préférences",
    language: "Langue",
    badges: {
      declined: (count: number) => `${count} refusé(s) — à marquer comme traité`,
      pendingInvoice: (count: number) => `${count} à facturer`,
      overdue: (count: number) => `${count} en retard`,
      partialPaid: (count: number) => `${count} partiellement payée(s)`,
      unpaid: (count: number) => `${count} impayé(e)(s)`,
    },
    nav: {
      dashboard: "Tableau de bord",
      clients: "Clients",
      suppliers: "Fournisseurs",
      catalogue: "Produits & Services",
      quotes: "Devis",
      notes: "Notes",
      settings: "Paramètres",
      invoices: "Factures",
      companyProfile: "Profil d'entreprise",
    },
  },
} as const

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { locale } = useLocale()
  const t = sidebarMessages[locale]
  const { unacknowledgedRejectedCount, pendingInvoiceCount } = useQuotesActionCount()
  const { overdueCount, partialPaidCount, unpaidCount } = useInvoicesActionCount()

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
            {navItems.map((item) => (
              <SidebarMenuItem key={item.key}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.url || pathname.startsWith(`${item.url}/`)}
                  className="h-10 bg-transparent text-(--color-text-secondary) hover:bg-transparent hover:text-(--color-text-secondary) data-[active=true]:bg-(--color-background-info) data-[active=true]:text-(--color-text-info)"
                >
                  <Link href={item.url}>
                    {item.icon}
                    <span>{t.nav[item.key]}</span>
                    {item.key === "quotes" && (unacknowledgedRejectedCount > 0 || pendingInvoiceCount > 0) ? (
                      <span className="ml-auto flex items-center gap-1">
                        {unacknowledgedRejectedCount > 0 ? (
                          <span
                            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                            style={{ backgroundColor: '#ea580c' }}
                            title={t.badges.declined(unacknowledgedRejectedCount)}
                          >
                            {unacknowledgedRejectedCount > 99 ? '99+' : unacknowledgedRejectedCount}
                          </span>
                        ) : null}
                        {pendingInvoiceCount > 0 ? (
                          <span
                            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                            style={{ backgroundColor: 'var(--color-text-success)' }}
                            title={t.badges.pendingInvoice(pendingInvoiceCount)}
                          >
                            {pendingInvoiceCount > 99 ? '99+' : pendingInvoiceCount}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                    {item.key === "invoices" && (overdueCount > 0 || unpaidCount > 0 || partialPaidCount > 0) ? (
                      <span className="ml-auto flex items-center gap-1">
                        {overdueCount > 0 ? (
                          <span
                            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                            style={{ backgroundColor: 'var(--color-text-danger)' }}
                            title={t.badges.overdue(overdueCount)}
                          >
                            {overdueCount > 99 ? '99+' : overdueCount}
                          </span>
                        ) : null}
                        {partialPaidCount > 0 ? (
                          <span
                            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold"
                            style={{ backgroundColor: '#f59e0b', color: '#ffffff' }}
                            title={t.badges.partialPaid(partialPaidCount)}
                          >
                            {partialPaidCount > 99 ? '99+' : partialPaidCount}
                          </span>
                        ) : null}
                        {unpaidCount > 0 ? (
                          <span
                            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                            style={{ backgroundColor: '#6366f1' }}
                            title={t.badges.unpaid(unpaidCount)}
                          >
                            {unpaidCount > 99 ? '99+' : unpaidCount}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
