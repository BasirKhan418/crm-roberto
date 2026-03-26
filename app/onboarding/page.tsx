"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { toast } from "sonner"
import { ArrowRight, Loader2, ArrowLeft, Check } from "lucide-react"
import { motion } from "framer-motion"

import { LanguageThemeToggle } from "@/components/language-theme-toggle"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const ONBOARDING_DRAFT_KEY = "onboarding_company_profile_draft"

const onboardingMessages = {
  en: {
    phase: "Onboarding Phase 01",
    quoteSource: "Editorial Management Protocol",
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
  },
  fr: {
    phase: "Phase d'onboarding 01",
    quoteSource: "Protocole de Gestion Editoriale",
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
      toast.success("Draft saved successfully")
      router.push("/login")
    } catch {
      toast.error("Unable to save draft. Please try again.")
    }
  }

  const handleComplete = async () => {
    if (!isAgreed) {
      toast.error("You must agree to the terms to complete the setup.")
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
        toast.success(result.message || "Onboarding completed successfully")
        router.push("/dashboard")
        return
      }

      toast.error(result.message || "Error completing onboarding. Please try again.")
    } catch {
      toast.error("Error completing onboarding. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-screen bg-white flex overflow-hidden">
      <div className="hidden lg:flex w-[480px] bg-[#001e3c] flex-col relative overflow-hidden shrink-0 h-full">
        <div className="absolute top-[-10%] right-[-5%] w-full h-[40%] bg-blue-400/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[80%] h-[40%] bg-indigo-500/10 blur-[100px] rounded-full" />

        <div className="relative z-10 flex flex-col h-full p-16">
          <div className="space-y-1.5 mb-20">
            <h2 className="text-3xl font-bold tracking-tight text-white/95 leading-none">Executive CRM</h2>
            <p className="text-[10px] uppercase tracking-[0.4em] text-blue-400 font-black opacity-90">{t.phase}</p>
          </div>

          <div className="mt-4 flex flex-col shrink-0">
            <div className="relative w-full aspect-[4/5] rounded-3xl overflow-hidden border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] mb-14">
              <Image
                src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800"
                alt="HQ Architecture"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#001e3c]/90 via-transparent to-transparent" />
            </div>
            <div className="space-y-4">
              <p className="text-[17px] font-medium leading-relaxed italic text-white/80">
                &ldquo;Precision is the foundation of professional excellence.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="h-[1.5px] w-6 bg-white/20" />
                <p className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-black">{t.quoteSource}</p>
              </div>
            </div>
          </div>

          <div className="mt-auto flex gap-3">
            <div className="h-1 w-10 bg-blue-400 rounded-full" />
            <div className="h-1 w-4 bg-white/10 rounded-full" />
            <div className="h-1 w-4 bg-white/10 rounded-full" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white lg:bg-[#F8FAFC]">
        <div className="fixed right-6 top-6 z-30">
          <LanguageThemeToggle />
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1] }}
          className="max-w-[1100px] mx-auto w-full py-20 px-10 md:px-20"
        >
          <div className="mb-14">
            <h1 className="text-[52px] font-semibold text-[#001e3c] tracking-tight mb-4">{t.heading}</h1>
            <p className="text-zinc-500 font-medium max-w-xl leading-relaxed text-lg">{t.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12">
            {[
              { key: "companyName", label: t.companyName, placeholder: "Acme Corporation" },
              { key: "ownerName", label: t.ownerName, placeholder: "Eleanor Vance" },
              { key: "businessEmail", label: t.businessEmail, placeholder: "executive@company.com" },
              { key: "phone", label: t.phone, placeholder: "9876543210" },
              { key: "vatNumber", label: t.vatNumber, placeholder: "IE 1234567T" },
            ].map((field) => (
              <div key={field.key} className="group space-y-2 relative">
                <Label className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-600 ml-0.5">
                  {field.label} <span className="text-red-500 ml-0.5">*</span>
                </Label>
                <div className="relative">
                  <Input
                    placeholder={field.placeholder}
                    value={formData[field.key as keyof typeof formData]}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    className="h-12 bg-zinc-50/50 border-t-0 border-x-0 border-b border-zinc-400 rounded-none px-3 shadow-none focus-visible:ring-0 focus-visible:border-transparent transition-all placeholder:text-zinc-300 font-medium text-zinc-900 text-base"
                  />
                  <span className="absolute -bottom-px left-1/2 w-0 h-[1.5px] bg-[#001e3c] transition-all duration-500 ease-out group-focus-within:left-0 group-focus-within:w-full" />
                </div>
              </div>
            ))}

            <div className="group space-y-2 md:col-span-2 relative mt-4">
              <Label className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-600 ml-0.5">
                {t.hqAddress} <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <div className="relative">
                <Input
                  placeholder="123 Editorial Way, Suite 400, New York, NY"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      address: e.target.value,
                    }))
                  }
                  className="h-12 bg-zinc-50/50 border-t-0 border-x-0 border-b border-zinc-400 rounded-none px-3 shadow-none focus-visible:ring-0 focus-visible:border-transparent transition-all placeholder:text-zinc-300 font-medium text-zinc-900 text-base"
                />
                <span className="absolute -bottom-px left-1/2 w-0 h-[1.5px] bg-[#001e3c] transition-all duration-500 ease-out group-focus-within:left-0 group-focus-within:w-full" />
              </div>
              <p className="text-[11px] text-zinc-400 font-medium pt-2 ml-0.5">{t.hqHint}</p>
            </div>
          </div>

          <div
            onClick={() => setIsAgreed(!isAgreed)}
            className={cn(
              "mt-16 p-6 border rounded-2xl flex items-start gap-5 transition-all cursor-pointer group hover:bg-white/50",
              isAgreed ? "bg-zinc-50 border-zinc-100" : "bg-red-50/30 border-red-200/50"
            )}
          >
            <div
              className={cn(
                "h-6 w-6 flex items-center justify-center rounded-md shrink-0 transition-all border-2",
                isAgreed ? "bg-[#001e3c] border-[#001e3c]" : "bg-white border-zinc-300 group-hover:border-zinc-400"
              )}
            >
              {isAgreed && <Check className="h-4 w-4 text-white" />}
            </div>
            <div className="space-y-1">
              <p className="text-[13px] text-zinc-700 leading-relaxed font-semibold">{t.agreementBody}</p>
              <p className="text-[11px] text-zinc-400 font-medium">{t.agreementHint}</p>
            </div>
          </div>

          <div className="mt-20 flex items-center justify-between">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="text-[11px] font-bold text-zinc-400 hover:text-[#001e3c] flex items-center gap-3 transition-colors uppercase tracking-[0.2em] group"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              {t.saveDraft}
            </button>

            <Button
              onClick={handleComplete}
              disabled={isLoading || !isAgreed}
              className={cn(
                "h-14 px-12 text-white rounded-md font-bold text-sm tracking-tight flex items-center gap-4 transition-all shadow-[0_20px_40px_-10px_rgba(0,30,60,0.3)] active:scale-[0.98]",
                isAgreed ? "bg-[#001e3c] hover:bg-[#002850]" : "bg-zinc-300 cursor-not-allowed grayscale"
              )}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span>{t.completeSetup}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
