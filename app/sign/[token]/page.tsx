'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { useLocale } from '@/components/providers/locale-provider';
import SignatureCanvas from '@/components/sign/SignatureCanvas';
import { PriceDisplay } from '@/components/ui/PriceDisplay';

interface SignQuotePayload {
  state?: 'ready' | 'already_signed' | 'rejected';
  signedAt?: string | null;
  rejectionComment?: string | null;
  adminReplyMessage?: string | null;
  conversationMessages?: Array<{ role: 'admin' | 'client'; text: string; sentAt?: string }>;
  company?: {
    companyName: string;
    logoUrl: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    vatNumber?: string | null;
  };
  quoteNumber: string;
  date: string;
  clientSnapshot: {
    fullName: string;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  lineItems?: Array<{
    _id?: string;
    name: string;
    quantity: number;
    baseUnitPriceExcludingTax?: number;
    unitPriceExcludingTax: number;
    discountPercentage?: number;
    discountAmountExcludingTax?: number;
    vatRate?: number;
    totalExcludingTax: number;
    totalExcludingTaxBeforeDiscount?: number;
    vatAmount?: number;
    totalIncludingTax?: number;
  }>;
  totalExcludingTax: number;
  totalVat: number;
  totalIncludingTax: number;
  notes?: string | null;
}

type SignQuoteApiPayload = Partial<SignQuotePayload> & { error?: string; companyName?: string };

type SignError = 'not_found' | 'expired' | 'already_signed' | 'link_no_longer_valid' | 'unknown';

function DisclosureSection({
  title,
  description,
  openLabel,
  children,
}: {
  title: string;
  description: string;
  openLabel: string;
  children: ReactNode;
}) {
  return (
    <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl">
      <summary className="cursor-pointer list-none px-4 py-3.5 sm:px-5 sm:py-4 md:px-6 md:py-5">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-slate-950 sm:text-sm">{title}</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500 sm:mt-1 sm:text-sm sm:leading-6">{description}</p>
          </div>
          <span className="shrink-0 rounded-full border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:px-3 sm:py-1 sm:text-xs">
            {openLabel}
          </span>
        </div>
      </summary>
      <div className="border-t border-slate-200 px-4 py-4 sm:px-5 sm:py-5 md:px-6 md:py-6">{children}</div>
    </details>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2.5 last:border-b-0 last:pb-0 first:pt-0 sm:gap-4 sm:py-3">
      <span className="shrink-0 text-xs text-slate-500 sm:text-sm">{label}</span>
      <span className="min-w-0 break-all text-right text-xs font-medium text-slate-900 sm:text-sm">{value}</span>
    </div>
  );
}

const signMessages = {
  en: {
    open: 'Open',
    ourCompany: 'Our Company',
    thisCompany: 'this company',
    clientFallback: 'Client',
    loadingQuoteDetails: 'Loading quote details...',
    signatureRequired: 'Please provide your signature before submitting.',
    rejectSubmitFailed: 'Unable to submit your rejection. Please try again.',
    networkError: 'A network error occurred. Please try again.',
    errorUnableToContinue: 'Unable to continue',
    errorPageUnavailable: 'This signing page is not available',
    errorNotFound: 'This signing link is invalid or has been removed.',
    errorExpired: (companyName: string) => `This signing link has expired. Please contact ${companyName} for a new link.`,
    errorLinkInvalid: 'This link is no longer valid. Please request a new signing link.',
    errorUnknown: 'Something went wrong while loading this quote.',
    alreadySignedBadge: 'Already signed',
    alreadySignedTitle: 'This quote has already been signed',
    alreadySignedBody: (signerName: string, companyName: string, signedAtText: string | null) =>
      `No further action is needed, ${signerName}. ${companyName} already has this signed quote${signedAtText ? ` recorded on ${signedAtText}` : ''}.`,
    recordedReference: 'Recorded reference',
    quote: 'Quote',
    date: 'Date',
    totalInclTax: 'Total incl. tax',
    alreadySignedFallback: (companyName: string) =>
      `This signing link has already been completed. If you need a copy of the quote or confirmation details, contact ${companyName}.`,
    whatHappensNext: 'What happens next',
    alreadySignedNext1: (companyName: string) => `The quote remains marked as signed in ${companyName}'s system.`,
    alreadySignedNext2: 'No additional signature is required from you on this page.',
    alreadySignedNext3: 'You can close this page now and keep the original email for your records.',
    needHelp: 'Need help?',
    rejectionSubmittedBadge: 'Rejection submitted',
    rejectionSubmittedTitle: 'Quote rejected',
    rejectionSubmittedBody: (clientName: string, companyName: string) =>
      `Thank you, ${clientName}. ${companyName} has been notified and will be in touch with an updated quote.`,
    yourComment: 'Your comment',
    alreadyRejectedBadge: 'Quote rejected',
    alreadyRejectedTitle: 'This quote was rejected',
    alreadyRejectedBody: (clientName: string, companyName: string) =>
      `Thank you for your feedback, ${clientName}. ${companyName} has reviewed your rejection. See the response section below.`,
    yourRejectionComment: 'Your rejection comment',
    replyFromCompany: (companyName: string) => `Response from ${companyName}`,
    noReplyYet: (companyName: string) =>
      `${companyName} has not yet replied to your rejection. Please check back later or wait for their email.`,
    alreadyRejectedNext1: (companyName: string) => `${companyName} may send you a revised quote by email.`,
    alreadyRejectedNext2: 'You can close this page now and keep the original email for your records.',
    conversation: 'Conversation',
    adminMessage: (companyName: string) => `${companyName}`,
    clientMessageLabel: 'You',
    replyToVendor: (companyName: string) => `Reply to ${companyName}`,
    clientReplyPlaceholder: 'Write your reply here...',
    sendClientReply: 'Send reply',
    sendingClientReply: 'Sending...',
    clientReplySent: 'Your reply was sent',
    clientReplyFailed: 'Could not send reply. Please try again.',
    signatureCompletedBadge: 'Signature completed',
    signatureCompletedTitle: 'Quote signed successfully',
    signatureCompletedBody: (clientName: string, signedAtText: string | null) =>
      `Thank you, ${clientName}. Your signature has been recorded${signedAtText ? ` on ${signedAtText}` : ''} and this quote is now marked as signed.`,
    signedNext1: (companyName: string) => `The quote is now marked as signed in ${companyName}'s system.`,
    signedNext2: (companyName: string) => `${companyName} can continue with the next step on their side using the accepted quote.`,
    signedNext3: 'You can close this page now. Keep the original email if you need to refer to the quote again.',
    issuedBy: 'Issued by',
    secureSigningPage: 'Secure signing page',
    finalStep: 'Final step',
    reviewAndSignTitle: (quoteNumber: string) => `Review and sign quote ${quoteNumber}`,
    reviewAndSignDescription: 'Please check the essentials below, add your signature, and the quote will be recorded immediately.',
    issuedOn: 'Issued on',
    client: 'Client',
    beforeYouSign: 'Before you sign',
    beforeSignTitle1: 'Review the essentials',
    beforeSignBody1: 'The total, quote reference, and optional full breakdown are available below.',
    beforeSignTitle2: 'Add your signature',
    beforeSignBody2: 'Use your finger or mouse to sign. You can clear and redraw before you submit.',
    beforeSignTitle3: 'Get immediate confirmation',
    beforeSignBody3: 'As soon as you submit, the quote is marked as signed and the process is complete.',
    signThisQuote: 'Sign this quote',
    completeAgreement: 'Complete the agreement',
    drawSignatureHelp: 'Draw your signature below to confirm your agreement with this quote.',
    quoteTotal: 'Quote total',
    itemsCount: (count: number) => `${count} item${count === 1 ? '' : 's'}`,
    signature: 'Signature',
    signatureHelp: 'Use your finger or mouse to sign. You can clear and redraw before submitting.',
    signatureConsent: 'By submitting your signature, you confirm that you agree with this quote.',
    recordingSignature: 'Recording your signature...',
    signAndComplete: 'Sign and complete quote',
    addSignatureToContinue: 'Add your signature to continue',
    rejectQuoteAction: 'I want to reject this quote',
    rejectQuoteBadge: 'Reject quote',
    contestLabel: 'Reject',
    rejectQuoteTitle: 'Are you sure you want to reject this quote?',
    rejectQuoteDescription: (companyName: string) =>
      `${companyName} will be notified and can send you an updated version. You can optionally explain what you would like changed.`,
    rejectWarning: 'Once confirmed, this sign link is closed and cannot be used to sign this version later.',
    rejectAcknowledgement: 'I understand this will reject the quote now and I will need a new revised quote to continue.',
    commentOptional: 'Comment (optional)',
    commentPlaceholder: 'e.g. The price is too high, please revise line item 2...',
    cancel: 'Cancel',
    submitting: 'Submitting...',
    rejectQuoteConfirm: 'Reject quote',
    reviewFullQuoteDetails: 'Review full quote details',
    reviewFullQuoteDescription: 'Open this section if you want to inspect every line item before signing.',
    quantity: 'Quantity',
    qty: 'Qty',
    unitExclTax: 'Unit excl. tax',
    unitExcl: 'Unit excl.',
    discount: 'Discount',
    vat: 'VAT',
    lineTotal: 'Line total',
    description: 'Description',
    none: 'None',
    totalExclTax: 'Total excl. tax',
    notes: 'Notes',
    companyDetails: 'Company details',
    companyDetailsDescription: 'Contact information for the company issuing this quote.',
    clientDetails: 'Client details',
    clientDetailsDescription: 'The information currently recorded for this quote.',
    company: 'Company',
    name: 'Name',
    address: 'Address',
    phone: 'Phone',
    email: 'Email',
  },
  fr: {
    open: 'Ouvrir',
    ourCompany: 'Notre entreprise',
    thisCompany: 'cette entreprise',
    clientFallback: 'Client',
    loadingQuoteDetails: 'Chargement des d\u00e9tails du devis...',
    signatureRequired: 'Veuillez ajouter votre signature avant de valider.',
    rejectSubmitFailed: "Impossible d'envoyer votre refus. Veuillez r\u00e9essayer.",
    networkError: 'Une erreur r\u00e9seau est survenue. Veuillez r\u00e9essayer.',
    errorUnableToContinue: 'Impossible de continuer',
    errorPageUnavailable: "Cette page de signature n'est pas disponible",
    errorNotFound: 'Ce lien de signature est invalide ou a \u00e9t\u00e9 supprim\u00e9.',
    errorExpired: (companyName: string) => `Ce lien de signature a expir\u00e9. Veuillez contacter ${companyName} pour recevoir un nouveau lien.`,
    errorLinkInvalid: "Ce lien n'est plus valide. Veuillez demander un nouveau lien de signature.",
    errorUnknown: 'Une erreur est survenue lors du chargement de ce devis.',
    alreadySignedBadge: 'D\u00e9j\u00e0 sign\u00e9',
    alreadySignedTitle: 'Ce devis a d\u00e9j\u00e0 \u00e9t\u00e9 sign\u00e9',
    alreadySignedBody: (signerName: string, companyName: string, signedAtText: string | null) =>
      `Aucune autre action n'est n\u00e9cessaire, ${signerName}. ${companyName} dispose d\u00e9j\u00e0 de ce devis sign\u00e9${signedAtText ? ` enregistr\u00e9 le ${signedAtText}` : ''}.`,
    recordedReference: 'R\u00e9f\u00e9rence enregistr\u00e9e',
    quote: 'Devis',
    date: 'Date',
    totalInclTax: 'Total TTC',
    alreadySignedFallback: (companyName: string) =>
      `Ce lien de signature a d\u00e9j\u00e0 \u00e9t\u00e9 utilis\u00e9. Si vous avez besoin d'une copie du devis ou d'une confirmation, contactez ${companyName}.`,
    whatHappensNext: 'Prochaines \u00e9tapes',
    alreadySignedNext1: (companyName: string) => `Le devis reste marqu\u00e9 comme sign\u00e9 dans le syst\u00e8me de ${companyName}.`,
    alreadySignedNext2: "Aucune signature suppl\u00e9mentaire n'est requise de votre part sur cette page.",
    alreadySignedNext3: "Vous pouvez maintenant fermer cette page et conserver l'e-mail d'origine pour vos archives.",
    needHelp: "Besoin d'aide\u00a0?",
    rejectionSubmittedBadge: 'Refus envoy\u00e9',
    rejectionSubmittedTitle: 'Devis refus\u00e9',
    rejectionSubmittedBody: (clientName: string, companyName: string) =>
      `Merci, ${clientName}. ${companyName} a \u00e9t\u00e9 inform\u00e9 et reviendra vers vous avec un devis mis \u00e0 jour.`,
    yourComment: 'Votre commentaire',
    alreadyRejectedBadge: 'Devis refusé',
    alreadyRejectedTitle: 'Ce devis a été refusé',
    alreadyRejectedBody: (clientName: string, companyName: string) =>
      `Merci pour votre retour, ${clientName}. ${companyName} a examiné votre refus. Consultez la section réponse ci-dessous.`,
    yourRejectionComment: 'Votre commentaire de refus',
    replyFromCompany: (companyName: string) => `Réponse de ${companyName}`,
    noReplyYet: (companyName: string) =>
      `${companyName} n'a pas encore répondu à votre refus. Veuillez revenir ultérieurement ou attendre leur e-mail.`,
    alreadyRejectedNext1: (companyName: string) => `${companyName} pourra vous envoyer un devis révisé par e-mail.`,
    alreadyRejectedNext2: "Vous pouvez fermer cette page et conserver l'e-mail d'origine pour vos archives.",
    conversation: 'Conversation',
    adminMessage: (companyName: string) => `${companyName}`,
    clientMessageLabel: 'Vous',
    replyToVendor: (companyName: string) => `Répondre à ${companyName}`,
    clientReplyPlaceholder: 'Rédigez votre réponse ici...',
    sendClientReply: 'Envoyer la réponse',
    sendingClientReply: 'Envoi en cours...',
    clientReplySent: 'Votre réponse a été envoyée',
    clientReplyFailed: 'Impossible d’envoyer la réponse. Veuillez réessayer.',
    signatureCompletedBadge: 'Signature terminée',
    signatureCompletedTitle: 'Devis sign\u00e9 avec succ\u00e8s',
    signatureCompletedBody: (clientName: string, signedAtText: string | null) =>
      `Merci, ${clientName}. Votre signature a \u00e9t\u00e9 enregistr\u00e9e${signedAtText ? ` le ${signedAtText}` : ''} et ce devis est maintenant marqu\u00e9 comme sign\u00e9.`,
    signedNext1: (companyName: string) => `Le devis est maintenant marqu\u00e9 comme sign\u00e9 dans le syst\u00e8me de ${companyName}.`,
    signedNext2: (companyName: string) => `${companyName} peut maintenant poursuivre l'\u00e9tape suivante avec le devis accept\u00e9.`,
    signedNext3: "Vous pouvez fermer cette page maintenant. Conservez l'e-mail d'origine si vous devez consulter \u00e0 nouveau le devis.",
    issuedBy: '\u00c9mis par',
    secureSigningPage: 'Page de signature s\u00e9curis\u00e9e',
    finalStep: 'Derni\u00e8re \u00e9tape',
    reviewAndSignTitle: (quoteNumber: string) => `Consultez et signez le devis ${quoteNumber}`,
    reviewAndSignDescription: "Veuillez v\u00e9rifier les informations essentielles ci-dessous, ajouter votre signature, puis le devis sera enregistr\u00e9 imm\u00e9diatement.",
    issuedOn: '\u00c9mis le',
    client: 'Client',
    beforeYouSign: 'Avant de signer',
    beforeSignTitle1: "V\u00e9rifiez l'essentiel",
    beforeSignBody1: 'Le total, la r\u00e9f\u00e9rence du devis et le d\u00e9tail complet sont disponibles ci-dessous.',
    beforeSignTitle2: 'Ajoutez votre signature',
    beforeSignBody2: 'Utilisez votre doigt ou votre souris pour signer. Vous pouvez effacer et recommencer avant de valider.',
    beforeSignTitle3: 'Recevez une confirmation imm\u00e9diate',
    beforeSignBody3: "D\u00e8s que vous validez, le devis est marqu\u00e9 comme sign\u00e9 et le processus est termin\u00e9.",
    signThisQuote: 'Signer ce devis',
    completeAgreement: "Finaliser l'accord",
    drawSignatureHelp: 'Dessinez votre signature ci-dessous pour confirmer votre accord avec ce devis.',
    quoteTotal: 'Total du devis',
    itemsCount: (count: number) => `${count} article${count === 1 ? '' : 's'}`,
    signature: 'Signature',
    signatureHelp: 'Utilisez votre doigt ou votre souris pour signer. Vous pouvez effacer et recommencer avant validation.',
    signatureConsent: 'En envoyant votre signature, vous confirmez votre accord avec ce devis.',
    recordingSignature: 'Enregistrement de votre signature...',
    signAndComplete: 'Signer et finaliser le devis',
    addSignatureToContinue: 'Ajoutez votre signature pour continuer',
    rejectQuoteAction: 'Je souhaite refuser ce devis',
    rejectQuoteBadge: 'Refuser le devis',
    contestLabel: 'Refuser',
    rejectQuoteTitle: 'Voulez-vous vraiment refuser ce devis\u00a0?',
    rejectQuoteDescription: (companyName: string) =>
      `${companyName} sera inform\u00e9 et pourra vous envoyer une version mise \u00e0 jour. Vous pouvez expliquer en option ce que vous souhaitez modifier.`,
    rejectWarning: "Une fois confirm\u00e9, ce lien de signature sera ferm\u00e9 et ne pourra plus \u00eatre utilis\u00e9 pour signer cette version.",
    rejectAcknowledgement: "Je comprends que cela va refuser le devis maintenant et qu'un nouveau devis r\u00e9vis\u00e9 sera n\u00e9cessaire pour continuer.",
    commentOptional: 'Commentaire (optionnel)',
    commentPlaceholder: 'ex. Le prix est trop \u00e9lev\u00e9, merci de revoir la ligne 2...',
    cancel: 'Annuler',
    submitting: 'Envoi en cours...',
    rejectQuoteConfirm: 'Refuser le devis',
    reviewFullQuoteDetails: 'Voir le d\u00e9tail complet du devis',
    reviewFullQuoteDescription: 'Ouvrez cette section si vous souhaitez v\u00e9rifier chaque ligne avant de signer.',
    quantity: 'Quantit\u00e9',
    qty: 'Qt\u00e9',
    unitExclTax: 'Unitaire HT',
    unitExcl: 'Unitaire HT',
    discount: 'Remise',
    vat: 'TVA',
    lineTotal: 'Total ligne',
    description: 'Description',
    none: 'Aucune',
    totalExclTax: 'Total HT',
    notes: 'Notes',
    companyDetails: "D\u00e9tails de l'entreprise",
    companyDetailsDescription: "Coordonn\u00e9es de l'entreprise qui \u00e9met ce devis.",
    clientDetails: 'D\u00e9tails du client',
    clientDetailsDescription: 'Informations actuellement enregistr\u00e9es pour ce devis.',
    company: 'Entreprise',
    name: 'Nom',
    address: 'Adresse',
    phone: 'T\u00e9l\u00e9phone',
    email: 'E-mail',
  },
} as const;

export default function SignPage() {
  const { locale: appLocale } = useLocale();
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const localeKey = appLocale === 'fr' ? 'fr' : 'en';
  const t = signMessages[localeKey];

  const [quote, setQuote] = useState<SignQuotePayload | null>(null);
  const [error, setError] = useState<SignError | null>(null);
  const [errorCompanyName, setErrorCompanyName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [signed, setSigned] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [alreadyRejected, setAlreadyRejected] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [rejectionComment, setRejectionComment] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [confirmRejectIntent, setConfirmRejectIntent] = useState(false);
  const [clientReplyText, setClientReplyText] = useState('');
  const [isSendingClientReply, setIsSendingClientReply] = useState(false);
  const [conversationExpanded, setConversationExpanded] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('not_found');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadQuote = async () => {
      setIsLoading(true);
      setError(null);
      setAlreadySigned(false);
      setErrorCompanyName('');

      try {
        const response = await fetch(`/api/sign/${token}`, { cache: 'no-store' });
        const payload = (await response.json().catch(() => null)) as SignQuoteApiPayload | null;

        if (!response.ok) {
          const code = payload?.error;
          if (response.status === 404 || code === 'not_found') {
            throw new Error('not_found');
          }
          if (code === 'link_no_longer_valid') {
            if (payload?.companyName) {
              setErrorCompanyName(payload.companyName);
            }
            throw new Error('link_no_longer_valid');
          }
          if (response.status === 410 || code === 'expired') {
            if (payload?.companyName) {
              setErrorCompanyName(payload.companyName);
            }
            throw new Error('expired');
          }
          if (response.status === 409 || code === 'already_signed') {
            throw new Error('already_signed');
          }

          throw new Error('unknown');
        }

        if (!isMounted) {
          return;
        }

        setQuote(payload as SignQuotePayload);
        setConversationExpanded(false);

        if (payload?.state === 'already_signed') {
          setSignedAt(payload.signedAt ?? null);
          setAlreadySigned(true);
        }

        if (payload?.state === 'rejected') {
          setAlreadyRejected(true);
        }
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        const code = loadError instanceof Error ? loadError.message : 'unknown';
        if (code === 'not_found' || code === 'expired' || code === 'already_signed' || code === 'link_no_longer_valid') {
          setError(code);
          if (code === 'already_signed') {
            setAlreadySigned(true);
          }
        } else {
          setError('unknown');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadQuote();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const companyName = quote?.company?.companyName || t.ourCompany;
  const locale = appLocale === 'fr' ? 'fr-FR' : 'en-GB';

  const formattedDate = useMemo(() => {
    if (!quote?.date) {
      return '-';
    }

    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(quote.date));
  }, [locale, quote?.date]);

  const formattedSignedAt = useMemo(() => {
    if (!signedAt) {
      return null;
    }

    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(signedAt));
  }, [locale, signedAt]);

  const totalDiscount = useMemo(() => {
    if (!quote) {
      return 0;
    }

    return (quote.lineItems ?? []).reduce((sum, item) => sum + (item.discountAmountExcludingTax ?? 0), 0);
  }, [quote]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
      }),
    [locale],
  );

  const itemCount = quote?.lineItems?.length ?? 0;

  const handleSign = async () => {
    if (!signatureDataUrl || !token) {
      toast.error(t.signatureRequired);
      return;
    }

    setIsSigning(true);

    try {
      const response = await fetch(`/api/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureDataUrl }),
      });
      const payload = (await response.json().catch(() => null)) as SignQuoteApiPayload | null;

      if (response.ok) {
        setSignedAt(payload?.signedAt ?? new Date().toISOString());
        setAlreadySigned(false);
        setError(null);
        setSigned(true);
        return;
      }

      if (response.status === 404) {
        setError('not_found');
      } else if (response.status === 410) {
        if (payload?.companyName) {
          setErrorCompanyName(payload.companyName);
        }
        setError(payload?.error === 'link_no_longer_valid' ? 'link_no_longer_valid' : 'expired');
      } else if (response.status === 409) {
        if (payload?.quoteNumber) {
          setQuote(payload as SignQuotePayload);
        }
        setSignedAt(payload?.signedAt ?? new Date().toISOString());
        setAlreadySigned(true);
        setError('already_signed');
        return;
      } else {
        setError('unknown');
      }
    } finally {
      setIsSigning(false);
    }
  };

  const handleReject = async () => {
    if (!token || !confirmRejectIntent) return;
    setIsRejecting(true);
    try {
      const response = await fetch(`/api/sign/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: rejectionComment.trim() || null }),
      });
      if (response.ok || response.status === 409) {
        setShowRejectDialog(false);
        setRejected(true);
      } else {
        toast.error(t.rejectSubmitFailed);
      }
    } catch {
      toast.error(t.networkError);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleClientReply = async () => {
    const trimmed = clientReplyText.trim();
    if (!trimmed || !token) return;
    setIsSendingClientReply(true);
    try {
      const res = await fetch(`/api/sign/${token}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, locale: localeKey }),
      });
      const payload = (await res.json()) as {
        success?: boolean;
        error?: string;
        conversationMessages?: Array<{ role: 'admin' | 'client'; text: string; sentAt?: string }>;
      };
      if (!res.ok || !payload.success) throw new Error(payload.error);
      setQuote(prev =>
        prev
          ? {
              ...prev,
              conversationMessages: payload.conversationMessages ?? [
                ...(prev.conversationMessages ?? []),
                { role: 'client' as const, text: trimmed, sentAt: new Date().toISOString() },
              ],
            }
          : prev,
      );
      setClientReplyText('');
      toast.success(t.clientReplySent);
    } catch {
      toast.error(t.clientReplyFailed);
    } finally {
      setIsSendingClientReply(false);
    }
  };

  const renderError = () => {
    if (!error) {
      return null;
    }

    const text =
      error === 'not_found'
        ? t.errorNotFound
        : error === 'expired'
          ? t.errorExpired(errorCompanyName || t.thisCompany)
          : error === 'link_no_longer_valid'
            ? t.errorLinkInvalid
            : t.errorUnknown;

    return (
      <section className="overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-xl shadow-slate-950/5 sm:rounded-3xl">
        <div className="border-b border-rose-100 bg-rose-50 px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-700 sm:text-xs">{t.errorUnableToContinue}</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:mt-3 sm:text-2xl md:text-3xl">{t.errorPageUnavailable}</h1>
        </div>
        <div className="px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
          <p className="text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">{text}</p>
        </div>
      </section>
    );
  };

  const renderAlreadySigned = () => {
    const signerName = quote?.clientSnapshot.fullName || t.clientFallback;

    return (
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xl shadow-slate-950/5 sm:rounded-3xl">
        <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700 sm:text-xs">{t.alreadySignedBadge}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-emerald-950 sm:mt-3 sm:text-3xl md:text-4xl">{t.alreadySignedTitle}</h1>
          <p className="mt-2 text-xs leading-5 text-emerald-900/80 sm:mt-3 sm:text-sm sm:leading-6 md:text-base">
            {t.alreadySignedBody(signerName, companyName, formattedSignedAt)}
          </p>
        </div>

        <div className="grid gap-4 px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:grid-cols-[1fr_minmax(0,0.82fr)]">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:rounded-3xl sm:p-5 md:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">{t.recordedReference}</p>
            {quote ? (
              <div className="mt-3 grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-3 sm:mt-4 sm:gap-3">
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">{t.quote}</p>
                  <p className="mt-1 truncate text-base font-semibold text-slate-950 sm:mt-2 sm:text-lg">{quote.quoteNumber}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">{t.date}</p>
                  <p className="mt-1 text-base font-semibold text-slate-950 sm:mt-2 sm:text-lg">{formattedDate}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">{t.totalInclTax}</p>
                  <p className="mt-1 truncate text-base font-semibold text-slate-950 sm:mt-2 sm:text-lg">
                    <PriceDisplay cents={quote.totalIncludingTax} locale={locale} />
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs leading-5 text-slate-600 sm:mt-4 sm:text-sm sm:leading-6">
                {t.alreadySignedFallback(companyName)}
              </p>
            )}
          </div>

          <div className="min-w-0 space-y-3 sm:space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-3xl sm:p-5 md:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">{t.whatHappensNext}</p>
              <div className="mt-3 space-y-2.5 text-xs leading-5 text-slate-600 sm:mt-4 sm:space-y-3 sm:text-sm sm:leading-6">
                <p>{t.alreadySignedNext1(companyName)}</p>
                <p>{t.alreadySignedNext2}</p>
                <p>{t.alreadySignedNext3}</p>
              </div>
            </div>

            {quote?.company?.email || quote?.company?.phone ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-3xl sm:p-5 md:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">{t.needHelp}</p>
                <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                  {quote.company?.email ? <DetailRow label={t.email} value={quote.company.email} /> : null}
                  {quote.company?.phone ? <DetailRow label={t.phone} value={quote.company.phone} /> : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  };

  const renderAlreadyRejected = () => {
    const clientName = quote?.clientSnapshot?.fullName || t.clientFallback;
    const rejComment = quote?.rejectionComment;
    const messages = quote?.conversationMessages ?? [];

    // Determine if admin has ever replied (from thread or legacy field)
    const hasAdminReplied = messages.some(m => m.role === 'admin') || Boolean(quote?.adminReplyMessage);

    // Build display messages: use thread if populated, else fall back to legacy adminReplyMessage
    const displayMessages: Array<{ role: 'admin' | 'client'; text: string; sentAt?: string }> =
      messages.length > 0
        ? messages
        : quote?.adminReplyMessage
          ? [{ role: 'admin', text: quote.adminReplyMessage }]
          : [];

    return (
      <section className="overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-xl shadow-slate-950/5 sm:rounded-3xl">
        <div className="border-b border-orange-100 bg-orange-50 px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-700 sm:text-xs">{t.alreadyRejectedBadge}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-orange-950 sm:mt-3 sm:text-3xl md:text-4xl">{t.alreadyRejectedTitle}</h1>
          <p className="mt-2 text-xs leading-5 text-orange-900/80 sm:mt-3 sm:text-sm sm:leading-6 md:text-base">
            {t.alreadyRejectedBody(clientName, companyName)}
          </p>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
          {rejComment ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:rounded-3xl sm:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">{t.yourRejectionComment}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 sm:mt-3">{rejComment}</p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-3xl sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">{t.conversation}</p>
              {displayMessages.length > 2 ? (
                <button
                  type="button"
                  onClick={() => setConversationExpanded(v => !v)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:text-xs"
                >
                  {conversationExpanded
                    ? (localeKey === 'fr' ? 'Réduire' : 'Collapse')
                    : (localeKey === 'fr' ? `+${displayMessages.length - 2} message${displayMessages.length - 2 > 1 ? 's' : ''}` : `+${displayMessages.length - 2} older`)}
                  <svg
                    className={`size-3 transition-transform duration-200 ${conversationExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              ) : null}
            </div>
            {displayMessages.length > 0 ? (
              <div className="mt-3 space-y-2.5">
                {/* Collapsed older messages */}
                {displayMessages.length > 2 && !conversationExpanded ? (
                  <button
                    type="button"
                    onClick={() => setConversationExpanded(true)}
                    className="w-full rounded-xl border border-dashed border-slate-200 py-2.5 text-center text-xs text-slate-400 hover:border-slate-300 hover:text-slate-600"
                  >
                        {localeKey === 'fr'
                      ? `Voir ${displayMessages.length - 2} message${displayMessages.length - 2 > 1 ? 's' : ''} précédent${displayMessages.length - 2 > 1 ? 's' : ''}`
                      : `View ${displayMessages.length - 2} earlier message${displayMessages.length - 2 > 1 ? 's' : ''}`}
                  </button>
                ) : null}
                {/* Older messages (shown when expanded) */}
                {conversationExpanded
                  ? displayMessages.slice(0, -2).map((msg, i) => (
                      <div
                        key={`old-${i}`}
                        className={
                          msg.role === 'admin'
                            ? 'rounded-xl border border-orange-100 bg-orange-50 p-3 sm:p-4'
                            : 'rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4'
                        }
                      >
                        <p className={`text-[10px] font-semibold uppercase tracking-[0.15em] sm:text-[11px] ${msg.role === 'admin' ? 'text-orange-600' : 'text-slate-500'}`}>
                          {msg.role === 'admin' ? t.adminMessage(companyName) : t.clientMessageLabel}
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-800">{msg.text}</p>
                        {msg.sentAt ? <p className="mt-1 text-[10px] text-slate-400">{new Date(msg.sentAt).toLocaleString(locale)}</p> : null}
                      </div>
                    ))
                  : null}
                {/* Always-visible latest 2 messages */}
                {displayMessages.slice(-2).map((msg, i) => (
                  <div
                    key={`latest-${i}`}
                    className={
                      msg.role === 'admin'
                        ? 'rounded-xl border border-orange-100 bg-orange-50 p-3 sm:p-4'
                        : 'rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4'
                    }
                  >
                    <p className={`text-[10px] font-semibold uppercase tracking-[0.15em] sm:text-[11px] ${msg.role === 'admin' ? 'text-orange-600' : 'text-slate-500'}`}>
                      {msg.role === 'admin' ? t.adminMessage(companyName) : t.clientMessageLabel}
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-800">{msg.text}</p>
                    {msg.sentAt ? <p className="mt-1 text-[10px] text-slate-400">{new Date(msg.sentAt).toLocaleString(locale)}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm leading-6 text-slate-400 sm:mt-3">{t.noReplyYet(companyName)}</p>
            )}
          </div>

          {hasAdminReplied ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:rounded-3xl sm:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">{t.replyToVendor(companyName)}</p>
              <div className="mt-3 space-y-3">
                <textarea
                  value={clientReplyText}
                  onChange={e => setClientReplyText(e.target.value)}
                  placeholder={t.clientReplyPlaceholder}
                  maxLength={2000}
                  rows={4}
                  disabled={isSendingClientReply}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 placeholder:text-slate-400 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-60 sm:px-4 sm:py-3"
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] text-slate-400 sm:text-xs">{clientReplyText.length}/2000</span>
                  <button
                    onClick={handleClientReply}
                    disabled={isSendingClientReply || !clientReplyText.trim()}
                    className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1 disabled:opacity-50 sm:px-5 sm:py-2.5 sm:text-sm"
                  >
                    {isSendingClientReply ? t.sendingClientReply : t.sendClientReply}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:rounded-3xl sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">{t.whatHappensNext}</p>
            <div className="mt-3 space-y-2 text-xs leading-5 text-slate-600 sm:mt-4 sm:space-y-3 sm:text-sm sm:leading-6">
              <p>{t.alreadyRejectedNext1(companyName)}</p>
              <p>{t.alreadyRejectedNext2}</p>
            </div>
          </div>

          {quote?.company?.email || quote?.company?.phone ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-3xl sm:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">{t.needHelp}</p>
              <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                {quote.company?.email ? <DetailRow label={t.email} value={quote.company.email} /> : null}
                {quote.company?.phone ? <DetailRow label={t.phone} value={quote.company.phone} /> : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    );
  };

  const isAlreadySignedState = alreadySigned || error === 'already_signed';

  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-3 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:px-4 sm:py-6 md:px-6 md:py-8 lg:py-10">
      <div className="mx-auto w-full max-w-5xl">
        {isLoading ? (
          <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center shadow-xl shadow-slate-950/5 sm:rounded-3xl sm:px-6 sm:py-12">
            <Loader2Icon className="size-5 animate-spin text-slate-500 sm:size-6" />
            <p className="text-xs text-slate-600 sm:text-sm">{t.loadingQuoteDetails}</p>
          </div>
        ) : isAlreadySignedState ? (
          renderAlreadySigned()
        ) : error ? (
          renderError()
        ) : alreadyRejected ? (
          renderAlreadyRejected()
        ) : rejected ? (
          <section className="overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-xl shadow-slate-950/5 sm:rounded-3xl">
            <div className="border-b border-orange-100 bg-orange-50 px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-700 sm:text-xs">{t.rejectionSubmittedBadge}</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-orange-950 sm:mt-3 sm:text-3xl md:text-4xl">{t.rejectionSubmittedTitle}</h1>
              <p className="mt-2 text-xs leading-5 text-orange-900/80 sm:mt-3 sm:text-sm sm:leading-6 md:text-base">
                {t.rejectionSubmittedBody(quote?.clientSnapshot.fullName || t.clientFallback, companyName)}
              </p>
            </div>
            <div className="px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
              {rejectionComment.trim() ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:rounded-3xl sm:p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">{t.yourComment}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700 sm:mt-3">{rejectionComment.trim()}</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : signed ? (
         
          <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xl shadow-slate-950/5 sm:rounded-3xl">
            <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700 sm:text-xs">{t.signatureCompletedBadge}</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-emerald-950 sm:mt-3 sm:text-3xl md:text-4xl">{t.signatureCompletedTitle}</h1>
              <p className="mt-2 text-xs leading-5 text-emerald-900/80 sm:mt-3 sm:text-sm sm:leading-6 md:text-base">
                {t.signatureCompletedBody(quote?.clientSnapshot.fullName || t.clientFallback, formattedSignedAt)}
              </p>
            </div>

            <div className="grid gap-4 px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:grid-cols-[1fr_minmax(0,0.82fr)]">
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:rounded-3xl sm:p-5 md:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">{t.recordedReference}</p>
                <div className="mt-3 grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-3 sm:mt-4 sm:gap-3">
                  <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">{t.quote}</p>
                    <p className="mt-1 truncate text-base font-semibold text-slate-950 sm:mt-2 sm:text-lg">{quote?.quoteNumber}</p>
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">{t.date}</p>
                    <p className="mt-1 text-base font-semibold text-slate-950 sm:mt-2 sm:text-lg">{formattedDate}</p>
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">{t.totalInclTax}</p>
                    <p className="mt-1 truncate text-base font-semibold text-slate-950 sm:mt-2 sm:text-lg">
                      <PriceDisplay cents={quote?.totalIncludingTax ?? 0} locale={locale} />
                    </p>
                  </div>
                </div>
              </div>

              <div className="min-w-0 space-y-3 sm:space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-3xl sm:p-5 md:p-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">{t.whatHappensNext}</p>
                  <div className="mt-3 space-y-2.5 text-xs leading-5 text-slate-600 sm:mt-4 sm:space-y-3 sm:text-sm sm:leading-6">
                    <p>{t.signedNext1(companyName)}</p>
                    <p>{t.signedNext2(companyName)}</p>
                    <p>{t.signedNext3}</p>
                  </div>
                </div>

                {quote?.company?.email || quote?.company?.phone ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-3xl sm:p-5 md:p-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">{t.needHelp}</p>
                    <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                      {quote.company?.email ? <DetailRow label={t.email} value={quote.company.email} /> : null}
                      {quote.company?.phone ? <DetailRow label={t.phone} value={quote.company.phone} /> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : quote ? (
         
          <div className="space-y-4 sm:space-y-5">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-950/5 sm:rounded-3xl">
              <header className="border-b border-slate-200 px-4 py-3.5 sm:px-6 sm:py-4 md:px-8 md:py-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                    {quote.company?.logoUrl ? (
                      <Image
                        src={quote.company.logoUrl}
                        alt={companyName}
                        width={128}
                        height={48}
                        className="h-9 w-auto shrink-0 object-contain sm:h-11"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">{t.issuedBy}</p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-slate-950 sm:mt-1 sm:text-base">{companyName}</p>
                    </div>
                  </div>
                  <div className="inline-flex shrink-0 self-start rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 sm:self-auto sm:px-3 sm:py-1 sm:text-xs">
                    {t.secureSigningPage}
                  </div>
                </div>
              </header>

              <div className="grid gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:grid-cols-[1fr_minmax(0,0.75fr)] lg:items-start">

                <section className="min-w-0 space-y-4 sm:space-y-5">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="inline-flex rounded-full bg-slate-950 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white sm:px-3 sm:py-1 sm:text-xs">
                      {t.finalStep}
                    </div>
                    <div className="min-w-0">
                      <h1 className="wrap-break-word text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl md:text-3xl lg:text-4xl">
                        {t.reviewAndSignTitle(quote.quoteNumber)}
                      </h1>
                      <p className="mt-2 text-xs leading-5 text-slate-600 sm:mt-3 sm:text-sm sm:leading-6 md:text-base">
                        {t.reviewAndSignDescription}
                      </p>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-3 sm:gap-3">
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:rounded-2xl sm:p-4">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">{t.totalInclTax}</p>
                      <p className="mt-1 truncate text-lg font-semibold text-slate-950 sm:mt-2 sm:text-xl">
                        <PriceDisplay cents={quote.totalIncludingTax} locale={locale} />
                      </p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:rounded-2xl sm:p-4">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">{t.issuedOn}</p>
                      <p className="mt-1 truncate text-lg font-semibold text-slate-950 sm:mt-2 sm:text-xl">{formattedDate}</p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:rounded-2xl sm:p-4">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">{t.client}</p>
                      <p className="mt-1 truncate text-lg font-semibold text-slate-950 sm:mt-2 sm:text-xl">{quote.clientSnapshot.companyName || quote.clientSnapshot.fullName}</p>
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:rounded-3xl sm:p-4 md:p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">{t.beforeYouSign}</p>
                    <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
                      <div className="flex gap-2.5 rounded-xl border border-slate-200 bg-white p-3 sm:gap-3 sm:rounded-2xl sm:p-4">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[10px] font-semibold text-white sm:h-8 sm:w-8 sm:text-xs">1</div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-950 sm:text-sm">{t.beforeSignTitle1}</p>
                          <p className="mt-0.5 text-xs leading-5 text-slate-600 sm:mt-1 sm:text-sm sm:leading-6">{t.beforeSignBody1}</p>
                        </div>
                      </div>
                      <div className="flex gap-2.5 rounded-xl border border-slate-200 bg-white p-3 sm:gap-3 sm:rounded-2xl sm:p-4">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[10px] font-semibold text-white sm:h-8 sm:w-8 sm:text-xs">2</div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-950 sm:text-sm">{t.beforeSignTitle2}</p>
                          <p className="mt-0.5 text-xs leading-5 text-slate-600 sm:mt-1 sm:text-sm sm:leading-6">{t.beforeSignBody2}</p>
                        </div>
                      </div>
                      <div className="flex gap-2.5 rounded-xl border border-slate-200 bg-white p-3 sm:gap-3 sm:rounded-2xl sm:p-4">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[10px] font-semibold text-white sm:h-8 sm:w-8 sm:text-xs">3</div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-950 sm:text-sm">{t.beforeSignTitle3}</p>
                          <p className="mt-0.5 text-xs leading-5 text-slate-600 sm:mt-1 sm:text-sm sm:leading-6">{t.beforeSignBody3}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="min-w-0 lg:sticky lg:top-6">
                  <div className="overflow-hidden rounded-2xl bg-slate-950 p-4 text-white shadow-xl shadow-slate-950/15 sm:rounded-3xl sm:p-5 md:p-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 sm:text-xs">{t.signThisQuote}</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight sm:mt-3 sm:text-2xl">{t.completeAgreement}</h2>
                    <p className="mt-2 text-xs leading-5 text-slate-300 sm:mt-3 sm:text-sm sm:leading-6">
                      {t.drawSignatureHelp}
                    </p>

                    <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-3 sm:mt-5 sm:rounded-2xl sm:p-4">
                      <div className="flex items-center justify-between gap-2 sm:gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 sm:text-xs">{t.quoteTotal}</p>
                          <p className="mt-1 truncate text-xl font-semibold text-white sm:mt-2 sm:text-2xl">
                            <PriceDisplay cents={quote.totalIncludingTax} locale={locale} className="text-white" />
                          </p>
                        </div>
                        <div className="shrink-0 rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-200 sm:px-3 sm:py-1 sm:text-xs">
                          {t.itemsCount(itemCount)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-2xl bg-white p-3 text-slate-950 sm:mt-5 sm:rounded-3xl sm:p-4 md:p-5">
                      <p className="text-[13px] font-semibold text-slate-950 sm:text-sm">{t.signature}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-600 sm:mt-1 sm:text-sm sm:leading-6">
                        {t.signatureHelp}
                      </p>
                      <div className="mt-3 sm:mt-4">
                        <SignatureCanvas onSignatureChange={setSignatureDataUrl} />
                      </div>
                    </div>

                    <p className="mt-3 text-[10px] leading-4 text-slate-400 sm:mt-4 sm:text-xs sm:leading-5">
                      {t.signatureConsent}
                    </p>

                    <div className="mt-4 flex flex-col gap-2.5 sm:mt-5 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleSign}
                      disabled={isSigning || !signatureDataUrl}
                      className="h-11 w-full rounded-xl bg-white px-4 text-[13px] font-semibold text-slate-950 transition active:scale-[0.98] hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-white sm:h-12 sm:flex-1 sm:rounded-2xl sm:text-sm"
                    >
                      {isSigning
                        ? t.recordingSignature
                        : signatureDataUrl
                          ? t.signAndComplete
                          : t.addSignatureToContinue}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setConfirmRejectIntent(false);
                        setShowRejectDialog(true);
                      }}
                      disabled={isSigning}
                      className="h-11 w-full rounded-xl bg-red-600 px-4 text-[13px] font-semibold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-auto sm:rounded-2xl sm:px-5 sm:text-sm"
                    >
                      {t.contestLabel}
                    </button>
                    </div>
                  </div>
                </section>
              </div>
            </section>

            {/* Rejection dialog */}
            {showRejectDialog ? (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 sm:p-6" onClick={() => setShowRejectDialog(false)}>
                <div className="flex min-h-full items-start justify-center pt-6 sm:items-center sm:pt-0">
                  <div
                    className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-3xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="border-b border-slate-200 px-5 py-4 sm:px-6 sm:py-5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-600 sm:text-xs">{t.rejectQuoteBadge}</p>
                      <h2 className="mt-1 text-base font-semibold text-slate-950 sm:mt-2 sm:text-lg">{t.rejectQuoteTitle}</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-600 sm:mt-2 sm:text-sm sm:leading-6">
                        {t.rejectQuoteDescription(companyName)}
                      </p>
                    </div>

                    <div className="max-h-[min(62dvh,520px)] space-y-3 overflow-y-auto px-5 py-4 sm:space-y-4 sm:px-6 sm:py-5">
                      <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-5 text-red-900 sm:rounded-2xl sm:px-4 sm:py-3.5 sm:text-sm">
                        {t.rejectWarning}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs" htmlFor="rejection-comment">
                          {t.commentOptional}
                        </label>
                        <textarea
                          id="rejection-comment"
                          rows={4}
                          maxLength={1000}
                          value={rejectionComment}
                          onChange={(e) => setRejectionComment(e.target.value)}
                          placeholder={t.commentPlaceholder}
                          className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none sm:rounded-2xl sm:px-4 sm:py-3"
                        />
                        <p className="mt-1 text-right text-[10px] text-slate-400 sm:text-xs">{rejectionComment.length}/1000</p>
                      </div>

                      <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
                        <input
                          type="checkbox"
                          checked={confirmRejectIntent}
                          onChange={(e) => setConfirmRejectIntent(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-xs leading-5 text-slate-700 sm:text-sm sm:leading-6">
                          {t.rejectAcknowledgement}
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:flex-row sm:gap-3 sm:px-6 sm:py-5">
                      <button
                        type="button"
                        onClick={() => {
                          setShowRejectDialog(false);
                          setConfirmRejectIntent(false);
                        }}
                        disabled={isRejecting}
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:h-11 sm:flex-1 sm:rounded-2xl sm:text-sm"
                      >
                        {t.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={isRejecting || !confirmRejectIntent}
                        className="h-11 w-full rounded-xl bg-red-600 px-4 text-[13px] font-semibold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:h-11 sm:flex-1 sm:rounded-2xl sm:text-sm"
                      >
                        {isRejecting ? t.submitting : t.rejectQuoteConfirm}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1fr_minmax(0,0.67fr)]">
              <DisclosureSection
                title={t.reviewFullQuoteDetails}
                description={t.reviewFullQuoteDescription}
                openLabel={t.open}
              >
                <div className="space-y-3 md:hidden">
                  {(quote.lineItems ?? []).map((item, index) => {
                    const discountPct = item.discountPercentage ?? 0;
                    const discountAmount = item.discountAmountExcludingTax ?? 0;
                    const vatRate = item.vatRate ?? 0;
                    const lineTotal = item.totalIncludingTax ?? item.totalExcludingTax;
                    const discountLabel =
                      discountPct > 0 || discountAmount > 0
                        ? `${discountPct.toFixed(2)}%${discountAmount > 0 ? ` (-${currencyFormatter.format(discountAmount / 100)})` : ''}`
                        : t.none;

                    return (
                      <article key={item._id ?? `${item.name}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:rounded-2xl sm:p-4">
                        <p className="wrap-break-word text-[13px] font-semibold text-slate-950 sm:text-sm">{item.name}</p>
                        <div className="mt-2.5 space-y-1.5 sm:mt-3 sm:space-y-2">
                          <DetailRow label={t.quantity} value={item.quantity} />
                          <DetailRow label={t.unitExclTax} value={<PriceDisplay cents={item.unitPriceExcludingTax} locale={locale} />} />
                          <DetailRow label={t.discount} value={discountLabel} />
                          <DetailRow label={t.vat} value={`${vatRate}%`} />
                          <DetailRow label={t.lineTotal} value={<PriceDisplay cents={lineTotal} locale={locale} />} />
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <th className="rounded-l-xl px-4 py-3">{t.description}</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right">{t.qty}</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right">{t.unitExcl}</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right">{t.discount}</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right">{t.vat}</th>
                        <th className="whitespace-nowrap rounded-r-xl px-4 py-3 text-right">{t.lineTotal}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(quote.lineItems ?? []).map((item, index) => {
                        const discountPct = item.discountPercentage ?? 0;
                        const discountAmount = item.discountAmountExcludingTax ?? 0;
                        const vatRate = item.vatRate ?? 0;
                        const lineTotal = item.totalIncludingTax ?? item.totalExcludingTax;

                        return (
                          <tr key={item._id ?? `${item.name}-${index}`} className="border-b border-slate-200 last:border-b-0">
                            <td className="max-w-50 wrap-break-word px-4 py-3 text-slate-950">{item.name}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">{item.quantity}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                              <PriceDisplay cents={item.unitPriceExcludingTax} locale={locale} />
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                              {discountPct > 0 || discountAmount > 0
                                ? `${discountPct.toFixed(2)}%${discountAmount > 0 ? ` (-${currencyFormatter.format(discountAmount / 100)})` : ''}`
                                : t.none}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">{vatRate}%</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-950">
                              <PriceDisplay cents={lineTotal} locale={locale} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totals summary */}
                <div className="mt-4 grid gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:mt-5 sm:gap-3 sm:rounded-2xl sm:p-4 md:ml-auto md:max-w-sm">
                  <div className="flex items-center justify-between text-xs text-slate-600 sm:text-sm">
                    <span>{t.totalExclTax}</span>
                    <PriceDisplay cents={quote.totalExcludingTax} locale={locale} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600 sm:text-sm">
                    <span>{t.discount}</span>
                    <span>- <PriceDisplay cents={totalDiscount} locale={locale} /></span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600 sm:text-sm">
                    <span>{t.vat}</span>
                    <PriceDisplay cents={quote.totalVat} locale={locale} />
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-300 pt-2.5 text-sm font-semibold text-slate-950 sm:pt-3 sm:text-base">
                    <span>{t.totalInclTax}</span>
                    <PriceDisplay cents={quote.totalIncludingTax} locale={locale} />
                  </div>
                </div>

                {quote.notes ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 sm:mt-5 sm:rounded-2xl sm:p-4 md:p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">{t.notes}</p>
                    <p className="mt-2 whitespace-pre-wrap wrap-break-word text-xs leading-5 text-slate-600 sm:mt-3 sm:text-sm sm:leading-6">{quote.notes}</p>
                  </div>
                ) : null}
              </DisclosureSection>

              <div className="min-w-0 space-y-3 sm:space-y-4">
                <DisclosureSection
                  title={t.companyDetails}
                  description={t.companyDetailsDescription}
                  openLabel={t.open}
                >
                  <div className="space-y-1">
                    <DetailRow label={t.company} value={companyName} />
                    {quote.company?.address ? <DetailRow label={t.address} value={quote.company.address} /> : null}
                    {quote.company?.phone ? <DetailRow label={t.phone} value={quote.company.phone} /> : null}
                    {quote.company?.email ? <DetailRow label={t.email} value={quote.company.email} /> : null}
                    {quote.company?.vatNumber ? <DetailRow label={t.vat} value={quote.company.vatNumber} /> : null}
                  </div>
                </DisclosureSection>

                <DisclosureSection
                  title={t.clientDetails}
                  description={t.clientDetailsDescription}
                  openLabel={t.open}
                >
                  <div className="space-y-1">
                    <DetailRow label={t.name} value={quote.clientSnapshot.fullName} />
                    {quote.clientSnapshot.companyName ? <DetailRow label={t.company} value={quote.clientSnapshot.companyName} /> : null}
                    {quote.clientSnapshot.phone ? <DetailRow label={t.phone} value={quote.clientSnapshot.phone} /> : null}
                    {quote.clientSnapshot.email ? <DetailRow label={t.email} value={quote.clientSnapshot.email} /> : null}
                    {quote.clientSnapshot.address ? <DetailRow label={t.address} value={quote.clientSnapshot.address} /> : null}
                  </div>
                </DisclosureSection>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}