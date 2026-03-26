"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LanguageThemeToggle } from "@/components/language-theme-toggle";
import { useLocale } from "@/components/providers/locale-provider";

const authLayoutMessages = {
  en: {
    headingLine1: "The Editorial",
    headingHighlight: "Standard",
    headingLine2: "of",
    headingLine3: "Management.",
    quote: '"Precision is the foundation of professional excellence."',
    quoteSource: "Editorial Management Protocol",
    executives: "500+ Active Executives",
    privacy: "Privacy",
    terms: "Terms",
  },
  fr: {
    headingLine1: "La Reference",
    headingHighlight: "Editoriale",
    headingLine2: "de la",
    headingLine3: "Gestion.",
    quote: '"La precision est le fondement de l\'excellence professionnelle."',
    quoteSource: "Protocole de Gestion Editoriale",
    executives: "500+ Cadres Actifs",
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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8FAFC] p-4 md:p-8">
      {/* Centered card-style container like the screenshot */}
      <div className="w-full max-w-[1000px] min-h-[640px] grid lg:grid-cols-2 bg-white rounded-[32px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,30,60,0.12)] border border-zinc-100/50">
        
        {/* Left Creative Block */}
        <div className="hidden lg:block relative bg-[#001e3c] p-12 text-white overflow-hidden">
          {/* Abstract background depth */}
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[40%] bg-blue-400/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-5%] left-[-5%] w-[40%] h-[30%] bg-indigo-500/10 blur-[100px] rounded-full" />
          
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 relative rounded-xl overflow-hidden shadow-2xl">
                <Image 
                  src="/logo-v2.webp" 
                  alt="Executive CRM" 
                  fill 
                  className="object-cover"
                />
              </div>
              <span className="font-bold text-xs tracking-[0.2em] uppercase opacity-80">Executive CRM</span>
            </div>

            <div className="mt-20 space-y-6">
              <h1 className="font-poppins text-5xl font-bold leading-[1.1] tracking-tight">
                {t.headingLine1} <br />
                <span className="text-blue-400/90">{t.headingHighlight}</span> {t.headingLine2} <br />
                {t.headingLine3}
              </h1>
              <div className="relative w-full aspect-square max-w-[280px] mt-8 rounded-2xl overflow-hidden border border-white/10 shadow-2xl group">
                <Image 
                  src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800" 
                  alt="Modern Office" 
                  fill 
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#001e3c]/80 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="font-roboto text-[10px] font-medium text-white/60 italic leading-relaxed">
                    {t.quote}
                  </p>
                  <p className="text-[8px] uppercase tracking-widest text-white/40 mt-1">— {t.quoteSource}</p>
                </div>
              </div>
            </div>

            <div className="mt-auto flex items-center justify-between pt-10 border-t border-white/5">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-3">
                  {[
                    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100",
                    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100",
                    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=100"
                  ].map((src, i) => (
                    <div key={i} className="h-9 w-9 rounded-full border-2 border-[#001e3c] bg-zinc-800 overflow-hidden relative ring-1 ring-white/10">
                      <Image src={src} alt="User" fill className="object-cover" />
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-zinc-400 font-bold tracking-widest uppercase ml-1">
                  {t.executives}
                </span>
              </div>
              <div className="text-[9px] uppercase tracking-[0.3em] text-zinc-600 font-bold">
                Build 2026.1
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Area with Motion Transition */}
        <div className="relative flex flex-col justify-center bg-white p-8 text-zinc-900 lg:p-14 overflow-hidden">
          <div className="absolute right-8 top-8 z-20">
            <LanguageThemeToggle />
          </div>

          {/* Mobile Logo */}
          <div className="lg:hidden absolute top-8 left-8 flex items-center gap-2">
            <div className="h-8 w-8 relative rounded-lg overflow-hidden">
              <Image src="/logo-v2.webp" alt="Logo" fill className="object-cover" />
            </div>
            <span className="font-bold text-[10px] tracking-widest uppercase text-[#001e3c]">Executive CRM</span>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, scale: 0.98, filter: "blur(20px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 1.02, filter: "blur(20px)" }}
              transition={{ 
                duration: 0.5, 
                ease: [0.19, 1, 0.22, 1],
                opacity: { duration: 0.4 }
              }}
              className="w-full max-w-[340px] mx-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>

          {/* Footer Info Lines */}
          <div className="mt-14 flex items-center justify-between border-t border-zinc-100 pt-8 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            <span>© 2026 Executive CRM</span>
            <div className="flex gap-6">
              <Link href="#" className="hover:text-zinc-600 transition-colors">{t.privacy}</Link>
              <Link href="#" className="hover:text-zinc-600 transition-colors">{t.terms}</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

