"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Building2Icon, FileTextIcon, LayoutDashboard, LayoutDashboardIcon, LogOutIcon, NotebookPenIcon, PackageSearchIcon, ReceiptTextIcon, TruckIcon, UsersIcon } from "lucide-react"
import { useLocale } from "@/components/providers/locale-provider"
import { useAuthMe } from "@/hooks/useAuthMe"
import { useSignedQuotesCount } from "@/hooks/useSignedQuotesCount"

const navItems = [
  { key: "dashboard", url: "/dashboard", icon: <LayoutDashboardIcon /> },
  { key: "clients", url: "/clients", icon: <UsersIcon /> },
  { key: "suppliers", url: "/suppliers", icon: <TruckIcon /> },
  { key: "catalogue", url: "/catalogue", icon: <PackageSearchIcon /> },
  { key: "quotes", url: "/quotes", icon: <ReceiptTextIcon /> },
  { key: "invoices", url: "/invoices", icon: <FileTextIcon /> },
  { key: "notes", url: "/notes", icon: <NotebookPenIcon /> },
  { key: "companyProfile", url: "/profile", icon: <Building2Icon /> },
] as const

const sidebarMessages = {
  en: {
    tagline: "Business context, always ready",
    workspace: "Workspace",
    preferences: "Preferences",
    language: "Language",
    session: "Session",
    logout: "Logout",
    userFallback: "User",
    noEmail: "No email",
    nav: {
      dashboard: "Dashboard",
      clients: "Clients",
      suppliers: "Suppliers",
      catalogue: "Products & Services",
      quotes: "Quotes",
      notes: "Notes",
      invoices: "Invoices",
      companyProfile: "Company profile",
    },
  },
  fr: {
    tagline: "Contexte metier, toujours pret",
    workspace: "Espace de travail",
    preferences: "Preferences",
    language: "Langue",
    session: "Session",
    logout: "Deconnexion",
    userFallback: "Utilisateur",
    noEmail: "Aucun e-mail",
    nav: {
      dashboard: "Tableau de bord",
      clients: "Clients",
      suppliers: "Fournisseurs",
      catalogue: "Produits & Services",
      quotes: "Devis",
      notes: "Notes",
      invoices: "Factures",
      companyProfile: "Profil d'entreprise",
    },
  },
} as const

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { user } = useAuthMe()
  const { locale } = useLocale()
  const t = sidebarMessages[locale]
  const signedCount = useSignedQuotesCount()

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
                    {item.key === "quotes" && signedCount > 0 ? (
                      <span className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--color-text-success)', color: '#fff' }}>
                        {signedCount > 99 ? '99+' : signedCount}
                      </span>
                    ) : null}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
       
        <SidebarGroup className="mt-auto pt-0">
          <SidebarGroupLabel>{t.session}</SidebarGroupLabel>
          <SidebarMenu className="px-2 pb-2">
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="h-10 mt-2 bg-transparent text-(--color-text-danger) hover:bg-transparent hover:text-(--color-text-danger)">
                <Link href="/logout">
                  <LogOutIcon />
                  <span>{t.logout}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user?.name ?? t.userFallback,
            email: user?.email ?? t.noEmail,
            avatar: "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
