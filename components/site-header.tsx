"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo } from "react"

import { ArrowLeftIcon, CircleUserRoundIcon, KeyRoundIcon, LayoutDashboardIcon, LogOutIcon } from "lucide-react"

import { LanguageThemeToggle } from "@/components/language-theme-toggle"
import { NotificationsBell } from "@/components/notifications-bell"
import { useLocale } from "@/components/providers/locale-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useAuthMe } from "@/hooks/useAuthMe"

const NAVIGATION_STACK_KEY = "crm-navigation-stack"
const MAX_STACK_LENGTH = 24

const headerMessages = {
  en: {
    back: "Back",
    backLabel: "Go to the previous page",
    dashboard: "Back to Dashboard",
    dashboardLabel: "Go to dashboard",
    account: "My Account",
    changePassword: "Change Password",
    logout: "Logout",
    userFallback: "User",
  },
  fr: {
    back: "Retour",
    backLabel: "Revenir à la page précédente",
    dashboard: "Retour au tableau de bord",
    dashboardLabel: "Aller au tableau de bord",
    account: "Mon compte",
    changePassword: "Changer le mot de passe",
    logout: "Déconnexion",
    userFallback: "Utilisateur",
  },
} as const

function readNavigationStack(): string[] {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const storedStack = window.sessionStorage.getItem(NAVIGATION_STACK_KEY)
    if (!storedStack) {
      return []
    }

    const parsedStack = JSON.parse(storedStack)
    if (!Array.isArray(parsedStack)) {
      return []
    }

    return parsedStack
      .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      .slice(-MAX_STACK_LENGTH)
  } catch {
    return []
  }
}

function writeNavigationStack(stack: string[]) {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.setItem(NAVIGATION_STACK_KEY, JSON.stringify(stack.slice(-MAX_STACK_LENGTH)))
}

function getBackFallbackHref(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length <= 1) {
    return "/dashboard"
  }

  return `/${segments[0]}`
}

export function SiteHeader({ title = "Documents" }: { title?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuthMe()
  const { locale } = useLocale()
  const t = headerMessages[locale]
  const isDashboard = pathname === "/dashboard"
  const currentRoute = useMemo(() => {
    if (typeof window === "undefined") {
      return pathname
    }

    const query = window.location.search
    return query ? `${pathname}${query}` : pathname
  }, [pathname])

  const backFallbackHref = useMemo(() => getBackFallbackHref(pathname), [pathname])
  const userDisplayName = user?.name?.trim() || t.userFallback
  const userInitials = userDisplayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U"

  useEffect(() => {
    const stack = readNavigationStack()
    let nextStack = stack

    if (stack.length === 0) {
      nextStack = [currentRoute]
    } else if (stack[stack.length - 1] === currentRoute) {
      nextStack = stack
    } else if (stack[stack.length - 2] === currentRoute) {
      nextStack = stack.slice(0, -1)
    } else {
      nextStack = [...stack, currentRoute]
    }

    writeNavigationStack(nextStack)
  }, [currentRoute])

  function handleBack() {
    const stack = readNavigationStack()

    if (stack.length > 1) {
      const previousRoute = stack[stack.length - 2]
      writeNavigationStack(stack.slice(0, -1))
      router.push(previousRoute ?? backFallbackHref)
      return
    }

    router.push(backFallbackHref)
  }

  return (
    <header className="shrink-0 border-b bg-background/95 transition-[width,height] ease-linear supports-backdrop-filter:bg-background/80">
      <div className="flex min-h-(--header-height) w-full flex-wrap items-center gap-2 px-4 py-3 lg:gap-3 lg:px-6">
        <div className="order-1 flex min-w-0 flex-1 items-center gap-2">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator
            orientation="vertical"
            className="mx-1 hidden data-[orientation=vertical]:h-4 lg:block"
          />
          <h1 className="min-w-0 truncate text-base font-medium">{title}</h1>
        </div>

        {!isDashboard ? (
          <div className="order-3 flex basis-full items-center gap-2 overflow-x-auto pb-0.5 lg:order-2 lg:basis-auto lg:pb-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBack}
              aria-label={t.backLabel}
              className="h-9 shrink-0 rounded-full px-3"
            >
              <ArrowLeftIcon />
              <span>{t.back}</span>
            </Button>

            <Button asChild variant="secondary" size="sm" className="h-9 shrink-0 rounded-full px-3">
              <Link href="/dashboard" aria-label={t.dashboardLabel}>
                <LayoutDashboardIcon />
                <span>{t.dashboard}</span>
              </Link>
            </Button>
          </div>
        ) : null}

        <div className="order-2 flex shrink-0 items-center gap-2 lg:order-3 lg:ml-auto">
          <NotificationsBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="h-9 max-w-56 gap-2 rounded-full px-2.5">
                <Avatar className="size-7 rounded-full">
                  <AvatarImage src="" alt={userDisplayName} />
                  <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-medium">{userDisplayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/profile#company-profile">
                    <CircleUserRoundIcon className="size-4" />
                    {t.account}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile#password-security">
                    <KeyRoundIcon className="size-4" />
                    {t.changePassword}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild variant="destructive">
                <Link href="/logout">
                  <LogOutIcon className="size-4" />
                  {t.logout}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <LanguageThemeToggle className="shrink-0" />
        </div>
      </div>
    </header>
  )
}
