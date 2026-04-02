'use client';

import { useState } from 'react';

import { Loader2Icon, SendIcon, X } from 'lucide-react';
import { toast } from 'sonner';

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
type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused';

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
    description: 'Envoyer ce devis en pièce jointe PDF au client.',
    successTitle: 'E-mail du devis envoye',
    successDescription: 'L e-mail a ete envoye avec succes et ce devis est pret pour votre client.',
    resendSuccessDescription: 'L e-mail de signature a ete renvoye avec succes a votre client.',
    nextStepLabel: 'Prochaine etape',
    nextStep: 'Votre client peut maintenant ouvrir l e-mail et continuer a partir du lien de signature qu il contient.',
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
    success: 'Devis envoyé avec succès',
    emailSentWithLink: 'E-mail envoye. Lien de signature pret a partager :',
    copyLink: 'Copier le lien',
    copied: 'Copie',
    error: "Impossible d'envoyer le devis",
    emailRequired: "L'e-mail du client est requis",
    defaultSubject: (quoteNumber: string) => `Devis ${quoteNumber} - Merci de verifier et signer`,
    defaultMessage: (quoteNumber: string, clientName?: string | null, senderCompany?: string | null) => {
      const greeting = clientName ? `Bonjour ${clientName},` : 'Bonjour,';
      const signOff = senderCompany ? `Bien cordialement,\n${senderCompany}` : 'Bien cordialement,';
      return `${greeting}\n\nVeuillez trouver ci-joint votre devis ${quoteNumber}.\n\nLorsque vous etes pret, utilisez le bouton securise de cet e-mail pour consulter le devis et signer en ligne.\n\nN'hesitez pas a revenir vers nous pour toute question avant signature.\n\n${signOff}`;
    },
  },
};

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
  locale,
  onSent,
}: SendQuoteModalProps) {
  const t = translations[locale];

  const [email, setEmail] = useState(clientEmail || '');
  const [subject, setSubject] = useState(t.defaultSubject(quoteNumber));
  const [message, setMessage] = useState(t.defaultMessage(quoteNumber, clientName, companyName));
  const [sending, setSending] = useState(false);
  const [signUrl, setSignUrl] = useState<string | null>(initialSignUrl ?? null);
  const [showSuccessState, setShowSuccessState] = useState(false);


  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setEmail(clientEmail || '');
      setSubject(t.defaultSubject(quoteNumber));
      setMessage(t.defaultMessage(quoteNumber, clientName, companyName));
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

      toast.success(t.success);
      setSignUrl(payload.signUrl ?? null);
      setShowSuccessState(true);
      onSent?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.error);
    } finally {
      setSending(false);
    }
  }

  const isResend = quoteStatus === 'sent' || Boolean(signUrl);
  const successDescription = isResend ? t.resendSuccessDescription : t.successDescription;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex w-[calc(100vw-1rem)] max-w-md max-h-[calc(100dvh-1rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))] flex-col gap-2.5 overflow-hidden p-3.5 pb-3.5 scroll-pb-24 [&_button[data-slot=button]]:focus-visible:ring-inset [&_input[data-slot=input]]:focus-visible:ring-inset [&_textarea]:focus-visible:ring-inset [&_textarea]:focus-visible:ring-offset-0 sm:max-h-[calc(100dvh-2rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))] sm:p-4 sm:pb-4">
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
