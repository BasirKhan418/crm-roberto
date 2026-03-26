"use client"

import { Languages, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"

type LanguageThemeToggleProps = {
  className?: string
}

export function LanguageThemeToggle({ className }: LanguageThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const { locale, toggleLocale } = useLocale()

  const isDark = theme === "dark"

  return (
    <div className={className}>
      <div className="flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/95 p-1 shadow-lg backdrop-blur dark:border-zinc-700/80 dark:bg-zinc-900/95">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="h-8 rounded-full px-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={toggleLocale}
          className="h-8 rounded-full px-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          aria-label="Toggle language"
        >
          <Languages className="h-3.5 w-3.5" />
          <span>{locale === "en" ? "FR" : "EN"}</span>
        </Button>
      </div>
    </div>
  )
}
