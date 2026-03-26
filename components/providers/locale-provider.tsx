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
  const [locale, setLocaleState] = React.useState<Locale>("en")

  React.useEffect(() => {
    const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (savedLocale === "en" || savedLocale === "fr") {
      setLocaleState(savedLocale)
      document.documentElement.lang = savedLocale
      return
    }

    const browserLocale = navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en"
    setLocaleState(browserLocale)
    document.documentElement.lang = browserLocale
  }, [])

  const setLocale = React.useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale)
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale)
    document.documentElement.lang = nextLocale
  }, [])

  const toggleLocale = React.useCallback(() => {
    setLocaleState((prev) => {
      const next = prev === "en" ? "fr" : "en"
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next)
      document.documentElement.lang = next
      return next
    })
  }, [])

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
