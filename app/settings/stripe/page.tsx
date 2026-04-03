'use client';

import { useLocale } from '@/components/providers/locale-provider';

export default function StripeSettingsPage() {
  const { locale } = useLocale();
  const t = {
    en: {
      title: 'Stripe Connect',
      description: 'Phase 3 Stripe onboarding page shell.',
    },
    fr: {
      title: 'Stripe Connect',
      description: 'Coque de la page d onboarding Stripe pour la phase 3.',
    },
  }[locale];

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
    </main>
  );
}
