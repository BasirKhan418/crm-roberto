"use client"

import * as React from "react"

import { KeyboardViewportManager } from "@/components/providers/keyboard-viewport-manager"
import { LocaleProvider } from "@/components/providers/locale-provider"
import { SuspensionSseListener } from "@/components/providers/suspension-sse-listener"
import { ThemeProvider } from "@/components/providers/theme-provider"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      disableTransitionOnChange
      enableColorScheme={false}
    >
      <LocaleProvider>
        <KeyboardViewportManager />
        <SuspensionSseListener />
        {children}
      </LocaleProvider>
    </ThemeProvider>
  )
}
