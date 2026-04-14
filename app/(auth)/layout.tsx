"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, BadgeCheck } from "lucide-react";
import { LanguageThemeToggle } from "@/components/language-theme-toggle";
import { useLocale } from "@/components/providers/locale-provider";
import { WorldMapBg } from "@/components/ui/WorldMapBg";

const authLayoutMessages = {
  en: {
    headingLine1: "The Editorial",
    headingLine2: "Standard of",
    headingHighlight: "Management.",
    desc: "A professional CRM for teams managing clients, suppliers, and business operations — all in one place.",
    trust: "Trusted by thousands of editorial teams.",
    privacy: "Privacy",
    terms: "Terms",
  },
  fr: {
    headingLine1: "La Reference",
    headingLine2: "Editoriale de la",
    headingHighlight: "Gestion.",
    desc: "Un CRM professionnel pour les equipes gerant clients, fournisseurs et operations commerciales — au meme endroit.",
    trust: "Approuve par des milliers d'equipes editoriales.",
    privacy: "Confidentialite",
    terms: "Conditions",
  },
} as const;

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const t = authLayoutMessages[locale];

  return (
    <div className="flex w-full flex-col bg-[#f8fafc]" style={{ minHeight: 'var(--app-viewport-height)' }}>
      {/* Mobile top bar */}
      <header className="lg:hidden flex items-center justify-between px-5 py-4 bg-white border-b border-zinc-100">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-[#020b18] border border-[#020b18] p-1.5">
            <LayoutDashboard className="h-4 w-4 text-white" />
          </div>
          <p className="text-sm font-bold text-[#020b18] tracking-tight">CRM Roberto</p>
        </div>
        <LanguageThemeToggle />
      </header>

      <div className="flex flex-1 items-stretch min-h-0 lg:overflow-hidden">
        {/* Left panel */}
        <aside className="hidden lg:flex w-[420px] xl:w-[480px] shrink-0 flex-col bg-[#020b18] text-white relative overflow-hidden">
          {/* World map background */}
          <WorldMapBg
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            strokeColor="white"
            strokeOpacity={0.45}
            gridOpacity={0.1}
          />

          {/* Vignette overlays */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_40%,transparent_30%,#020b18_80%)] pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#020b18] to-transparent pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#020b18] to-transparent pointer-events-none" />

          {/* Subtle emerald glow */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col h-full p-12 xl:p-14">
            {/* Brand mark */}
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 backdrop-blur-sm">
                <LayoutDashboard className="h-4 w-4 text-white" />
              </div>
              <p className="text-[13px] font-bold tracking-widest text-white/90 uppercase">CRM Roberto</p>
            </div>

            {/* Centred content */}
            <div className="my-auto">
              <h1 className="font-heading text-[2.6rem] xl:text-[3rem] font-black leading-[1.05] tracking-tight">
                {t.headingLine1}
                <br />
                {t.headingLine2}
                <br />
                <span className="text-emerald-400">{t.headingHighlight}</span>
              </h1>

              <div className="mt-8 mb-8 w-16 h-px bg-white/15" />

              <p className="text-[13px] text-white/40 leading-[1.75] max-w-[280px]">
                {t.desc}
              </p>
            </div>

            {/* Trust badge */}
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/8">
                <BadgeCheck className="h-4 w-4 text-white/70" />
              </div>
              <p className="text-[12px] text-white/35 font-medium leading-snug">{t.trust}</p>
            </div>
          </div>
        </aside>

        {/* Right — form area */}
        <main className="relative flex min-h-0 flex-1 flex-col bg-white lg:bg-[#f8fafc]">
          <div className="hidden lg:block absolute top-5 right-6 z-20">
            <LanguageThemeToggle />
          </div>

          <div className="flex-1 overflow-y-auto scroll-pb-[calc(5rem+var(--app-keyboard-inset-height))]">
            <div className="min-h-full flex flex-col justify-center px-5 py-10 pb-[calc(2.5rem+var(--app-keyboard-inset-height))] sm:px-10 md:px-16 lg:px-20 xl:px-24">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.38, ease: [0.19, 1, 0.22, 1] }}
                  className="w-full max-w-sm mx-auto"
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 bg-white px-5 py-5 pb-[calc(1.25rem+var(--app-safe-area-bottom))] text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400 sm:px-10 md:px-16 lg:px-20 xl:px-24">
            <span>© 2026 CRM Roberto</span>
            <div className="flex gap-5">
              <Link href="#" className="hover:text-zinc-600 transition-colors">{t.privacy}</Link>
              <Link href="#" className="hover:text-zinc-600 transition-colors">{t.terms}</Link>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}