"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowRight, Loader2, ArrowLeft, Check, LayoutDashboard, BadgeCheck, BuildingIcon, UploadIcon, CheckCircle2Icon, ImageIcon } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

import { LanguageThemeToggle } from "@/components/language-theme-toggle"
import FirstVisitGuide from "@/components/onboarding/first-visit-guide"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { WorldMapBg } from "@/components/ui/WorldMapBg"
import { translate } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"

const ONBOARDING_DRAFT_KEY = "onboarding_company_profile_draft"
const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
const MAX_LOGO_SIZE = 5 * 1024 * 1024

const onboardingMessages = {
  en: {
    phase: "Onboarding — Step 1 of 2",
    panelLine1: "Configure",
    panelHighlight: "Your Business",
    panelLine2: "Profile.",
    panelDesc: "Set up your company credentials once. Everything from client records to supplier contracts and official documents will reference this profile.",
    heading: "Setup your identity",
    subtitle:
      "Welcome to the executive suite. To provide you with a tailored management experience, please confirm your company's core credentials.",
    companyName: "Company Name",
    ownerName: "Owner Name",
    businessEmail: "Business Email",
    phone: "Phone Number",
    vatNumber: "VAT Number",
    rcsNumber: "RCS Number",
    businessAuthorizationNumber: "Business authorization number",
    matriculeNumber: "Matricule number",
    iban: "IBAN",
    bankName: "Bank name",
    legalIdentifier: "Additional legal identifier",
    hqAddress: "HQ Address",
    hqHint: "Include building and floor numbers for document accuracy.",
    agreementBody:
      "By completing this setup, you acknowledge that the data provided will be used for official document generation and internal reporting.",
    agreementHint: "Agreement is required to initialize the executive protocol.",
    saveDraft: "Save draft & Exit",
    completeSetup: "Complete Setup",
    toastDraftSaved: "Draft saved successfully",
    toastDraftFailed: "Unable to save draft. Please try again.",
    toastAgreementRequired: "You must agree to the terms to complete the setup.",
    toastOnboardingSuccess: "Onboarding completed successfully",
    toastOnboardingError: "Error completing onboarding. Please try again.",
    // Step 2 – logo
    step2Phase: "Onboarding — Step 2 of 2",
    step2PanelHighlight: "Brand Identity",
    step2PanelLine2: "Your Logo.",
    step2PanelDesc: "Your logo appears on all generated documents — quotes, invoices, and client-facing exports.",
    step2Heading: "Upload your company logo",
    step2Subtitle: "Optional but recommended. JPEG, PNG, WebP or SVG — max 5 MB. You can always change it later in Settings.",
    step2Upload: "Choose logo file",
    step2Replace: "Replace logo",
    step2Skip: "Skip for now",
    step2Finish: "Finish setup",
    step2Uploading: "Uploading...",
    step2Finishing: "Finishing...",
    step2UploadFailed: "Failed to upload logo",
    step2TypeError: "Invalid file type. Accepted: JPEG, PNG, WebP, SVG",
    step2SizeError: "File too large. Maximum size is 5 MB",
  },
  fr: {
    phase: "Onboarding \u2014 \u00c9tape 1 sur 2",
    panelLine1: "Configurez",
    panelHighlight: "Votre Profil",
    panelLine2: "Entreprise.",
    panelDesc: "Renseignez vos informations d'entreprise une seule fois. Fiches clients, contrats fournisseurs et documents officiels s'appuieront sur ce profil.",
    heading: "Configurez votre identit\u00e9",
    subtitle:
      "Bienvenue dans la suite executive. Pour vous offrir une exp\u00e9rience de gestion personnalis\u00e9e, veuillez confirmer les informations principales de votre entreprise.",
    companyName: "Nom de l'entreprise",
    ownerName: "Nom du propri\u00e9taire",
    businessEmail: "E-mail professionnel",
    phone: "Num\u00e9ro de t\u00e9l\u00e9phone",
    vatNumber: "Num\u00e9ro de TVA",
    rcsNumber: "Num\u00e9ro RCS",
    businessAuthorizationNumber: "Num\u00e9ro d'autorisation d'\u00e9tablissement",
    matriculeNumber: "Num\u00e9ro matricule",
    iban: "IBAN",
    bankName: "Banque",
    legalIdentifier: "Identifiant l\u00e9gal suppl\u00e9mentaire",
    hqAddress: "Adresse du si\u00e8ge",
    hqHint: "Incluez le b\u00e2timent et l'\u00e9tage pour une meilleure pr\u00e9cision documentaire.",
    agreementBody:
      "En finalisant cette configuration, vous reconnaissez que les donn\u00e9es fournies seront utilis\u00e9es pour la g\u00e9n\u00e9ration de documents officiels et les rapports internes.",
    agreementHint: "L'accord est requis pour initialiser le protocole executive.",
    saveDraft: "Enregistrer le brouillon et quitter",
    completeSetup: "Terminer la configuration",
    toastDraftSaved: "Brouillon enregistr\u00e9 avec succ\u00e8s",
    toastDraftFailed: "Impossible d'enregistrer le brouillon. Veuillez r\u00e9essayer.",
    toastAgreementRequired: "Vous devez accepter les conditions pour finaliser la configuration.",
    toastOnboardingSuccess: "Configuration termin\u00e9e avec succ\u00e8s",
    toastOnboardingError: "Erreur lors de la finalisation de la configuration. Veuillez r\u00e9essayer.",

    step2Phase: "Onboarding \u2014 \u00c9tape 2 sur 2",
    step2PanelHighlight: "Identit\u00e9 Visuelle",
    step2PanelLine2: "Votre Logo.",
    step2PanelDesc: "Votre logo appara\u00eet sur tous les documents g\u00e9n\u00e9r\u00e9s\u00a0: devis, factures et exports clients.",
    step2Heading: "Ajoutez le logo de votre entreprise",
    step2Subtitle: "Optionnel mais recommand\u00e9. JPEG, PNG, WebP ou SVG \u2014 max 5 Mo. Vous pourrez le modifier plus tard dans les Param\u00e8tres.",
    step2Upload: "Choisir un fichier logo",
    step2Replace: "Remplacer le logo",
    step2Skip: "Ignorer pour l'instant",
    step2Finish: "Terminer la configuration",
    step2Uploading: "T\u00e9l\u00e9chargement...",
    step2Finishing: "Finalisation...",
    step2UploadFailed: "\u00c9chec du t\u00e9l\u00e9chargement du logo",
    step2TypeError: "Type de fichier invalide. Accept\u00e9s\u00a0: JPEG, PNG, WebP, SVG",
    step2SizeError: "Fichier trop volumineux. Taille maximale\u00a0: 5 Mo",
  },
} as const

export default function IdentitySetupPage() {
  const router = useRouter()
  const { locale } = useLocale()
  const t = onboardingMessages[locale]

  const [isLoading, setIsLoading] = useState(false)
  const [isAgreed, setIsAgreed] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    companyName: "",
    ownerName: "",
    businessEmail: "",
    phone: "",
    vatNumber: "",
    rcsNumber: "",
    businessAuthorizationNumber: "",
    matriculeNumber: "",
    iban: "",
    bankName: "",
    legalIdentifier: "",
    address: "",
  })

  const loadDraftFromLocalStorage = () => {
    try {
      const rawDraft = localStorage.getItem(ONBOARDING_DRAFT_KEY)
      if (!rawDraft) {
        return
      }

      const parsedDraft = JSON.parse(rawDraft)
      setFormData((prev) => ({
        ...prev,
        ...parsedDraft,
      }))
    } catch {
      localStorage.removeItem(ONBOARDING_DRAFT_KEY)
    }
  }

  useEffect(() => {
    loadDraftFromLocalStorage()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function prefillIdentity() {
      try {
        const response = await fetch("/api/me?fch=1", { cache: "no-store" })
        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as {
          success?: boolean
          user?: { name?: string; email?: string }
        }

        if (cancelled || !payload.success || !payload.user) {
          return
        }

        setFormData((prev) => ({
          ...prev,
          ownerName: prev.ownerName.trim() ? prev.ownerName : (payload.user?.name ?? ""),
          businessEmail: prev.businessEmail.trim() ? prev.businessEmail : (payload.user?.email ?? ""),
        }))
      } catch {
        // Silent fallback: onboarding form remains manually editable.
      }
    }

    void prefillIdentity()

    return () => {
      cancelled = true
    }
  }, [])

  const handleSaveDraft = () => {
    try {
      localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(formData))
      toast.success(t.toastDraftSaved)
      router.push("/logout")
    } catch {
      toast.error(t.toastDraftFailed)
    }
  }

  const handleComplete = async () => {
    if (!isAgreed) {
      toast.error(t.toastAgreementRequired)
      return
    }

    setIsLoading(true)
    try {
      const payload = {
        companyName: formData.companyName.trim(),
        ownerName: formData.ownerName.trim(),
        businessEmail: formData.businessEmail.trim(),
        phone: formData.phone.trim(),
        vatNumber: formData.vatNumber.trim(),
        rcsNumber: formData.rcsNumber.trim(),
        businessAuthorizationNumber: formData.businessAuthorizationNumber.trim(),
        matriculeNumber: formData.matriculeNumber.trim(),
        iban: formData.iban.trim(),
        bankName: formData.bankName.trim(),
        legalIdentifier: formData.legalIdentifier.trim(),
        address: formData.address.trim(),
      }

      const response = await fetch("/api/cprofile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      const result = await response.json()

      if (result.success) {
        localStorage.removeItem(ONBOARDING_DRAFT_KEY)
        toast.success(result.message || t.toastOnboardingSuccess)
        setStep(2)
        return
      }

      toast.error(result.message || t.toastOnboardingError)
    } catch {
      toast.error(t.toastOnboardingError)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast.error(t.step2TypeError)
      return
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error(t.step2SizeError)
      return
    }
    setLogoUploading(true)
    try {
      const presignRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          folder: "logos",
        }),
      })
      const presignJson = (await presignRes.json()) as {
        success: boolean
        message?: string
        uploadUrl?: string
        fileUrl?: string
        key?: string
      }

      if (!presignRes.ok || !presignJson.success || !presignJson.uploadUrl || !presignJson.fileUrl || !presignJson.key) {
        throw new Error(presignJson.message || t.step2UploadFailed)
      }

      const uploadRes = await fetch(presignJson.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error(t.step2UploadFailed)
      }

      const updateRes = await fetch("/api/cprofile/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl: presignJson.fileUrl,
          logoKey: presignJson.key,
        }),
      })
      const updateJson = (await updateRes.json()) as { success: boolean; message?: string }

      if (!updateRes.ok || !updateJson.success) {
        throw new Error(updateJson.message || t.step2UploadFailed)
      }

      setLogoUrl(presignJson.fileUrl)
    } catch {
      toast.error(t.step2UploadFailed)
    } finally {
      setLogoUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ""
    }
  }

  async function handleFinish() {
    setFinishing(true)
    router.push("/dashboard")
  }

  return (
    <>
    <div className="flex flex-col bg-[#f8fafc] lg:flex-row lg:overflow-hidden" style={{ minHeight: 'var(--app-viewport-height)', height: 'var(--app-viewport-height)' }}>
      <aside className="hidden lg:flex w-105 xl:w-120 shrink-0 flex-col bg-[#020b18] text-white relative overflow-hidden">
        <WorldMapBg
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          strokeColor="white"
          strokeOpacity={0.45}
          gridOpacity={0.1}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_40%,transparent_30%,#020b18_80%)] pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-linear-to-t from-[#020b18] to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-32 bg-linear-to-b from-[#020b18] to-transparent pointer-events-none" />

        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full p-12 xl:p-14">

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 backdrop-blur-sm">
              <LayoutDashboard className="h-4 w-4 text-white" />
            </div>
            <p className="text-[13px] font-bold tracking-widest text-white/90 uppercase">CRM Roberto</p>
          </div>

          <div className="my-auto">
            <Badge
              variant="outline"
              className="border-emerald-400/25 text-emerald-400/60 bg-transparent text-[9px] tracking-[0.2em] uppercase font-semibold rounded-md mb-7"
            >
              {step === 2 ? t.step2Phase : t.phase}
            </Badge>
            <h1 className="font-heading text-[2.2rem] xl:text-[2.6rem] font-black leading-[1.05] tracking-tight">
              {step === 2 ? (
                <>
                  <span className="text-emerald-400">{t.step2PanelHighlight}</span>
                  <br />
                  {t.step2PanelLine2}
                </>
              ) : (
                <>
                  {t.panelLine1}
                  <br />
                  <span className="text-emerald-400">{t.panelHighlight}</span>
                  <br />
                  {t.panelLine2}
                </>
              )}
            </h1>

            <div className="mt-8 mb-8 w-16 h-px bg-white/15" />

            <p className="text-[13px] text-white/40 leading-[1.75] max-w-70">
              {step === 2 ? t.step2PanelDesc : t.panelDesc}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/8">
              <BadgeCheck className="h-4 w-4 text-white/70" />
            </div>
            <p className="text-[12px] text-white/35 font-medium leading-snug">Trusted by thousands of editorial teams.</p>
          </div>
        </div>
      </aside>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#f8fafc] scroll-pb-[calc(5rem+var(--app-keyboard-inset-height))]">
        <div className="flex justify-end px-5 sm:px-8 pt-3 pb-1">
          <LanguageThemeToggle />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
        <motion.div
          key="step1"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
          className="max-w-2xl mx-auto w-full px-5 pt-4 pb-[calc(1rem+var(--app-keyboard-inset-height))] sm:px-8"
        >
            <div className="mb-4">
              <h1 className="font-heading text-2xl font-semibold text-[#001e3c] tracking-tight mb-1">
                {t.heading}
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">{t.subtitle}</p>
            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {[
                { key: "companyName", label: t.companyName, placeholder: "Acme Corporation", required: true },
                { key: "ownerName", label: t.ownerName, placeholder: "Eleanor Vance", required: true },
                { key: "businessEmail", label: t.businessEmail, placeholder: "executive@company.com", type: "email", required: true },
                { key: "phone", label: t.phone, placeholder: "9876543210", type: "tel", required: true },
                { key: "vatNumber", label: t.vatNumber, placeholder: "LU12345678", required: true },
                { key: "rcsNumber", label: t.rcsNumber, placeholder: "B123456", required: false },
                { key: "businessAuthorizationNumber", label: t.businessAuthorizationNumber, placeholder: "10012345/0", required: false },
                { key: "matriculeNumber", label: t.matriculeNumber, placeholder: "20001234567", required: false },
                { key: "iban", label: t.iban, placeholder: "LU12 3456 7890 1234 5678", required: false },
                { key: "bankName", label: t.bankName, placeholder: "BGL BNP Paribas", required: false },
                { key: "legalIdentifier", label: t.legalIdentifier, placeholder: "Extra local legal reference", required: false },
              ].map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {field.label} {field.required ? <span className="text-red-500">*</span> : null}
                  </Label>
                  <Input
                    type={field.type ?? "text"}
                    placeholder={field.placeholder}
                    value={formData[field.key as keyof typeof formData]}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="h-9 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300 text-sm"
                  />
                </div>
              ))}

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {t.hqAddress} <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="123 Editorial Way, Suite 400, New York, NY"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, address: e.target.value }))
                  }
                  className="h-9 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300 text-sm"
                />
                <p className="text-xs text-zinc-400">{t.hqHint}</p>
              </div>
            </div>

            <div
              onClick={() => setIsAgreed(!isAgreed)}
              className={cn(
                "mt-4 p-3 border rounded-xl flex items-start gap-3 transition-all cursor-pointer",
                isAgreed
                  ? "bg-zinc-50 border-zinc-200 hover:bg-zinc-100/60"
                  : "bg-red-50/40 border-red-200/60 hover:bg-red-50/60"
              )}
            >
              <div
                className={cn(
                  "h-5 w-5 flex items-center justify-center rounded-md shrink-0 mt-0.5 transition-all border-2",
                  isAgreed ? "bg-[#001e3c] border-[#001e3c]" : "bg-white border-zinc-300"
                )}
              >
                {isAgreed && <Check className="h-3 w-3 text-white" />}
              </div>
              <div className="space-y-1">
                <p className="text-sm text-zinc-700 leading-relaxed font-medium">{t.agreementBody}</p>
                <p className="text-xs text-zinc-400">{t.agreementHint}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="text-xs font-semibold text-zinc-400 hover:text-[#001e3c] flex items-center gap-2 transition-colors uppercase tracking-wider group"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                {t.saveDraft}
              </button>

              <Button
                onClick={handleComplete}
                disabled={isLoading || !isAgreed}
                className={cn(
                  "h-11 px-8 text-white rounded-lg font-semibold text-sm flex items-center gap-3 transition-all shadow-sm active:scale-[0.98] w-full sm:w-auto",
                  isAgreed ? "bg-[#001e3c] hover:bg-[#002850]" : "bg-zinc-300 cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>{t.completeSetup}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
          ) : (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
            className="max-w-2xl mx-auto w-full px-5 sm:px-8 pt-4 pb-4"
          >
            <div className="mb-4">
              <h1 className="font-heading text-2xl font-semibold text-[#001e3c] tracking-tight mb-1">
                {t.step2Heading}
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">{t.step2Subtitle}</p>
            </div>

            {/* Logo preview box */}
            <div className="flex flex-col items-center gap-4 py-6 border-2 border-dashed border-zinc-200 rounded-2xl bg-white">
              <div className="h-24 w-24 rounded-2xl border border-zinc-200 bg-zinc-50 flex items-center justify-center overflow-hidden shadow-sm">
                {logoUrl ? (
                  <Image src={logoUrl} alt={translate(locale, 'common.companyLogo')} width={96} height={96} className="object-contain w-full h-full" />
                ) : (
                  <BuildingIcon className="h-10 w-10 text-zinc-300" />
                )}
              </div>

              <input
                ref={logoInputRef}
                type="file"
                accept={ALLOWED_LOGO_TYPES.join(",")}
                className="hidden"
                onChange={handleLogoFileChange}
              />

              <button
                type="button"
                disabled={logoUploading}
                onClick={() => logoInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-sm font-semibold text-zinc-700 transition-all disabled:opacity-50"
              >
                {logoUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : logoUrl ? (
                  <UploadIcon className="h-4 w-4" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                {logoUploading ? t.step2Uploading : logoUrl ? t.step2Replace : t.step2Upload}
              </button>

              {logoUrl && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <CheckCircle2Icon className="h-3.5 w-3.5" />
                  Logo uploaded
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="text-xs font-semibold text-zinc-400 hover:text-[#001e3c] flex items-center gap-2 transition-colors uppercase tracking-wider group"
              >
                {t.step2Skip}
              </button>

              <Button
                onClick={handleFinish}
                disabled={finishing || logoUploading}
                className="h-11 px-8 bg-[#001e3c] hover:bg-[#002850] text-white rounded-lg font-semibold text-sm flex items-center gap-3 transition-all shadow-sm active:scale-[0.98] w-full sm:w-auto"
              >
                {finishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>{t.step2Finish}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
          )}
        </AnimatePresence>
        </main>
    </div>
    <FirstVisitGuide />
    </>
  )
}
