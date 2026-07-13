"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";

import { ForgotPasswordFlow } from "@/components/auth/forgot-password-flow";
import { LanguageThemeToggle } from "@/components/language-theme-toggle";
import { useLocale } from "@/components/providers/locale-provider";
import { WorldMapBg } from "@/components/ui/WorldMapBg";

const pageCopy = {
  en: {
    sideHeadingLine1: "The Editorial",
    sideHeadingLine2: "Standard of",
    sideHeadingHighlight: "Management.",
    sideDescription: "A professional CRM for teams managing clients, suppliers, and business operations — all in one place.",
    sideTrust: "Trusted by thousands of editorial teams.",
    privacy: "Privacy",
    terms: "Terms",
  },
  fr: {
    sideHeadingLine1: "La Reference",
    sideHeadingLine2: "Editoriale de la",
    sideHeadingHighlight: "Gestion.",
    sideDescription: "Un CRM professionnel pour les equipes gerant clients, fournisseurs et operations commerciales — au meme endroit.",
    sideTrust: "Approuve par des milliers d'equipes editoriales.",
    privacy: "Confidentialite",
    terms: "Conditions",
  },
} as const;

function ForgotPasswordPageContent() {
  return (
    <ForgotPasswordFlow
      forgotApiPath="/api/accountant/auth/forgot"
      resetApiPath="/api/accountant/auth/reset"
      loginHref="/accountant-portal/login"
    />
  );
}

export default function AccountantPortalForgotPasswordPage() {
  const { locale } = useLocale();
  const t = pageCopy[locale];

  return (
    <div className="flex w-full flex-col bg-[#f8fafc]" style={{ minHeight: "var(--app-viewport-height)" }}>
      <header className="flex items-center justify-between border-b border-zinc-100 bg-white px-5 py-4 lg:hidden">
        <div className="flex items-center">
          <Image src="/logo.png" alt="Roby" width={92} height={32} style={{ height: "auto" }} className="mix-blend-multiply" />
        </div>
        <LanguageThemeToggle />
      </header>

      <div className="flex flex-1 items-stretch min-h-0 lg:overflow-hidden">
        <aside className="relative hidden w-90 shrink-0 flex-col overflow-hidden bg-[#020b18] text-white lg:flex xl:w-100">
          <WorldMapBg
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            strokeColor="white"
            strokeOpacity={0.45}
            gridOpacity={0.1}
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_60%_40%,transparent_30%,#020b18_80%)]" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 bg-linear-to-t from-[#020b18] to-transparent" />
          <div className="pointer-events-none absolute left-0 right-0 top-0 h-32 bg-linear-to-b from-[#020b18] to-transparent" />
          <div className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/5 blur-3xl" />

          <div className="relative z-10 flex h-full flex-col items-center p-8 xl:p-10">
            <div className="inline-flex w-37.5 items-center justify-center rounded-xl bg-white/95 shadow-sm">
              <Image src="/logo.png" alt="Roby" width={112} height={39} style={{ height: "auto" }} />
            </div>

            <div className="my-auto">
              <h1 className="font-heading text-[2.6rem] font-black leading-[1.05] tracking-tight xl:text-[3rem]">
                {t.sideHeadingLine1}
                <br />
                {t.sideHeadingLine2}
                <br />
                <span className="text-emerald-400">{t.sideHeadingHighlight}</span>
              </h1>

              <div className="mb-8 mt-8 h-px w-16 bg-white/15" />

              <p className="max-w-70 text-[13px] leading-[1.75] text-white/40">{t.sideDescription}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/8">
                <BadgeCheck className="h-4 w-4 text-white/70" />
              </div>
              <p className="text-[12px] font-medium leading-snug text-white/35">{t.sideTrust}</p>
            </div>
          </div>
        </aside>

        <main className="relative flex min-h-0 flex-1 flex-col bg-white lg:bg-[#f8fafc]">
          <div className="absolute right-6 top-5 z-20 hidden lg:block">
            <LanguageThemeToggle />
          </div>

          <div className="flex-1 overflow-y-auto scroll-pb-[calc(5rem+var(--app-keyboard-inset-height))]">
            <div className="flex min-h-full flex-col justify-center px-5 py-10 pb-[calc(2.5rem+var(--app-keyboard-inset-height))] sm:px-8 md:px-10 lg:px-12 xl:px-16">
              <div className="mx-auto w-full max-w-sm">
                <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Chargement...</div>}>
                  <ForgotPasswordPageContent />
                </Suspense>
              </div>
            </div>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 bg-white px-5 py-5 pb-[calc(1.25rem+var(--app-safe-area-bottom))] text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400 sm:px-8 md:px-10 lg:px-12 xl:px-16">
            <span>© 2026 Roby</span>
            <div className="flex gap-5">
              <Link href="#" className="transition-colors hover:text-zinc-600">
                {t.privacy}
              </Link>
              <Link href="#" className="transition-colors hover:text-zinc-600">
                {t.terms}
              </Link>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}