"use client"

import { Languages } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { translate } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"

type LanguageThemeToggleProps = {
  className?: string
  compactOnMobile?: boolean
}

export function LanguageThemeToggle({ className, compactOnMobile = false }: LanguageThemeToggleProps) {
  const { locale, toggleLocale } = useLocale()
  const nextLocale = locale === "fr" ? "EN" : "FR"

  return (
    <div className={className}>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={toggleLocale}
        className={cn(
          "text-[11px] font-semibold uppercase tracking-wide text-zinc-600 hover:bg-zinc-100",
          compactOnMobile
            ? "h-10 min-w-10 rounded-full border border-slate-200/80 bg-white/85 px-0 text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-200 dark:hover:bg-slate-900 sm:h-11 sm:min-w-11 sm:gap-1.5 sm:px-3"
            : "h-8 gap-1.5 px-3"
        )}
        aria-label={translate(locale, 'common.toggleLanguage')}
      >
        <Languages className={cn("h-3.5 w-3.5", compactOnMobile ? "hidden sm:block" : "")} />
        <span>{nextLocale}</span>
      </Button>
    </div>
  )
}
