'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';

import { AlertTriangleIcon, Loader2Icon, MailIcon, X } from 'lucide-react';
import { toast } from 'sonner';

import { formatInvoiceDisplayNumber, resolveTranslatedError } from '@/lib/i18n/messages';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Locale = 'en' | 'fr';
type InvoiceSendMode = 'normal' | 'online';

interface SendInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  clientEmail: string | null | undefined;
  clientName?: string | null;
  companyName?: string | null;
  locale: Locale;
  onSent?: () => void;
}

const translations = {
  en: {
    title: 'Send invoice by email',
    description: 'Send this invoice as a branded PDF attachment. Optionally include online payment.',
    emailLabel: 'Client email',
    emailPlaceholder: 'client@example.com',
    subjectLabel: 'Subject',
    messageLabel: 'Message',
    cancel: 'Cancel',
    sendNormal: 'Send',
    sendOnline: 'Send with online payment',
    sendingNormal: 'Sending invoice...',
    sendingOnline: 'Sending invoice with online payment...',
    modeHint: 'Normal send includes the PDF only. Online payment adds a secure pay button in the email and PDF.',
    emailRequired: 'Client email is required',
    successNormal: 'Invoice sent successfully',
    successOnline: 'Invoice with online payment sent successfully',
    error: 'Failed to send invoice',
    stripeErrorTitle: 'Stripe is not connected',
    stripeErrorDescription: 'Please connect Stripe to send invoices with online payment.',
    connectStripe: 'Connect Stripe',
    connectRedirecting: 'Redirecting to Stripe onboarding...',
    wireDisconnected: 'Wire disconnected illustration placeholder',
    defaultSubject: (invoiceNumber: string) => `Invoice ${invoiceNumber}`,
    defaultMessage: (invoiceNumber: string, clientName?: string | null, senderCompany?: string | null) => {
      const greeting = clientName ? `Dear ${clientName},` : 'Hello,';
      const signOff = senderCompany ? `Best regards,\n${senderCompany}` : 'Best regards,';
      return `${greeting}\n\nPlease find attached your invoice ${invoiceNumber}.\n\nIf you have any questions about this invoice, feel free to reply to this email.\n\n${signOff}`;
    },
  },
  fr: {
    title: 'Envoyer la facture par e-mail',
    description: 'Envoyez cette facture en PDF joint avec votre branding. Le paiement en ligne est optionnel.',
    emailLabel: 'E-mail du client',
    emailPlaceholder: 'client@exemple.com',
    subjectLabel: 'Objet',
    messageLabel: 'Message',
    cancel: 'Annuler',
    sendNormal: 'Envoyer normalement',
    sendOnline: 'Envoyer avec paiement en ligne',
    sendingNormal: 'Envoi de la facture...',
    sendingOnline: 'Envoi de la facture avec paiement en ligne...',
    modeHint: 'Envoi normal: PDF uniquement. Paiement en ligne: ajoute un bouton de paiement sécurisé dans l’e-mail et le PDF.',
    emailRequired: "L'e-mail du client est requis",
    successNormal: 'Facture envoy\u00e9e avec succ\u00e8s',
    successOnline: 'Facture envoy\u00e9e avec paiement en ligne',
    error: "Impossible d'envoyer la facture",
    stripeErrorTitle: "Stripe n'est pas connect\u00e9",
    stripeErrorDescription: 'Veuillez connecter Stripe pour envoyer des factures avec paiement en ligne.',
    connectStripe: 'Connecter Stripe',
    connectRedirecting: "Redirection vers l'onboarding Stripe...",
    wireDisconnected: 'Emplacement illustration c\u00e2ble d\u00e9connect\u00e9',
    defaultSubject: (invoiceNumber: string) => `Facture ${invoiceNumber}`,
    defaultMessage: (invoiceNumber: string, clientName?: string | null, senderCompany?: string | null) => {
      const greeting = clientName ? `Bonjour ${clientName},` : 'Bonjour,';
      const signOff = senderCompany ? `Bien cordialement,\n${senderCompany}` : 'Bien cordialement,';
      return `${greeting}\n\nVeuillez trouver ci-joint votre facture ${invoiceNumber}.\n\nSi vous avez des questions sur cette facture, vous pouvez r\u00e9pondre \u00e0 cet e-mail.\n\n${signOff}`;
    },
  },
};

export default function SendInvoiceModal({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  clientEmail,
  clientName,
  companyName,
  locale,
  onSent,
}: SendInvoiceModalProps) {
  const t = translations[locale];
  const displayInvoiceNumber = formatInvoiceDisplayNumber(locale, invoiceNumber);

  const [resolvedCompanyName, setResolvedCompanyName] = useState<string | null>(companyName ?? null);

  const getInitialSubject = useCallback(() => t.defaultSubject(displayInvoiceNumber), [displayInvoiceNumber, t]);
  const getInitialMessage = useCallback(
    () => t.defaultMessage(displayInvoiceNumber, clientName, resolvedCompanyName),
    [displayInvoiceNumber, t, clientName, resolvedCompanyName]
  );

  const [email, setEmail] = useState(clientEmail || '');
  const [subject, setSubject] = useState(getInitialSubject);
  const [message, setMessage] = useState(getInitialMessage);
  const [sendingMode, setSendingMode] = useState<InvoiceSendMode | null>(null);
  const [showStripeError, setShowStripeError] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setResolvedCompanyName(companyName ?? null);

    if (companyName?.trim()) {
      return;
    }

    let cancelled = false;

    const loadCompanyProfile = async () => {
      try {
        const response = await fetch('/api/cprofile', { method: 'GET', cache: 'no-store' });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          success?: boolean;
          profile?: { companyName?: string | null; ownerName?: string | null };
        };

        if (!cancelled && payload.success && payload.profile) {
          setResolvedCompanyName(payload.profile.companyName || payload.profile.ownerName || null);
        }
      } catch {
        // Ignore profile fetch failure and keep existing fallback.
      }
    };

    void loadCompanyProfile();

    return () => {
      cancelled = true;
    };
  }, [open, companyName]);

  const sending = sendingMode !== null;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setEmail(clientEmail || '');
      setSubject(getInitialSubject());
      setMessage(getInitialMessage());
      setShowStripeError(false);
      setSendingMode(null);
    }
    onOpenChange(nextOpen);
  };

  function isStripeNotConnectedError(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes('stripe') && normalized.includes('connect');
  }

  function handleConnectStripeClick() {
    toast.info(t.connectRedirecting);
    window.location.assign('/api/stripe/connect');
  }

  async function handleSend(mode: InvoiceSendMode) {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error(t.emailRequired);
      return;
    }

    setSendingMode(mode);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          subject: subject.trim(),
          message: message.trim(),
          locale,
          sendMode: mode,
        }),
      });

      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        const resolvedMessage = payload.message || t.error;
        if (mode === 'online' && isStripeNotConnectedError(resolvedMessage)) {
          setShowStripeError(true);
          return;
        }
        throw new Error(resolvedMessage);
      }

      toast.success(mode === 'online' ? t.successOnline : t.successNormal);
      onSent?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t.error));
    } finally {
      setSendingMode(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex w-[calc(100vw-1rem)] max-w-lg flex-col gap-2.5 overflow-hidden scroll-pb-24 p-3.5 pb-3.5 [&_button[data-slot=button]]:focus-visible:ring-inset [&_input[data-slot=input]]:focus-visible:ring-inset [&_textarea]:focus-visible:ring-inset [&_textarea]:focus-visible:ring-offset-0 sm:w-[calc(100vw-2rem)] sm:p-4 sm:pb-4">
        <div className="relative flex min-h-0 flex-1 flex-col gap-2.5">
          {sending ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-background/80 p-4 backdrop-blur-[1px]">
              <div className="flex w-full max-w-xs items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
                <Loader2Icon className="size-5 shrink-0 animate-spin" />
                <p className="text-sm text-foreground">{sendingMode === 'online' ? t.sendingOnline : t.sendingNormal}</p>
              </div>
            </div>
          ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-3 right-3"
          aria-label={t.cancel}
          onClick={() => onOpenChange(false)}
          disabled={sending}
        >
          <X className="size-4" />
        </Button>

        {showStripeError ? (
          <>
            <DialogHeader className="gap-1 pr-12">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <AlertTriangleIcon className="size-4 text-amber-600" />
                {t.stripeErrorTitle}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">{t.stripeErrorDescription}</DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3 sm:p-4">
                <div className="relative aspect-3/2 w-full max-w-[320px]">
                  <Image
                    src="/stripe.png"
                    alt={t.wireDisconnected}
                    fill
                    sizes="(max-width: 640px) 70vw, 320px"
                    className="object-contain"
                    quality={100}
                    priority
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="border-t pt-3">
              <Button type="button" variant="outline" className="h-10 text-sm sm:h-9" onClick={() => onOpenChange(false)}>
                {t.cancel}
              </Button>
              <Button type="button" className="h-10 text-sm sm:h-9" onClick={handleConnectStripeClick}>
                {t.connectStripe}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="gap-1 pr-12">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <MailIcon className="size-4" />
                {t.title}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">{t.description}</DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="send-invoice-email" className="text-xs">{t.emailLabel}</Label>
                  <Input
                    id="send-invoice-email"
                    type="email"
                    className="h-9 text-sm"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t.emailPlaceholder}
                    disabled={sending}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="send-invoice-subject" className="text-xs">{t.subjectLabel}</Label>
                  <Input
                    id="send-invoice-subject"
                    type="text"
                    className="h-9 text-sm"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    disabled={sending}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="send-invoice-message" className="text-xs">{t.messageLabel}</Label>
                <textarea
                  id="send-invoice-message"
                  className="flex min-h-28 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  disabled={sending}
                />
              </div>

              <p className="text-xs text-muted-foreground">{displayInvoiceNumber}</p>
              <p className="text-xs text-muted-foreground">{t.modeHint}</p>
            </div>

            <DialogFooter className="grid grid-cols-1 gap-2 border-t pt-3 sm:grid-cols-2">
              <Button type="button" variant="outline" className="h-auto min-h-10 w-full py-2 text-sm sm:h-auto sm:min-h-9 sm:col-span-1" onClick={() => onOpenChange(false)} disabled={sending}>
                {t.cancel}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-auto min-h-10 w-full bg-slate-700 py-2 text-sm text-white hover:bg-slate-800 sm:h-auto sm:min-h-9 sm:col-span-1"
                onClick={() => handleSend('normal')}
                disabled={sending}
              >
                {sendingMode === 'normal' ? <Loader2Icon className="size-4 animate-spin" /> : null}
                <span className="text-center leading-tight">{t.sendNormal}</span>
              </Button>
              <Button
                type="button"
                className="h-auto min-h-10 w-full py-2 text-sm sm:h-auto sm:min-h-9 sm:col-span-2"
                onClick={() => handleSend('online')}
                disabled={sending}
              >
                {sendingMode === 'online' ? <Loader2Icon className="size-4 animate-spin" /> : null}
                <span className="text-center leading-tight">{t.sendOnline}</span>
              </Button>
            </DialogFooter>
          </>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
