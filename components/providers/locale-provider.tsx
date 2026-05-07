"use client"

import * as React from "react"

const LOCALE_STORAGE_KEY = "crm-locale"

export type Locale = "en" | "fr"

type LocaleContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  toggleLocale: () => void
}

const LocaleContext = React.createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>("fr")

  const applyLocale = React.useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale)
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale)
    document.documentElement.lang = nextLocale
  }, [])

  const persistLocale = React.useCallback(async (nextLocale: Locale) => {
    try {
      await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: nextLocale }),
      })
    } catch {
      // Ignore persistence failures and keep the local UI responsive.
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false

    const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (savedLocale === "en" || savedLocale === "fr") {
      applyLocale(savedLocale)
    } else {
      applyLocale("fr")
    }

    async function loadPersistedLocale() {
      try {
        const response = await fetch('/api/me?fch=1', { cache: 'no-store' })
        if (!response.ok) {
          return
        }

        const payload = await response.json() as { user?: { locale?: string | null } }
        const serverLocale = payload.user?.locale
        if (!cancelled && (serverLocale === 'en' || serverLocale === 'fr')) {
          applyLocale(serverLocale)
        }
      } catch {
        // Ignore and keep the last known local locale.
      }
    }

    void loadPersistedLocale()

    return () => {
      cancelled = true
    }
  }, [applyLocale])

  const setLocale = React.useCallback((nextLocale: Locale) => {
    applyLocale(nextLocale)
    void persistLocale(nextLocale)
  }, [applyLocale, persistLocale])

  const toggleLocale = React.useCallback(() => {
    setLocaleState((prev) => {
      const next = prev === "en" ? "fr" : "en"
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next)
      document.documentElement.lang = next
      void persistLocale(next)
      return next
    })
  }, [persistLocale])

  const value = React.useMemo(
    () => ({
      locale,
      setLocale,
      toggleLocale,
    }),
    [locale, setLocale, toggleLocale]
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const context = React.useContext(LocaleContext)
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider")
  }

  return context
}
