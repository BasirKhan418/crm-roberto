'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2Icon, CircleDashedIcon, CreditCardIcon, Loader2Icon, Link2OffIcon, PlugZapIcon } from 'lucide-react';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import { resolveTranslatedError } from '@/lib/i18n/messages';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

type StripeConnectStatus = {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingComplete: boolean;
};

export default function StripeSettingsPage() {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const t = {
    en: {
      title: 'Stripe Connect',
      shellTitle: 'Stripe Payments',
      subtitle:
        'When clients pay invoices, money goes directly to your bank account - we never hold your funds.',
      backToProfile: 'Return to company profile',
      loading: 'Loading Stripe status...',
      loadFailed: 'Failed to load Stripe status',
      connectedBadge: 'Connected',
      pendingBadge: 'Pending verification',
      disconnectedBadge: 'Not connected',
      notConnectedTitle: 'Connect your Stripe account to accept online payments',
      notConnectedDescription: 'Create or link your Stripe account to receive customer invoice payments online.',
      connectButton: 'Connect Stripe',
      onboardingTitle: 'Stripe account connected but verification pending',
      onboardingDescription:
        'Stripe still needs additional verification details before payouts are active for your bank account.',
      continueSetup: 'Continue Stripe setup',
      activeTitle: 'Payments active',
      activeDescription: 'Your Stripe account is verified and ready to accept invoice payments.',
      chargesEnabled: 'Charges enabled',
      payoutsEnabled: 'Payouts enabled',
      yes: 'Yes',
      no: 'No',
      disconnect: 'Disconnect Stripe',
      disconnecting: 'Disconnecting...',
      disconnectSuccess: 'Stripe account disconnected from this workspace',
      disconnectFailed: 'Unable to disconnect Stripe account',
      statusComplete: 'Stripe connected!',
      statusRefresh: 'Please complete your Stripe setup',
      statusPending: 'Stripe setup is still pending verification',
      statusMissing: 'No Stripe account found. Please connect Stripe again.',
      statusError: 'Stripe onboarding callback failed. Please try again.',
      statusConnectNotEnabled:
        'Stripe Connect is not enabled for this account. Enable Connect in Stripe Dashboard, then try again.',
      statusIndiaRestricted:
        'India platform restriction: Express onboarding is limited for loss-liable platforms. We switched to Standard where possible. Please continue in Stripe Dashboard if needed.',
      statusConnectError: 'Unable to start Stripe onboarding. Please try again.',
    },
    fr: {
      title: 'Stripe Connect',
      shellTitle: 'Paiements Stripe',
      subtitle:
        'Quand les clients paient les factures, l argent va directement sur votre compte bancaire - nous ne detenons jamais vos fonds.',
      backToProfile: 'Retour au profil entreprise',
      loading: 'Chargement du statut Stripe...',
      loadFailed: 'Impossible de charger le statut Stripe',
      connectedBadge: 'Connecte',
      pendingBadge: 'Verification en attente',
      disconnectedBadge: 'Non connecte',
      notConnectedTitle: 'Connectez votre compte Stripe pour accepter les paiements en ligne',
      notConnectedDescription: 'Creez ou liez votre compte Stripe pour recevoir les paiements de factures en ligne.',
      connectButton: 'Connecter Stripe',
      onboardingTitle: 'Compte Stripe connecte mais verification en attente',
      onboardingDescription:
        'Stripe demande encore des informations de verification avant d activer les virements vers votre compte bancaire.',
      continueSetup: 'Continuer la configuration Stripe',
      activeTitle: 'Paiements actifs',
      activeDescription: 'Votre compte Stripe est verifie et pret a accepter les paiements de factures.',
      chargesEnabled: 'Paiements actives',
      payoutsEnabled: 'Virements actifs',
      yes: 'Oui',
      no: 'Non',
      disconnect: 'Deconnecter Stripe',
      disconnecting: 'Deconnexion...',
      disconnectSuccess: 'Compte Stripe deconnecte de cet espace',
      disconnectFailed: 'Impossible de deconnecter le compte Stripe',
      statusComplete: 'Stripe connecte !',
      statusRefresh: 'Veuillez terminer votre configuration Stripe',
      statusPending: 'La configuration Stripe est toujours en attente de verification',
      statusMissing: 'Aucun compte Stripe trouve. Reconnectez Stripe.',
      statusError: 'Echec du retour Stripe. Veuillez reessayer.',
      statusConnectNotEnabled:
        'Stripe Connect n est pas active pour ce compte. Activez Connect dans le tableau de bord Stripe puis reessayez.',
      statusIndiaRestricted:
        'Restriction plateforme Inde : l onboarding Express est limite pour les plateformes responsables des pertes. Nous basculons vers Standard si possible. Continuez dans Stripe si necessaire.',
      statusConnectError: 'Impossible de demarrer l onboarding Stripe. Veuillez reessayer.',
    },
  }[locale];

  useEffect(() => {
    async function loadStatus() {
      setLoading(true);
      try {
        const response = await fetch('/api/stripe/connect/status', { method: 'GET', cache: 'no-store' });
        const payload = (await response.json()) as Partial<StripeConnectStatus>;

        if (!response.ok) {
          throw new Error(t.loadFailed);
        }

        setStatus({
          connected: Boolean(payload.connected),
          chargesEnabled: Boolean(payload.chargesEnabled),
          payoutsEnabled: Boolean(payload.payoutsEnabled),
          onboardingComplete: Boolean(payload.onboardingComplete),
        });
      } catch (error) {
        toast.error(resolveTranslatedError(locale, error, t.loadFailed));
      } finally {
        setLoading(false);
      }
    }

    void loadStatus();
  }, [locale, t.loadFailed]);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (!statusParam) {
      return;
    }

    if (statusParam === 'complete') {
      toast.success(t.statusComplete);
      return;
    }
    if (statusParam === 'refresh') {
      toast.info(t.statusRefresh);
      return;
    }
    if (statusParam === 'pending') {
      toast.info(t.statusPending);
      return;
    }
    if (statusParam === 'missing') {
      toast.error(t.statusMissing);
      return;
    }
    if (statusParam === 'error') {
      toast.error(t.statusError);
      return;
    }
    if (statusParam === 'connect_not_enabled') {
      toast.error(t.statusConnectNotEnabled);
      return;
    }
    if (statusParam === 'india_restricted') {
      toast.error(t.statusIndiaRestricted);
      return;
    }
    if (statusParam === 'connect_error') {
      toast.error(t.statusConnectError);
    }
  }, [
    searchParams,
    t.statusComplete,
    t.statusConnectError,
    t.statusConnectNotEnabled,
    t.statusError,
    t.statusIndiaRestricted,
    t.statusMissing,
    t.statusPending,
    t.statusRefresh,
  ]);

  const mode = useMemo(() => {
    if (!status?.connected) {
      return 'disconnected' as const;
    }
    if (!status.onboardingComplete) {
      return 'pending' as const;
    }
    return 'connected' as const;
  }, [status]);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const response = await fetch('/api/stripe/connect', { method: 'DELETE' });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t.disconnectFailed);
      }

      setStatus({ connected: false, chargesEnabled: false, payoutsEnabled: false, onboardingComplete: false });
      toast.success(t.disconnectSuccess);
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t.disconnectFailed));
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <CrmShell title={t.shellTitle}>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" className="h-10">
          <Link href="/profile">{t.backToProfile}</Link>
        </Button>
      </div>

      <Card className="overflow-hidden border-primary/20 bg-linear-to-br from-primary/5 via-background to-background">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-linear-to-br from-sky-100 to-indigo-100 text-sky-700 dark:border-sky-800 dark:from-sky-900/40 dark:to-indigo-900/40 dark:text-sky-300">
                <CreditCardIcon className="size-5" />
              </div>
              <div>
                <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.title}</h1>
                <p className="text-sm text-muted-foreground">{t.subtitle}</p>
              </div>
            </div>
            {mode === 'connected' ? (
              <Badge className="bg-emerald-100 text-emerald-700">{t.connectedBadge}</Badge>
            ) : mode === 'pending' ? (
              <Badge className="bg-amber-100 text-amber-700">{t.pendingBadge}</Badge>
            ) : (
              <Badge variant="outline">{t.disconnectedBadge}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {loading
              ? t.loading
              : mode === 'disconnected'
                ? t.notConnectedTitle
                : mode === 'pending'
                  ? t.onboardingTitle
                  : t.activeTitle}
          </CardTitle>
          <CardDescription>
            {loading
              ? t.loading
              : mode === 'disconnected'
                ? t.notConnectedDescription
                : mode === 'pending'
                  ? t.onboardingDescription
                  : t.activeDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              {t.loading}
            </div>
          ) : null}

          {mode !== 'disconnected' && !loading ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t.chargesEnabled}</p>
                <p
                  className={`text-sm font-semibold ${
                    status?.chargesEnabled ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {status?.chargesEnabled ? t.yes : t.no}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t.payoutsEnabled}</p>
                <p
                  className={`text-sm font-semibold ${
                    status?.payoutsEnabled ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {status?.payoutsEnabled ? t.yes : t.no}
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 border-t pt-4">
          {mode === 'disconnected' ? (
            <Button asChild className="h-11 min-w-52">
              <Link href="/api/stripe/connect">
                <PlugZapIcon className="size-4" />
                {t.connectButton}
              </Link>
            </Button>
          ) : null}

          {mode === 'pending' ? (
            <Button asChild className="h-11 min-w-52">
              <Link href="/api/stripe/connect">
                <CircleDashedIcon className="size-4" />
                {t.continueSetup}
              </Link>
            </Button>
          ) : null}

          {mode === 'connected' ? (
            <>
              <Button className="h-11 min-w-52" variant="secondary" disabled>
                <CheckCircle2Icon className="size-4 text-emerald-600" />
                {t.activeTitle}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={disconnecting}
                onClick={() => void handleDisconnect()}
              >
                {disconnecting ? <Loader2Icon className="size-4 animate-spin" /> : <Link2OffIcon className="size-4" />}
                {disconnecting ? t.disconnecting : t.disconnect}
              </Button>
            </>
          ) : null}
        </CardFooter>
      </Card>
    </CrmShell>
  );
}
