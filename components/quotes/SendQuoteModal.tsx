'use client';

import { useCallback, useState } from 'react';

import { CheckIcon, CopyIcon, Loader2Icon, SendIcon } from 'lucide-react';
import { toast } from 'sonner';

import { resolveTranslatedError } from '@/lib/i18n/messages';
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
type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused' | 'rejected';

interface SendQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  quoteNumber: string;
  clientEmail: string | null | undefined;
  clientName: string | null | undefined;
  companyName: string | null | undefined;
  quoteStatus: QuoteStatus;
  initialSignUrl?: string | null;
  initialSubject?: string | null;
  initialMessage?: string | null;
  locale: Locale;
  onSent?: () => void;
}

const translations = {
  en: {
    title: 'Send quote by email',
    description: 'Send this quote as a PDF attachment to your client.',
    successTitle: 'Quote email sent',
    successDescription: 'The email was sent successfully and this quote is ready for your client.',
    resendSuccessDescription: 'The signing email was resent successfully to your client.',
    nextStepLabel: 'Next step',
    nextStep: 'Your client can now open the email and continue from the signing link inside it.',
    emailLabel: 'Client email',
    emailPlaceholder: 'client@example.com',
    subjectLabel: 'Subject',
    messageLabel: 'Message',
    cancel: 'Cancel',
    close: 'Close',
    sendForSigning: 'Send for signing',
    resendSigningLink: 'Resend signing link',
    send: 'Send to client',
    sending: 'Sending...',
    success: 'Quote sent successfully',
    emailSentWithLink: 'Email sent. Signing link ready to share:',
    copyLink: 'Copy link',
    copied: 'Copied',
    error: 'Failed to send quote',
    emailRequired: 'Client email is required',
    defaultSubject: (quoteNumber: string) => `Quote ${quoteNumber} - Please review and sign`,
    defaultMessage: (quoteNumber: string, clientName?: string | null, senderCompany?: string | null) => {
      const greeting = clientName ? `Dear ${clientName},` : 'Hello,';
      const signOff = senderCompany ? `Best regards,\n${senderCompany}` : 'Best regards,';
      return `${greeting}\n\nPlease find attached your quote ${quoteNumber}.\n\nWhen you are ready, use the secure button in this email to review the quote and sign online.\n\nFeel free to contact us if you have any questions before signing.\n\n${signOff}`;
    },
  },
  fr: {
    title: 'Envoyer le devis par e-mail',
    description: 'Envoyer ce devis en pi\u00e8ce jointe PDF au client.',
    successTitle: 'E-mail du devis envoy\u00e9',
    successDescription: "L'e-mail a \u00e9t\u00e9 envoy\u00e9 avec succ\u00e8s et ce devis est pr\u00eat pour votre client.",
    resendSuccessDescription: "L'e-mail de signature a \u00e9t\u00e9 renvoy\u00e9 avec succ\u00e8s \u00e0 votre client.",
    nextStepLabel: 'Prochaine \u00e9tape',
    nextStep: "Votre client peut maintenant ouvrir l'e-mail et continuer \u00e0 partir du lien de signature qu'il contient.",
    emailLabel: 'E-mail du client',
    emailPlaceholder: 'client@exemple.com',
    subjectLabel: 'Objet',
    messageLabel: 'Message',
    cancel: 'Annuler',
    close: 'Fermer',
    sendForSigning: 'Envoyer pour signature',
    resendSigningLink: 'Renvoyer le lien de signature',
    send: 'Envoyer au client',
    sending: 'Envoi en cours...',
    success: 'Devis envoy\u00e9 avec succ\u00e8s',
    emailSentWithLink: 'E-mail envoy\u00e9. Lien de signature pr\u00eat \u00e0 partager\u00a0:',
    copyLink: 'Copier le lien',
    copied: 'Copi\u00e9',
    error: "Impossible d'envoyer le devis",
    emailRequired: "L'e-mail du client est requis",
    defaultSubject: (quoteNumber: string) => `Devis ${quoteNumber} - Merci de v\u00e9rifier et signer`,
    defaultMessage: (quoteNumber: string, clientName?: string | null, senderCompany?: string | null) => {
      const greeting = clientName ? `Bonjour ${clientName},` : 'Bonjour,';
      const signOff = senderCompany ? `Bien cordialement,\n${senderCompany}` : 'Bien cordialement,';
      return `${greeting}\n\nVeuillez trouver ci-joint votre devis ${quoteNumber}.\n\nLorsque vous \u00eates pr\u00eat, utilisez le bouton s\u00e9curis\u00e9 de cet e-mail pour consulter le devis et signer en ligne.\n\nN'h\u00e9sitez pas \u00e0 revenir vers nous pour toute question avant signature.\n\n${signOff}`;
    },
  },
};

function CopyLinkButton({ signUrl, copyLabel, copiedLabel }: { signUrl: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(signUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the input
    }
  }, [signUrl]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded-md border border-input bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
    >
      {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
      <span className="sr-only">{copied ? copiedLabel : copyLabel}</span>
    </button>
  );
}

export default function SendQuoteModal({
  open,
  onOpenChange,
  quoteId,
  quoteNumber,
  clientEmail,
  clientName,
  companyName,
  quoteStatus,
  initialSignUrl,
  initialSubject,
  initialMessage,
  locale,
  onSent,
}: SendQuoteModalProps) {
  const t = translations[locale];

  const getInitialSubject = useCallback(
    () => initialSubject?.trim() || t.defaultSubject(quoteNumber),
    [initialSubject, t, quoteNumber]
  );

  const getInitialMessage = useCallback(
    () => initialMessage?.trim() || t.defaultMessage(quoteNumber, clientName, companyName),
    [initialMessage, t, quoteNumber, clientName, companyName]
  );

  const [email, setEmail] = useState(clientEmail || '');
  const [subject, setSubject] = useState(getInitialSubject);
  const [message, setMessage] = useState(getInitialMessage);
  const [sending, setSending] = useState(false);
  const [signUrl, setSignUrl] = useState<string | null>(initialSignUrl ?? null);
  const [showSuccessState, setShowSuccessState] = useState(false);


  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setEmail(clientEmail || '');
      setSubject(getInitialSubject());
      setMessage(getInitialMessage());
      setSignUrl(initialSignUrl ?? null);
      setShowSuccessState(false);
    }
    onOpenChange(nextOpen);
  };

  async function handleSend() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error(t.emailRequired);
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          subject: subject.trim(),
          message: message.trim(),
          locale,
        }),
      });

      const payload = (await response.json()) as { success?: boolean; message?: string; signUrl?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t.error);
      }

      setSignUrl(payload.signUrl ?? null);
      setShowSuccessState(true);
      onSent?.();
      toast.success(t.success);
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t.error));
    } finally {
      setSending(false);
    }
  }

  const isResend = quoteStatus === 'sent' || Boolean(signUrl);
  const successDescription = isResend ? t.resendSuccessDescription : t.successDescription;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex w-[calc(100vw-1rem)] max-w-md max-h-[calc(100dvh-1rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))] flex-col gap-2.5 scroll-pb-24 p-3.5 pb-3.5 [&_button[data-slot=button]]:focus-visible:ring-inset [&_input[data-slot=input]]:focus-visible:ring-inset [&_textarea]:focus-visible:ring-inset [&_textarea]:focus-visible:ring-offset-0 sm:max-h-[calc(100dvh-2rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))] sm:p-4 sm:pb-4">
        <DialogHeader className="gap-1 pr-8">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <SendIcon className="size-4" />
            {showSuccessState ? t.successTitle : t.title}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {showSuccessState ? successDescription : t.description}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1 text-sm">
          {showSuccessState ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm font-medium text-foreground">{t.successTitle}</p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{successDescription}</p>
              </div>

              {signUrl ? (
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.emailSentWithLink}</p>
                  <div className="flex min-w-0 items-center gap-2">
                    <input
                      readOnly
                      value={signUrl}
                      className="min-w-0 flex-1 truncate rounded-md border border-input bg-muted px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <CopyLinkButton signUrl={signUrl} copyLabel={t.copyLink} copiedLabel={t.copied} />
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.nextStepLabel}</p>
                <p className="mt-1 text-sm text-foreground">{t.nextStep}</p>
              </div>

            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="send-quote-email" className="text-xs">{t.emailLabel}</Label>
                  <Input
                    id="send-quote-email"
                    type="email"
                    className="h-9 text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    disabled={sending}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="send-quote-subject" className="text-xs">{t.subjectLabel}</Label>
                  <Input
                    id="send-quote-subject"
                    type="text"
                    className="h-9 text-sm"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={sending}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="send-quote-message" className="text-xs">{t.messageLabel}</Label>
                <textarea
                  id="send-quote-message"
                  className="flex min-h-28 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={sending}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          {showSuccessState ? (
            <Button type="button" className="h-10 text-sm sm:h-9" onClick={() => onOpenChange(false)}>
              {t.close}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" className="h-10 text-sm sm:h-9" onClick={() => onOpenChange(false)} disabled={sending}>
                {t.cancel}
              </Button>
              <Button type="button" className="h-10 text-sm sm:h-9" onClick={handleSend} disabled={sending}>
                {sending ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    {t.sending}
                  </>
                ) : (
                  <>
                    <SendIcon className="size-4" />
                    {isResend ? t.resendSigningLink : t.sendForSigning}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
