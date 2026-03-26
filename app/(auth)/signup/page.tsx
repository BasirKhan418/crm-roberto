"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { 
  ArrowRight,
  Loader2,
  Eye,
  EyeOff
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
const signupSchema = z.object({
  fullName: z.string().min(2, "Full Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

type SignupValues = z.infer<typeof signupSchema>

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
})

const signupMessages = {
  en: {
    verifyOtpTitle: "Verify OTP",
    createAccountTitle: "Create Account",
    createSubtitle: "Join the executive management platform.",
    fullName: "Full Name",
    email: "Email Address",
    password: "Password",
    confirmPassword: "Confirm Password",
    createAccountButton: "Create Account",
    otpLabel: "6-Digit Verification Code",
    verifyCode: "Verify Code",
    resendOtp: "Resend OTP",
    backToSignup: "Back to Signup",
    existingPrompt: "Already have an account?",
    loginCta: "Log In",
    otpSentTo: "We've sent a 6-digit code to",
    toastSignupSuccess: "Signup successful! Please verify your email.",
    toastSignupFailed: "Signup failed. Please try again.",
    toastSignupError: "Error occurred while signing up. Please try again.",
    toastNoSignupDetails: "Signup details not found. Please sign up again.",
    toastOtpResent: "OTP resent successfully! Please check your email.",
    toastResendFailed: "Failed to resend OTP. Please try again.",
    toastOtpVerified: "OTP verified successfully! Redirecting to onboarding...",
    toastOtpFailed: "OTP verification failed. Please try again.",
    toastOtpError: "Error occurred while verifying OTP. Please try again.",
  },
  fr: {
    verifyOtpTitle: "Verifier le code",
    createAccountTitle: "Creer un compte",
    createSubtitle: "Rejoignez la plateforme de gestion executive.",
    fullName: "Nom complet",
    email: "Adresse e-mail",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    createAccountButton: "Creer un compte",
    otpLabel: "Code de verification a 6 chiffres",
    verifyCode: "Verifier le code",
    resendOtp: "Renvoyer le code",
    backToSignup: "Retour a l'inscription",
    existingPrompt: "Vous avez deja un compte ?",
    loginCta: "Connexion",
    otpSentTo: "Nous avons envoye un code a 6 chiffres a",
    toastSignupSuccess: "Inscription reussie ! Veuillez verifier votre e-mail.",
    toastSignupFailed: "Echec de l'inscription. Veuillez reessayer.",
    toastSignupError: "Une erreur s'est produite lors de l'inscription. Veuillez reessayer.",
    toastNoSignupDetails: "Informations d'inscription introuvables. Veuillez vous inscrire a nouveau.",
    toastOtpResent: "Code OTP renvoye avec succes ! Veuillez verifier votre e-mail.",
    toastResendFailed: "Echec du renvoi du code OTP. Veuillez reessayer.",
    toastOtpVerified: "Code OTP verifie avec succes ! Redirection vers l'onboarding...",
    toastOtpFailed: "Echec de la verification du code OTP. Veuillez reessayer.",
    toastOtpError: "Une erreur s'est produite lors de la verification. Veuillez reessayer.",
  },
} as const

export default function SignupPage() {
  const router = useRouter()
  const { locale } = useLocale()
  const t = signupMessages[locale]
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showOtp, setShowOtp] = useState(false)
  const [userEmail, setUserEmail] = useState("")
  const [signupPayload, setSignupPayload] = useState<{
    name: string
    email: string
    password: string
  } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
  })

  const {
    register: registerOtp,
    handleSubmit: handleSubmitOtp,
    setValue: setOtpValue,
    formState: { errors: otpErrors },
  } = useForm<{ otp: string }>({
    resolver: zodResolver(otpSchema),
  })

  async function onSubmit(data: SignupValues) {
    setIsLoading(true)
    console.log("Signup Data:", data)
    const payload = {
      name: data.fullName,
      email: data.email,
      password: data.password,
    }
    try{
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      setIsLoading(false)
      if(result.success){
        toast.success(result.message || t.toastSignupSuccess)
        setSignupPayload(payload)
        setUserEmail(data.email)
        setShowOtp(true)
      }
      else{
        toast.error(result.message || t.toastSignupFailed)
      }

    }
    catch(error){
      setIsLoading(false)
      toast.error(t.toastSignupError)
      console.error("Signup error:", error)
    }
    // setTimeout(() => {
    //   setUserEmail(data.email)
    //   setIsLoading(false)
    //   setShowOtp(true)
    // }, 1500)
  }

  async function onResendOtp() {
    if (!signupPayload) {
      toast.error(t.toastNoSignupDetails)
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(signupPayload),
      })

      const result = await response.json()

      if (result.success) {
        toast.success(t.toastOtpResent)
        setIsLoading(false)
        return
      }

      setIsLoading(false)
      toast.error(result.message || t.toastResendFailed)
    } catch {
      setIsLoading(false)
      toast.error(t.toastResendFailed)
    }
  }

  async function onOtpSubmit(data: { otp: string }) {
    setIsLoading(true)
    try{
      const response = await fetch("/api/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
          otp: data.otp,
        }),
      })
      const result = await response.json()
      setIsLoading(false)
      if(result.success){
        toast.success(t.toastOtpVerified)
        router.push("/onboarding")
      }
      else{
        toast.error(result.message || t.toastOtpFailed)
      }
    }
    catch(error){
      setIsLoading(false)
      toast.error(t.toastOtpError)
      console.error("OTP verification error:", error)
    }
    // setTimeout(() => {
    //   setIsLoading(false)
    //   // Redirect to onboarding as per screenshot request
    //   router.push("/onboarding")
    // }, 1500)
  }

  return (
    <div className="space-y-8">
      {/* Heading */}
      <div className="space-y-1.5">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-zinc-900">
          {showOtp ? t.verifyOtpTitle : t.createAccountTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {showOtp ? `${t.otpSentTo} ${userEmail}` : t.createSubtitle}
        </p>
      </div>

      {!showOtp ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {t.fullName}
            </Label>
            <Input
              id="fullName"
              placeholder="John Doe"
              autoComplete="name"
              className={cn(
                "h-11 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300",
                errors.fullName && "border-red-400 focus-visible:ring-red-200 focus-visible:border-red-400"
              )}
              {...register("fullName")}
            />
            {errors.fullName && (
              <p className="text-xs font-medium text-red-600">{errors.fullName.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {t.email}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              autoComplete="email"
              className={cn(
                "h-11 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300",
                errors.email && "border-red-400 focus-visible:ring-red-200 focus-visible:border-red-400"
              )}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs font-medium text-red-600">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {t.password}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                className={cn(
                  "h-11 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300 pr-10",
                  errors.password && "border-red-400 focus-visible:ring-red-200 focus-visible:border-red-400"
                )}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs font-medium text-red-600">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {t.confirmPassword}
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                className={cn(
                  "h-11 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300 pr-10",
                  errors.confirmPassword && "border-red-400 focus-visible:ring-red-200 focus-visible:border-red-400"
                )}
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs font-medium text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            className="w-full h-11 bg-[#001e3c] hover:bg-[#002b54] text-white rounded-lg text-sm font-semibold transition-all active:scale-[0.98] shadow-sm mt-2"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="flex items-center gap-2">
                {t.createAccountButton}
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleSubmitOtp(onOtpSubmit)} className="space-y-6">
          {/* OTP boxes */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block text-center">
              {t.otpLabel}
            </Label>
            <div className="flex justify-center gap-2.5">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <input
                  key={index}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className={cn(
                    "w-11 h-12 text-center text-lg font-bold text-zinc-900 border rounded-lg bg-zinc-50 focus:bg-white focus:border-[#001e3c] focus:ring-2 focus:ring-[#001e3c]/20 focus:outline-none transition-all",
                    otpErrors.otp ? "border-red-400" : "border-zinc-200"
                  )}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, "");
                    e.target.value = value;
                    if (value && index < 5) {
                      const nextInput = (e.target as HTMLInputElement).parentElement?.children[index + 1] as HTMLInputElement;
                      nextInput?.focus();
                    }
                    const parent = (e.target as HTMLInputElement).parentElement;
                    if (parent) {
                      const inputs = Array.from(parent.querySelectorAll("input")) as HTMLInputElement[];
                      const otpValue = inputs.map((i) => i.value).join("");
                      setOtpValue("otp", otpValue);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !(e.target as HTMLInputElement).value && index > 0) {
                      const prevInput = (e.target as HTMLFormElement).parentElement?.children[index - 1] as HTMLInputElement;
                      prevInput?.focus();
                    }
                  }}
                />
              ))}
            </div>
            <input type="hidden" {...registerOtp("otp")} />
            {otpErrors.otp && (
              <p className="text-xs font-medium text-red-600 text-center">{otpErrors.otp.message}</p>
            )}
          </div>

          <Button
            className="w-full h-11 bg-[#001e3c] hover:bg-[#002b54] text-white rounded-lg text-sm font-semibold transition-all active:scale-[0.98] shadow-sm"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.verifyCode}
          </Button>

          <div className="flex flex-col gap-2 text-center">
            <button
              type="button"
              onClick={onResendOtp}
              disabled={isLoading}
              className="text-xs font-semibold text-zinc-500 hover:text-[#001e3c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t.resendOtp}
            </button>
            <button
              type="button"
              onClick={() => setShowOtp(false)}
              className="text-xs font-semibold text-zinc-500 hover:text-[#001e3c] transition-colors"
            >
              {t.backToSignup}
            </button>
          </div>
        </form>
      )}

      <p className="text-center text-sm text-zinc-500">
        {t.existingPrompt}{" "}
        <Link href="/login" className="font-semibold text-[#001e3c] hover:underline underline-offset-4">
          {t.loginCta}
        </Link>
      </p>
    </div>
  )
}