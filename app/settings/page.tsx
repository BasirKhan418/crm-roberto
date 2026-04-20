'use client';

import Link from 'next/link';
import { BellIcon, CreditCardIcon } from 'lucide-react';

import { useLocale } from '@/components/providers/locale-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const settingsHomeMessages = {
  en: {
    title: 'Settings Home',
    description: 'Choose a settings area to configure your workflow.',
    remindersTitle: 'Reminders',
    remindersDescription: 'Edit timing, templates, late fees, and legal notice options.',
    remindersCta: 'Open reminders settings',
    stripeTitle: 'Stripe',
    stripeDescription: 'Connect your Stripe account and manage payment onboarding status.',
    stripeCta: 'Open Stripe settings',
  },
  fr: {
    title: 'Accueil des paramètres',
    description: 'Choisissez une section de paramètres à configurer.',
    remindersTitle: 'Relances',
    remindersDescription: 'Modifiez les délais, modèles, pénalités et options de mise en demeure.',
    remindersCta: 'Ouvrir les paramètres de relance',
    stripeTitle: 'Stripe',
    stripeDescription: 'Connectez votre compte Stripe et gérez le statut de configuration des paiements.',
    stripeCta: 'Ouvrir les paramètres Stripe',
  },
} as const;

export default function SettingsHomePage() {
  const { locale } = useLocale();
  const t = settingsHomeMessages[locale];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold tracking-tight">{t.title}</h2>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link href="/settings/reminders" className="block">
          <Card className="h-full transition-colors hover:border-primary/40 hover:bg-primary/5">
            <CardHeader className="space-y-2">
              <div className="inline-flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <BellIcon className="size-4" />
              </div>
              <CardTitle>{t.remindersTitle}</CardTitle>
              <CardDescription>{t.remindersDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium text-primary">{t.remindersCta}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/stripe" className="block">
          <Card className="h-full transition-colors hover:border-primary/40 hover:bg-primary/5">
            <CardHeader className="space-y-2">
              <div className="inline-flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <CreditCardIcon className="size-4" />
              </div>
              <CardTitle>{t.stripeTitle}</CardTitle>
              <CardDescription>{t.stripeDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium text-primary">{t.stripeCta}</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
