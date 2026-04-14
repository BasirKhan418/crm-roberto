"use client"

import { Languages } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { translate } from "@/lib/i18n/messages"

type LanguageThemeToggleProps = {
  className?: string
}

export function LanguageThemeToggle({ className }: LanguageThemeToggleProps) {
  const { locale, toggleLocale } = useLocale()

  return (
    <div className={className}>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={toggleLocale}
        className="h-8 gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 hover:bg-zinc-100"
        aria-label={translate(locale, 'common.toggleLanguage')}
      >
        <Languages className="h-3.5 w-3.5" />
        <span>{locale === "fr" ? "EN" : "FR"}</span>
      </Button>
    </div>
  )
}
