'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocale } from '@/components/providers/locale-provider';

const loginMessages = {
  en: {
    heading: 'Admin Login',
    subtitle: 'Sign in to the administration panel.',
    email: 'Email',
    password: 'Password',
    login: 'Sign in',
    loggingIn: 'Signing in…',
    failed: 'Invalid email or password.',
  },
  fr: {
    heading: 'Connexion Admin',
    subtitle: 'Connectez-vous au panneau d\'administration.',
    email: 'E-mail',
    password: 'Mot de passe',
    login: 'Se connecter',
    loggingIn: 'Connexion…',
    failed: 'Email ou mot de passe invalide.',
  },
} as const;

export default function AdminLoginPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = loginMessages[locale];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string };
      if (res.ok && data.success) {
        router.push('/admin');
      } else {
        toast.error(data.message || t.failed);
      }
    } catch {
      toast.error(t.failed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border/60 shadow-lg">
        <CardHeader className="items-center space-y-2 pb-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <ShieldCheck className="size-6" strokeWidth={1.75} />
          </div>
          <CardTitle className="text-xl font-bold">{t.heading}</CardTitle>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-email">{t.email}</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-password">{t.password}</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t.loggingIn}
                </>
              ) : (
                t.login
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
