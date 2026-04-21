'use client';

import Link from 'next/link';
import { ArrowRightIcon, BellIcon, CreditCardIcon, MailIcon, Repeat2Icon } from 'lucide-react';

import { useLocale } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const settingsHomeMessages = {
  en: {
    title: 'Workspace Settings',
    description: 'Use clearly separated sections to manage payments, reminders, recurrence, and email content.',
    sectionLabel: 'Configuration areas',
    remindersTitle: 'Reminders',
    remindersDescription: 'Set the reminder schedule, language, late fees, and legal notice rules.',
    remindersPoints: ['Reminder cadence', 'Late fee rules', 'Legal notice timing'],
    remindersCta: 'Open reminder settings',
    paymentsTitle: 'Payments',
    paymentsDescription: 'Connect Stripe and verify whether charges and payouts are ready.',
    paymentsPoints: ['Stripe connection', 'Verification status', 'Payout readiness'],
    paymentsCta: 'Open payments settings',
    templatesTitle: 'Email Templates',
    templatesDescription: 'Edit reminder email subjects and bodies in both English and French.',
    templatesPoints: ['Soft to formal notice', 'Live preview', 'Reusable variables'],
    templatesCta: 'Edit email templates',
    recurrenceTitle: 'Recurrence',
    recurrenceDescription: 'Recurring invoices are configured directly on each invoice so scheduling stays close to the billing flow.',
    recurrencePoints: ['Per-invoice setup', 'Generation schedule', 'Auto-send options'],
    recurrenceCta: 'Open invoices',
    remindersBadge: 'Workflow',
    paymentsBadge: 'Billing',
    templatesBadge: 'Content',
    recurrenceBadge: 'Per invoice',
  },
  fr: {
    title: 'Paramètres de l\'espace',
    description: 'Utilisez des sections bien séparées pour gérer les paiements, les relances, la récurrence et le contenu e-mail.',
    sectionLabel: 'Zones de configuration',
    remindersTitle: 'Relances',
    remindersDescription: 'Réglez le rythme des relances, la langue, les pénalités et la mise en demeure.',
    remindersPoints: ['Calendrier des relances', 'Règles de pénalité', 'Délai de mise en demeure'],
    remindersCta: 'Ouvrir les réglages de relance',
    paymentsTitle: 'Paiements',
    paymentsDescription: 'Connectez Stripe et vérifiez si les encaissements et virements sont prêts.',
    paymentsPoints: ['Connexion Stripe', 'Statut de vérification', 'Disponibilité des virements'],
    paymentsCta: 'Ouvrir les réglages paiements',
    templatesTitle: 'Modèles d\'e-mail',
    templatesDescription: 'Modifiez les sujets et contenus des e-mails de relance en anglais et en français.',
    templatesPoints: ['Relance simple à mise en demeure', 'Aperçu en direct', 'Variables réutilisables'],
    templatesCta: 'Modifier les modèles e-mail',
    recurrenceTitle: 'Récurrence',
    recurrenceDescription: 'Les factures récurrentes se configurent directement sur chaque facture pour garder la planification liée au cycle de facturation.',
    recurrencePoints: ['Configuration par facture', 'Calendrier de génération', 'Options d\'envoi automatique'],
    recurrenceCta: 'Ouvrir les factures',
    remindersBadge: 'Flux',
    paymentsBadge: 'Encaissement',
    templatesBadge: 'Contenu',
    recurrenceBadge: 'Par facture',
  },
} as const;

type SettingsAreaCardProps = {
  badge: string;
  title: string;
  description: string;
  points: string[];
  cta: string;
  href: string;
  icon: React.ReactNode;
};

function SettingsAreaCard({ badge, title, description, points, cta, href, icon }: SettingsAreaCardProps) {
  return (
    <Card className="h-full border-border/70 bg-background/90 shadow-sm">
      <CardHeader className="space-y-3 p-5 pb-3 sm:space-y-4 sm:pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            {icon}
          </div>
          <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {badge}
          </Badge>
        </div>
        <div className="space-y-2">
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription className="text-sm leading-6">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex h-full flex-col justify-between gap-4 p-5 pt-0">
        <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-3 sm:p-4">
          {points.map((point) => (
            <p key={`${title}-${point}`} className="text-sm text-muted-foreground">
              {point}
            </p>
          ))}
        </div>

        <Button asChild variant="ghost" className="h-11 justify-between rounded-xl border border-border/70 px-4">
          <Link href={href}>
            <span>{cta}</span>
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function SettingsHomePage() {
  const { locale } = useLocale();
  const t = settingsHomeMessages[locale];

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="rounded-3xl border border-border/70 bg-linear-to-br from-background via-background to-muted/30 p-5 shadow-sm sm:p-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t.sectionLabel}</p>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">{t.title}</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{t.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
        <SettingsAreaCard
          badge={t.paymentsBadge}
          title={t.paymentsTitle}
          description={t.paymentsDescription}
          points={t.paymentsPoints}
          cta={t.paymentsCta}
          href="/settings/stripe"
          icon={<CreditCardIcon className="size-5" />}
        />

        <SettingsAreaCard
          badge={t.remindersBadge}
          title={t.remindersTitle}
          description={t.remindersDescription}
          points={t.remindersPoints}
          cta={t.remindersCta}
          href="/settings/reminders?section=timing"
          icon={<BellIcon className="size-5" />}
        />

        <SettingsAreaCard
          badge={t.templatesBadge}
          title={t.templatesTitle}
          description={t.templatesDescription}
          points={t.templatesPoints}
          cta={t.templatesCta}
          href="/settings/reminders?section=templates"
          icon={<MailIcon className="size-5" />}
        />

        <SettingsAreaCard
          badge={t.recurrenceBadge}
          title={t.recurrenceTitle}
          description={t.recurrenceDescription}
          points={t.recurrencePoints}
          cta={t.recurrenceCta}
          href="/invoices"
          icon={<Repeat2Icon className="size-5" />}
        />
      </div>
    </div>
  );
}
