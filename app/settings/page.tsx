'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import Link from 'next/link';
import {
  ArrowRightIcon,
  BellIcon,
  Building2Icon,
  CheckCircle2Icon,
  CreditCardIcon,
  FileStackIcon,
  GlobeIcon,
  Loader2Icon,
  MailIcon,
  Repeat2Icon,
  ShieldCheckIcon,
  SmartphoneIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import ReminderSettingsPage from '@/app/settings/reminders/page';
import StripeSettingsPage from '@/app/settings/stripe/page';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resolveTranslatedError, formatInvoiceDisplayNumber } from '@/lib/i18n/messages';

type SettingsCenterSection = 'payments' | 'reminders' | 'templates' | 'recurrence' | 'company';

type CompanySettingsForm = {
  companyName: string;
  ownerName: string;
  businessEmail: string;
  phone: string;
  vatNumber: string;
};

const EMPTY_COMPANY_FORM: CompanySettingsForm = {
  companyName: '',
  ownerName: '',
  businessEmail: '',
  phone: '',
  vatNumber: '',
};

const settingsCenterMessages = {
  en: {
    sections: {
      payments: {
        title: 'Payments',
        description: 'Connect Stripe to accept online payments.',
      },
      reminders: {
        title: 'Reminders',
        description: 'Set when follow-up emails are sent.',
      },
      templates: {
        title: 'Email Templates',
        description: 'Customize what reminder emails say.',
      },
      recurrence: {
        title: 'Recurrence',
        description: 'Automatically repeat invoices on a schedule.',
      },
      company: {
        title: 'Company & Invoice',
        description: 'Your business name, VAT, and contact details.',
      },
    },
    paymentsTitle: 'Accept online payments',
    paymentsDescription:
      'Connect your Stripe account so clients can pay invoices with a card. Once connected, Apple Pay and Google Pay are also available on supported devices.',
    walletTitle: 'Apple Pay & Google Pay',
    walletDescription: 'These payment methods are automatically offered to your clients when their device and browser support them — no extra setup needed.',
    walletBrowserNote: 'Availability depends on the client\'s device and browser.',
    paymentLinksTitle: 'Payment links on invoices',
    paymentLinksDescription: 'Each invoice gets a secure payment link your clients can click to pay immediately. Manage which invoices have this from the invoices list.',
    paymentLinksCta: 'View invoices',
    templatesSupportTitle: 'What templates cover',
    templatesSupportDescription:
      'You can customize reminder emails below. Invoice emails (the initial send) are configured separately per invoice for now.',
    openInvoices: 'View invoices',
    recurrenceTitle: 'How recurring invoices work',
    recurrenceDescription:
      'Set up a recurring invoice to automatically create and send the same invoice on a regular schedule — monthly, quarterly, or custom.',
    recurrencePoints: [
      'Choose how often: monthly, quarterly, yearly, or set a custom interval',
      'Optionally auto-generate and auto-send each cycle',
      'To set it up, open an invoice and enable recurrence from there',
    ],
    recurrenceCapabilities: ['Auto-generate each cycle', 'Auto-send to client', 'Monthly / quarterly / yearly', 'Custom intervals'],
    recurrencePrimary: 'Open invoice list',
    recurrenceSecondary: 'Create new invoice',
    companyTitle: 'Your business details',
    companyDescription: 'This information appears on invoices and reminder emails sent to your clients.',
    companyLoading: 'Loading company settings...',
    companyLoadFailed: 'Failed to load company settings',
    companySaveFailed: 'Failed to save company settings',
    companySaved: 'Company settings saved',
    companyFields: {
      companyName: 'Company name',
      ownerName: 'Owner name',
      businessEmail: 'Business email',
      phone: 'Phone number',
      vatNumber: 'VAT number',
    },
    saveCompany: 'Save changes',
    savingCompany: 'Saving...',
    numberingTitle: 'Invoice numbering',
    numberingDescription:
      'Invoice numbers are assigned automatically in sequence. The format shown below is how they appear on documents.',
    numberingPattern: 'Example invoice number',
    numberingSystem: 'Sequential, automatic numbering',
    numberingSystemHelp: 'Numbers are managed by the system and cannot be manually changed.',
    openFullProfile: 'Edit full company profile',
  },
  fr: {
    sections: {
      payments: {
        title: 'Paiements',
        description: 'Connectez Stripe pour accepter les paiements en ligne.',
      },
      reminders: {
        title: 'Relances',
        description: 'Choisissez quand envoyer les e-mails de suivi.',
      },
      templates: {
        title: 'Modèles d\'e-mail',
        description: 'Personnalisez le contenu des relances.',
      },
      recurrence: {
        title: 'Récurrence',
        description: 'Répétez automatiquement les factures selon un calendrier.',
      },
      company: {
        title: 'Société & Facture',
        description: 'Nom, TVA et coordonnées de votre entreprise.',
      },
    },
    paymentsTitle: 'Accepter les paiements en ligne',
    paymentsDescription:
      'Connectez votre compte Stripe pour que vos clients puissent régler les factures par carte. Apple Pay et Google Pay sont aussi disponibles sur les appareils compatibles.',
    walletTitle: 'Apple Pay & Google Pay',
    walletDescription: 'Ces moyens de paiement sont proposés automatiquement aux clients lorsque leur appareil et navigateur les prennent en charge — aucune configuration supplémentaire requise.',
    walletBrowserNote: 'La disponibilité dépend de l\'appareil et du navigateur du client.',
    paymentLinksTitle: 'Liens de paiement sur les factures',
    paymentLinksDescription: 'Chaque facture dispose d\'un lien de paiement sécurisé que vos clients peuvent utiliser pour régler immédiatement. Gérez cela depuis la liste des factures.',
    paymentLinksCta: 'Voir les factures',
    templatesSupportTitle: 'Ce que couvrent les modèles',
    templatesSupportDescription:
      'Vous pouvez personnaliser les e-mails de relance ci-dessous. Les e-mails de facture initiaux se configurent séparément pour l\'instant.',
    openInvoices: 'Voir les factures',
    recurrenceTitle: 'Comment fonctionne la récurrence',
    recurrenceDescription:
      'Configurez une facture récurrente pour la créer et l\'envoyer automatiquement à intervalles réguliers — mensuel, trimestriel ou personnalisé.',
    recurrencePoints: [
      'Choisissez la fréquence : mensuelle, trimestrielle, annuelle ou intervalle personnalisé',
      'Optionnellement, génération et envoi automatiques à chaque cycle',
      'Pour configurer, ouvrez une facture et activez la récurrence depuis celle-ci',
    ],
    recurrenceCapabilities: ['Génération automatique', 'Envoi automatique', 'Mensuel / trimestriel / annuel', 'Intervalles personnalisés'],
    recurrencePrimary: 'Ouvrir la liste des factures',
    recurrenceSecondary: 'Créer une facture',
    companyTitle: 'Informations de votre entreprise',
    companyDescription: 'Ces informations apparaissent sur les factures et les e-mails de relance envoyés à vos clients.',
    companyLoading: 'Chargement des paramètres société...',
    companyLoadFailed: 'Impossible de charger les paramètres société',
    companySaveFailed: 'Impossible d\'enregistrer les paramètres société',
    companySaved: 'Paramètres société enregistrés',
    companyFields: {
      companyName: 'Nom de l\'entreprise',
      ownerName: 'Nom du propriétaire',
      businessEmail: 'E-mail professionnel',
      phone: 'Numéro de téléphone',
      vatNumber: 'Numéro de TVA',
    },
    saveCompany: 'Enregistrer',
    savingCompany: 'Enregistrement...',
    numberingTitle: 'Numérotation des factures',
    numberingDescription:
      'Les numéros de facture sont attribués automatiquement en séquence. Le format ci-dessous correspond à leur affichage sur les documents.',
    numberingPattern: 'Exemple de numéro de facture',
    numberingSystem: 'Numérotation séquentielle automatique',
    numberingSystemHelp: 'Les numéros sont gérés par le système et ne peuvent pas être modifiés manuellement.',
    openFullProfile: 'Modifier le profil complet',
  },
} as const;

function SectionSwitchButton({
  title,
  description,
  active,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex min-w-56 snap-start flex-col gap-2.5 rounded-2xl border p-4 text-left transition-all duration-200 sm:min-w-0 ${
        active
          ? 'border-primary/40 bg-primary/8 shadow-md ring-1 ring-primary/20'
          : 'border-border/60 bg-card hover:border-primary/20 hover:bg-primary/5 hover:shadow-sm'
      }`}
    >
      <div className={`inline-flex size-9 items-center justify-center rounded-xl transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
      }`}>
        {icon}
      </div>
      <div>
        <p className={`text-sm font-semibold transition-colors ${active ? 'text-primary' : 'text-foreground'}`}>{title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      {active ? <div className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" /> : null}
    </button>
  );
}

function UtilityCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardHeader className="p-5 pb-4">
        <div className="flex items-start gap-4">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            {icon}
          </div>
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold leading-snug">{title}</CardTitle>
            <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      {children ? <CardContent className="space-y-4 px-5 pb-5 pt-0">{children}</CardContent> : null}
    </Card>
  );
}

export default function SettingsHomePage() {
  const { locale } = useLocale();
  const t = settingsCenterMessages[locale];

  const [activeSection, setActiveSection] = useState<SettingsCenterSection>('payments');
  const [companyForm, setCompanyForm] = useState<CompanySettingsForm>(EMPTY_COMPANY_FORM);
  const [companyExists, setCompanyExists] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [companySaving, setCompanySaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadCompanyProfile = async () => {
      setCompanyLoading(true);
      try {
        const response = await fetch('/api/cprofile', { cache: 'no-store' });
        const payload = (await response.json()) as {
          success?: boolean;
          profile?: Partial<CompanySettingsForm>;
        };

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload.success || !payload.profile) {
          setCompanyExists(false);
          setCompanyForm(EMPTY_COMPANY_FORM);
          return;
        }

        setCompanyExists(true);
        setCompanyForm({
          companyName: payload.profile.companyName ?? '',
          ownerName: payload.profile.ownerName ?? '',
          businessEmail: payload.profile.businessEmail ?? '',
          phone: payload.profile.phone ?? '',
          vatNumber: payload.profile.vatNumber ?? '',
        });
      } catch (error) {
        if (!cancelled) {
          toast.error(resolveTranslatedError(locale, error, t.companyLoadFailed));
        }
      } finally {
        if (!cancelled) {
          setCompanyLoading(false);
        }
      }
    };

    void loadCompanyProfile();

    return () => {
      cancelled = true;
    };
  }, [locale, t.companyLoadFailed]);

  async function handleSaveCompany() {
    setCompanySaving(true);
    try {
      const response = await fetch('/api/cprofile', {
        method: companyExists ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...companyForm, locale }),
      });

      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t.companySaveFailed);
      }

      setCompanyExists(true);
      toast.success(t.companySaved);
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t.companySaveFailed));
    } finally {
      setCompanySaving(false);
    }
  }

  const invoiceNumberExample = formatInvoiceDisplayNumber(locale, '2026-0007');

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="no-scrollbar -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:grid-cols-5">
        <SectionSwitchButton
          title={t.sections.payments.title}
          description={t.sections.payments.description}
          active={activeSection === 'payments'}
          icon={<CreditCardIcon className="size-5" />}
          onClick={() => setActiveSection('payments')}
        />
        <SectionSwitchButton
          title={t.sections.reminders.title}
          description={t.sections.reminders.description}
          active={activeSection === 'reminders'}
          icon={<BellIcon className="size-5" />}
          onClick={() => setActiveSection('reminders')}
        />
        <SectionSwitchButton
          title={t.sections.templates.title}
          description={t.sections.templates.description}
          active={activeSection === 'templates'}
          icon={<MailIcon className="size-5" />}
          onClick={() => setActiveSection('templates')}
        />
        <SectionSwitchButton
          title={t.sections.recurrence.title}
          description={t.sections.recurrence.description}
          active={activeSection === 'recurrence'}
          icon={<Repeat2Icon className="size-5" />}
          onClick={() => setActiveSection('recurrence')}
        />
        <SectionSwitchButton
          title={t.sections.company.title}
          description={t.sections.company.description}
          active={activeSection === 'company'}
          icon={<Building2Icon className="size-5" />}
          onClick={() => setActiveSection('company')}
        />
      </div>

      {activeSection === 'payments' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <StripeSettingsPage embedded />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <UtilityCard title={t.walletTitle} description={t.walletDescription} icon={<SmartphoneIcon className="size-5" />}>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                  <CheckCircle2Icon className="size-3.5 text-green-500" />
                  <p className="text-sm font-medium">Apple Pay</p>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                  <CheckCircle2Icon className="size-3.5 text-green-500" />
                  <p className="text-sm font-medium">Google Pay</p>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">{t.walletBrowserNote}</p>
              </div>
            </UtilityCard>
            <UtilityCard title={t.paymentLinksTitle} description={t.paymentLinksDescription} icon={<GlobeIcon className="size-5" />}>
              <Button asChild variant="outline" className="w-full justify-between">
                <Link href="/invoices">
                  <span>{t.paymentLinksCta}</span>
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
            </UtilityCard>
          </div>
        </div>
      ) : null}

      {activeSection === 'reminders' ? <ReminderSettingsPage embedded lockedSection="timing" /> : null}

      {activeSection === 'templates' ? (
        <div className="space-y-4">
          <UtilityCard title={t.templatesSupportTitle} description={t.templatesSupportDescription} icon={<MailIcon className="size-5" />}>
            <Button asChild variant="outline" className="w-full justify-between sm:w-auto">
              <Link href="/invoices">
                <span>{t.openInvoices}</span>
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </UtilityCard>
          <ReminderSettingsPage embedded lockedSection="templates" />
        </div>
      ) : null}

      {activeSection === 'recurrence' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
          <UtilityCard title={t.recurrenceTitle} description={t.recurrenceDescription} icon={<Repeat2Icon className="size-5" />}>
            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4">
              {t.recurrencePoints.map((point) => (
                <div key={point} className="flex items-start gap-2.5">
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p className="text-sm text-muted-foreground">{point}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="w-full sm:w-auto">
                <Link href="/invoices">{t.recurrencePrimary}</Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/invoices/new">{t.recurrenceSecondary}</Link>
              </Button>
            </div>
          </UtilityCard>

          <UtilityCard title={t.sections.recurrence.title} description={t.sections.recurrence.description} icon={<ShieldCheckIcon className="size-5" />}>
            <div className="grid grid-cols-2 gap-2">
              {t.recurrenceCapabilities.map((capability) => (
                <div key={capability} className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                  <CheckCircle2Icon className="size-3.5 shrink-0 text-primary" />
                  <p className="text-xs font-medium text-foreground">{capability}</p>
                </div>
              ))}
            </div>
          </UtilityCard>
        </div>
      ) : null}

      {activeSection === 'company' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.8fr)]">
          <UtilityCard title={t.companyTitle} description={t.companyDescription} icon={<Building2Icon className="size-5" />}>
            {companyLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                {t.companyLoading}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">{t.companyFields.companyName}</Label>
                    <Input id="company-name" value={companyForm.companyName} onChange={(event) => setCompanyForm((prev) => ({ ...prev, companyName: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="owner-name">{t.companyFields.ownerName}</Label>
                    <Input id="owner-name" value={companyForm.ownerName} onChange={(event) => setCompanyForm((prev) => ({ ...prev, ownerName: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business-email">{t.companyFields.businessEmail}</Label>
                    <Input id="business-email" type="email" value={companyForm.businessEmail} onChange={(event) => setCompanyForm((prev) => ({ ...prev, businessEmail: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-phone">{t.companyFields.phone}</Label>
                    <Input id="company-phone" value={companyForm.phone} onChange={(event) => setCompanyForm((prev) => ({ ...prev, phone: event.target.value }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vat-number">{t.companyFields.vatNumber}</Label>
                  <Input id="vat-number" value={companyForm.vatNumber} onChange={(event) => setCompanyForm((prev) => ({ ...prev, vatNumber: event.target.value }))} />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="button" className="w-full sm:w-auto" disabled={companySaving} onClick={() => void handleSaveCompany()}>
                    {companySaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                    {companySaving ? t.savingCompany : t.saveCompany}
                  </Button>
                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <Link href="/profile">{t.openFullProfile}</Link>
                  </Button>
                </div>
              </>
            )}
          </UtilityCard>

          <UtilityCard title={t.numberingTitle} description={t.numberingDescription} icon={<FileStackIcon className="size-5" />}>
            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/30 p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.numberingPattern}</p>
                <p className="mt-1.5 font-mono text-xl font-bold tracking-tight text-foreground">{invoiceNumberExample}</p>
              </div>
              <div className="border-t border-border/40 pt-3">
                <p className="text-sm font-medium text-foreground">{t.numberingSystem}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{t.numberingSystemHelp}</p>
              </div>
            </div>
          </UtilityCard>
        </div>
      ) : null}
    </div>
  );
}
