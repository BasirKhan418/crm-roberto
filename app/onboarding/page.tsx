"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowRight, Loader2, ArrowLeft, Check, LayoutDashboard, BadgeCheck } from "lucide-react"
import { motion } from "framer-motion"

import { LanguageThemeToggle } from "@/components/language-theme-toggle"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { WorldMapBg } from "@/components/ui/WorldMapBg"
import { cn } from "@/lib/utils"

const ONBOARDING_DRAFT_KEY = "onboarding_company_profile_draft"

const onboardingMessages = {
  en: {
    phase: "Onboarding — Step 1 of 1",
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
  },
  fr: {
    phase: "Onboarding — Etape 1 sur 1",
    panelLine1: "Configurez",
    panelHighlight: "Votre Profil",
    panelLine2: "Entreprise.",
    panelDesc: "Renseignez vos informations d'entreprise une seule fois. Fiches clients, contrats fournisseurs et documents officiels s'appuieront sur ce profil.",
    heading: "Configurez votre identite",
    subtitle:
      "Bienvenue dans la suite executive. Pour vous offrir une experience de gestion personnalisee, veuillez confirmer les informations principales de votre entreprise.",
    companyName: "Nom de l'entreprise",
    ownerName: "Nom du proprietaire",
    businessEmail: "E-mail professionnel",
    phone: "Numero de telephone",
    vatNumber: "Numero de TVA",
    hqAddress: "Adresse du siege",
    hqHint: "Incluez le batiment et l'etage pour une meilleure precision documentaire.",
    agreementBody:
      "En finalisant cette configuration, vous reconnaissez que les donnees fournies seront utilisees pour la generation de documents officiels et les rapports internes.",
    agreementHint: "L'accord est requis pour initialiser le protocole executive.",
    saveDraft: "Enregistrer le brouillon et quitter",
    completeSetup: "Terminer la configuration",
    toastDraftSaved: "Brouillon enregistre avec succes",
    toastDraftFailed: "Impossible d'enregistrer le brouillon. Veuillez reessayer.",
    toastAgreementRequired: "Vous devez accepter les conditions pour finaliser la configuration.",
    toastOnboardingSuccess: "Configuration terminee avec succes",
    toastOnboardingError: "Erreur lors de la finalisation de la configuration. Veuillez reessayer.",
  },
} as const

export default function IdentitySetupPage() {
  const router = useRouter()
  const { locale } = useLocale()
  const t = onboardingMessages[locale]

  const [isLoading, setIsLoading] = useState(false)
  const [isAgreed, setIsAgreed] = useState(true)
  const [formData, setFormData] = useState({
    companyName: "",
    ownerName: "",
    businessEmail: "",
    phone: "",
    vatNumber: "",
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

  const handleSaveDraft = () => {
    try {
      localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(formData))
      toast.success(t.toastDraftSaved)
      router.push("/login")
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
      const response = await fetch("/api/cprofile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })
      const result = await response.json()

      if (result.success) {
        localStorage.removeItem(ONBOARDING_DRAFT_KEY)
        toast.success(result.message || t.toastOnboardingSuccess)
        router.push("/dashboard")
        return
      }

      toast.error(result.message || t.toastOnboardingError)
    } catch {
      toast.error(t.toastOnboardingError)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <aside className="hidden lg:flex w-[420px] xl:w-[480px] shrink-0 flex-col bg-[#020b18] text-white relative overflow-hidden">
        <WorldMapBg
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          strokeColor="white"
          strokeOpacity={0.45}
          gridOpacity={0.1}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_40%,transparent_30%,#020b18_80%)] pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#020b18] to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#020b18] to-transparent pointer-events-none" />

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
              {t.phase}
            </Badge>
            <h1 className="font-heading text-[2.2rem] xl:text-[2.6rem] font-black leading-[1.05] tracking-tight">
              {t.panelLine1}
              <br />
              <span className="text-emerald-400">{t.panelHighlight}</span>
              <br />
              {t.panelLine2}
            </h1>

            <div className="mt-8 mb-8 w-16 h-px bg-white/15" />

            <p className="text-[13px] text-white/40 leading-[1.75] max-w-[280px]">
              {t.panelDesc}
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

      <main className="flex-1 overflow-y-auto bg-[#f8fafc]">
        <div className="flex justify-end px-5 sm:px-8 pt-5">
          <LanguageThemeToggle />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
          className="max-w-2xl mx-auto w-full px-5 sm:px-8 pt-8 pb-14"
        >
            <div className="mb-10">
              <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#001e3c] tracking-tight mb-2">
                {t.heading}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">{t.subtitle}</p>
            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
              {[
                { key: "companyName", label: t.companyName, placeholder: "Acme Corporation" },
                { key: "ownerName", label: t.ownerName, placeholder: "Eleanor Vance" },
                { key: "businessEmail", label: t.businessEmail, placeholder: "executive@company.com", type: "email" },
                { key: "phone", label: t.phone, placeholder: "9876543210", type: "tel" },
                { key: "vatNumber", label: t.vatNumber, placeholder: "IE 1234567T" },
              ].map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {field.label} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type={field.type ?? "text"}
                    placeholder={field.placeholder}
                    value={formData[field.key as keyof typeof formData]}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="h-11 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300"
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
                  className="h-11 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300"
                />
                <p className="text-xs text-zinc-400">{t.hqHint}</p>
              </div>
            </div>

            <div
              onClick={() => setIsAgreed(!isAgreed)}
              className={cn(
                "mt-8 p-5 border rounded-xl flex items-start gap-4 transition-all cursor-pointer",
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

            <div className="mt-10 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
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
        </main>
    </div>
  )
}
