'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BadgeCheck, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { LanguageThemeToggle } from '@/components/language-theme-toggle';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WorldMapBg } from '@/components/ui/WorldMapBg';
import { createI18nKey as i18nKey, resolveTranslatedText } from '@/lib/i18n/messages';

const loginCopy = {
  en: {
    sideHeadingLine1: 'The Editorial',
    sideHeadingLine2: 'Standard of',
    sideHeadingHighlight: 'Management.',
    sideDescription: 'A professional CRM for teams managing clients, suppliers, and business operations — all in one place.',
    sideTrust: 'Trusted by thousands of editorial teams.',
    privacy: 'Privacy',
    terms: 'Terms',
    heading: 'Accountant portal',
    subtitle: 'Sign in with your invitation-backed accountant account.',
    email: 'Email Address',
    password: 'Password',
    submit: 'Sign in',
    loading: 'Signing in...',
    help: 'Use the invitation email sent from Settings > Users. Main CRM credentials do not work here unless the user role is accountant.',
    crmLoginPrompt: 'Not an accountant?',
    crmLoginCta: 'Back to CRM login',
    missingCredentials: 'Enter your email address and password.',
    failed: 'Unable to sign in. Check your email, password, and that your accountant invitation is still active.',
  },
  fr: {
    sideHeadingLine1: 'La Reference',
    sideHeadingLine2: 'Editoriale de la',
    sideHeadingHighlight: 'Gestion.',
    sideDescription: 'Un CRM professionnel pour les equipes gerant clients, fournisseurs et operations commerciales — au meme endroit.',
    sideTrust: "Approuve par des milliers d'equipes editoriales.",
    privacy: 'Confidentialite',
    terms: 'Conditions',
    heading: 'Portail comptable',
    subtitle: 'Connectez-vous avec votre compte comptable invite.',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    submit: 'Se connecter',
    loading: 'Connexion...',
    help: 'Utilisez l invitation envoyee depuis Parametres > Utilisateurs. Les identifiants CRM standard ne fonctionnent ici que pour le role comptable.',
    crmLoginPrompt: 'Pas comptable ?',
    crmLoginCta: 'Retour connexion CRM',
    missingCredentials: 'Saisissez votre adresse e-mail et votre mot de passe.',
    failed: 'Connexion impossible. Verifiez votre e-mail, votre mot de passe et que votre invitation comptable est toujours active.',
  },
} as const;

export default function AccountantPortalLoginPage() {
  const { locale } = useLocale();
  const router = useRouter();
  const t = loginCopy[locale];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error(t.missingCredentials);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/accountant/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string; data?: { redirectTo?: string } } | null;

      if (!response.ok || !payload?.success) {
        const errorMessage =
          payload?.message === i18nKey('auth.loginError')
            ? t.failed
            : resolveTranslatedText(locale, payload?.message, t.failed);
        toast.error(errorMessage);
        return;
      }

      router.push(payload.data?.redirectTo || '/accountant-portal');
      router.refresh();
    } catch {
      toast.error(t.failed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col bg-[#f8fafc]" style={{ minHeight: 'var(--app-viewport-height)' }}>
      <header className="flex items-center justify-between border-b border-zinc-100 bg-white px-5 py-4 lg:hidden">
        <div className="flex items-center">
          <Image src="/logo.png" alt="Roby" width={92} height={32} style={{ height: 'auto' }} className="mix-blend-multiply" />
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
              <Image src="/logo.png" alt="Roby" width={112} height={39} style={{ height: 'auto' }} />
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
              <div className="mx-auto w-full max-w-sm space-y-8">
                <div className="space-y-1.5">
                  <h1 className="font-heading text-3xl font-semibold tracking-tight text-zinc-900">{t.heading}</h1>
                  <p className="text-sm text-muted-foreground">{t.subtitle}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="accountant-email" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      {t.email}
                    </Label>
                    <Input
                      id="accountant-email"
                      type="email"
                      placeholder="name@company.com"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={loading}
                      required
                      className="h-11 rounded-lg border-zinc-200 bg-zinc-50 text-zinc-900 transition-all placeholder:text-zinc-300 focus-visible:border-[#001e3c] focus-visible:ring-2 focus-visible:ring-[#001e3c]/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="accountant-password" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      {t.password}
                    </Label>
                    <div className="relative">
                      <Input
                        id="accountant-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        disabled={loading}
                        required
                        className="h-11 rounded-lg border-zinc-200 bg-zinc-50 pr-10 text-zinc-900 transition-all placeholder:text-zinc-300 focus-visible:border-[#001e3c] focus-visible:ring-2 focus-visible:ring-[#001e3c]/20"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-600"
                        onClick={() => setShowPassword((current) => !current)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="mt-2 h-11 w-full rounded-lg bg-[#001e3c] text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#002b54] active:scale-[0.98]"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.loading}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        {t.submit}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                </form>

                <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs leading-5 text-zinc-500 shadow-sm">
                  {t.help}
                </div>

                <p className="text-center text-sm text-zinc-500">
                  {t.crmLoginPrompt}{' '}
                  <Link href="/login" className="font-semibold text-[#001e3c] underline-offset-4 hover:underline">
                    {t.crmLoginCta}
                  </Link>
                </p>
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