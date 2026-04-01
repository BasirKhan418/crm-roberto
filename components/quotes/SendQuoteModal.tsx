'use client';

import { useState } from 'react';

import { CheckIcon, CopyIcon, Loader2Icon, SendIcon } from 'lucide-react';
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
  locale: Locale;
  onSent?: () => void;
}

const translations = {
  en: {
    title: 'Send quote by email',
    description: 'Send this quote as a PDF attachment to your client.',
    emailLabel: 'Client email',
    emailPlaceholder: 'client@example.com',
    subjectLabel: 'Subject',
    messageLabel: 'Message',
    cancel: 'Cancel',
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
    defaultSubject: (quoteNumber: string) => `Your quote ${quoteNumber}`,
    defaultMessage: (quoteNumber: string, clientName?: string | null, senderCompany?: string | null) => {
      const greeting = clientName ? `Dear ${clientName},` : 'Hello,';
      const signOff = senderCompany ? `Best regards,\n${senderCompany}` : 'Best regards,';
      return `${greeting}\n\nPlease find attached your quote ${quoteNumber}.\n\nFeel free to contact us if you have any questions.\n\n${signOff}`;
    },
  },
  fr: {
    title: 'Envoyer le devis par e-mail',
    description: 'Envoyer ce devis en pièce jointe PDF au client.',
    emailLabel: 'E-mail du client',
    emailPlaceholder: 'client@exemple.com',
    subjectLabel: 'Objet',
    messageLabel: 'Message',
    cancel: 'Annuler',
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
    defaultSubject: (quoteNumber: string) => `Votre devis ${quoteNumber}`,
    defaultMessage: (quoteNumber: string, clientName?: string | null, senderCompany?: string | null) => {
      const greeting = clientName ? `Bonjour ${clientName},` : 'Bonjour,';
      const signOff = senderCompany ? `Bien cordialement,\n${senderCompany}` : 'Bien cordialement,';
      return `${greeting}\n\nVeuillez trouver ci-joint votre devis ${quoteNumber}.\n\nN'hésitez pas à revenir vers nous pour toute question.\n\n${signOff}`;
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
  locale,
  onSent,
}: SendQuoteModalProps) {
  const t = translations[locale];

  const [email, setEmail] = useState(clientEmail || '');
  const [subject, setSubject] = useState(t.defaultSubject(quoteNumber));
  const [message, setMessage] = useState(t.defaultMessage(quoteNumber, clientName, companyName));
  const [sending, setSending] = useState(false);
  const [signUrl, setSignUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);


  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setEmail(clientEmail || '');
      setSubject(t.defaultSubject(quoteNumber));
      setMessage(t.defaultMessage(quoteNumber, clientName, companyName));
      setSignUrl(null);
      setCopied(false);
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
      setCopied(false);
      onSent?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.error);
    } finally {
      setSending(false);
    }
  }

  async function handleCopyLink() {
    if (!signUrl) {
      return;
    }

    await navigator.clipboard.writeText(signUrl);
    setCopied(true);
  }

  const isResend = quoteStatus === 'sent' || Boolean(signUrl);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SendIcon className="size-4" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="send-quote-email">{t.emailLabel}</Label>
            <Input
              id="send-quote-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              disabled={sending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="send-quote-subject">{t.subjectLabel}</Label>
            <Input
              id="send-quote-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="send-quote-message">{t.messageLabel}</Label>
            <textarea
              id="send-quote-message"
              className="flex min-h-35 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
            />
          </div>

          {signUrl ? (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="mb-2 text-muted-foreground">{t.emailSentWithLink}</p>
              <p className="break-all text-foreground">{signUrl}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleCopyLink}>
                {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                {copied ? t.copied : t.copyLink}
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={handleSend} disabled={sending}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
