'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calculator, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const loginCopy = {
  en: {
    heading: 'Accountant portal',
    subtitle: 'Sign in with your invitation-backed accountant account.',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    loading: 'Signing in...',
    help: 'Use the invitation email sent from Settings > Users. Main CRM credentials do not work here unless the user role is accountant.',
    crmLoginPrompt: 'Not an accountant?',
    crmLoginCta: 'Back to CRM login',
    failed: 'Unable to sign in to the accountant portal.',
  },
  fr: {
    heading: 'Portail comptable',
    subtitle: 'Connectez-vous avec votre compte comptable invite.',
    email: 'E-mail',
    password: 'Mot de passe',
    submit: 'Se connecter',
    loading: 'Connexion...',
    help: 'Utilisez l invitation envoyee depuis Parametres > Utilisateurs. Les identifiants CRM standard ne fonctionnent ici que pour le role comptable.',
    crmLoginPrompt: 'Pas comptable ?',
    crmLoginCta: 'Retour connexion CRM',
    failed: 'Impossible de se connecter au portail comptable.',
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
        toast.error(payload?.message || t.failed);
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
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md border-border/70 bg-white/90 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.45)] backdrop-blur">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 ring-1 ring-amber-200">
            <Calculator className="size-6" strokeWidth={1.8} />
          </div>
          <div className="space-y-1">
            <CardTitle>{t.heading}</CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="accountant-email">{t.email}</Label>
              <Input
                id="accountant-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accountant-password">{t.password}</Label>
              <div className="relative">
                <Input
                  id="accountant-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t.loading}
                </>
              ) : (
                t.submit
              )}
            </Button>
          </form>
          <p className="text-xs leading-5 text-muted-foreground">{t.help}</p>
          <p className="text-center text-sm text-muted-foreground">
            {t.crmLoginPrompt}{' '}
            <Link href="/login" className="font-semibold text-foreground underline-offset-4 hover:underline">
              {t.crmLoginCta}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}