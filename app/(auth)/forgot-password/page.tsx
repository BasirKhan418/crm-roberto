"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { 
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"
import {toast} from "sonner"
const emailSchema = z.object({
  email: z.string().email("Please enter a valid business email address."),
})

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
})

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

type Step = "email" | "otp" | "reset" | "completed"

const forgotMessages = {
  en: {
    emailTitle: "Reset Password",
    otpTitle: "Verify OTP",
    resetTitle: "New Password",
    completedTitle: "Success!",
    emailSubtitle: "Enter your email to receive a reset code.",
    resetSubtitle: "Set a strong password for your account.",
    completedSubtitle: "Your password has been reset successfully.",
    emailLabel: "Email Address",
    sendCode: "Send Code",
    otpLabel: "6-Digit Verification Code",
    verifyCode: "Verify Code",
    backToEmail: "Back to email",
    newPassword: "New Password",
    confirmPassword: "Confirm Password",
    resetButton: "Reset Password",
    goToLogin: "Go to Login",
    rememberPrompt: "Remember your password?",
    loginCta: "Login",
    otpSentTo: "We've sent a 6-digit code to",
    toastEmailSent: "Reset email sent successfully! Please check your inbox for the OTP.",
    toastOtpVerified: "OTP verified successfully! Please set your new password.",
    toastPasswordReset: "Your password has been reset successfully! You can now log in.",
    toastRequestError: "An error occurred while processing your request.",
  },
  fr: {
    emailTitle: "Reinitialiser le mot de passe",
    otpTitle: "Verifier le code",
    resetTitle: "Nouveau mot de passe",
    completedTitle: "Succes !",
    emailSubtitle: "Entrez votre e-mail pour recevoir un code de reinitialisation.",
    resetSubtitle: "Definissez un mot de passe securise pour votre compte.",
    completedSubtitle: "Votre mot de passe a ete reinitialise avec succes.",
    emailLabel: "Adresse e-mail",
    sendCode: "Envoyer le code",
    otpLabel: "Code de verification a 6 chiffres",
    verifyCode: "Verifier le code",
    backToEmail: "Retour a l'e-mail",
    newPassword: "Nouveau mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    resetButton: "Reinitialiser le mot de passe",
    goToLogin: "Aller a la connexion",
    rememberPrompt: "Vous vous souvenez du mot de passe ?",
    loginCta: "Connexion",
    otpSentTo: "Nous avons envoye un code a 6 chiffres a",
    toastEmailSent: "E-mail de reinitialisation envoye avec succes ! Veuillez verifier votre boite de reception.",
    toastOtpVerified: "Code OTP verifie avec succes ! Veuillez definir votre nouveau mot de passe.",
    toastPasswordReset: "Votre mot de passe a ete reinitialise avec succes ! Vous pouvez maintenant vous connecter.",
    toastRequestError: "Une erreur s'est produite lors du traitement de votre demande.",
  },
} as const

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { locale } = useLocale()
  const t = forgotMessages[locale]
  const [step, setStep] = useState<Step>("email")
  const [isLoading, setIsLoading] = useState(false)
  const [userEmail, setUserEmail] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [token, setToken] = useState("")

  const emailForm = useForm<{ email: string }>({
    resolver: zodResolver(emailSchema),
  })

  const otpForm = useForm<{ otp: string }>({
    resolver: zodResolver(otpSchema),
  })

  const { setValue: setOtpValue } = otpForm;

  const resetForm = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
  })

  async function onEmailSubmit(data: { email: string }) {
    setIsLoading(true)
    try{
      const response = await fetch("/api/forgot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: data.email, status: "forgot" }),
      })
      const result = await response.json()
      setIsLoading(false)
      if (!result.success) {
        toast.error(result.message);
      } else {
        setUserEmail(data.email)
        toast.success(result.message || t.toastEmailSent)
        setStep("otp")
      }

    }
    catch{
      setIsLoading(false)
      toast.error(t.toastRequestError)
    }
  }

  async function onOtpSubmit(data: { otp: string }) {
    setIsLoading(true)
    try{
      const response = await fetch("/api/forgot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: userEmail, status: "verify", otp: data.otp }),
      })
      const result = await response.json()
      setIsLoading(false)
      if (!result.success) {
        toast.error(result.message);
      }
        else {
          setToken(result.token)
          toast.success(result.message || t.toastOtpVerified)
          setStep("reset")
        }
    }
    catch{
      setIsLoading(false)
      toast.error(t.toastRequestError)
    }
  }

  async function onResetSubmit(data: z.infer<typeof resetPasswordSchema>) {
    setIsLoading(true)
    try{
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: userEmail, password: data.password, token }),
      })
      const result = await response.json()
      setIsLoading(false)
      if (!result.success) {
        toast.error(result.message);
      }
        else {          
          toast.success(result.message || t.toastPasswordReset)
          setStep("completed")
        }
    }
    catch{
      setIsLoading(false)
      toast.error(t.toastRequestError)
    }
  }

  return (
    <div className="space-y-8">
      {/* Heading */}
      <div className="space-y-1.5">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-zinc-900">
          {step === "email" && t.emailTitle}
          {step === "otp" && t.otpTitle}
          {step === "reset" && t.resetTitle}
          {step === "completed" && t.completedTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {step === "email" && t.emailSubtitle}
          {step === "otp" && `${t.otpSentTo} ${userEmail}`}
          {step === "reset" && t.resetSubtitle}
          {step === "completed" && t.completedSubtitle}
        </p>
      </div>

      {step === "email" && (
        <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {t.emailLabel}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              autoComplete="email"
              className={cn(
                "h-11 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300",
                emailForm.formState.errors.email && "border-red-400 focus-visible:ring-red-200 focus-visible:border-red-400"
              )}
              {...emailForm.register("email")}
            />
            {emailForm.formState.errors.email && (
              <p className="text-xs font-medium text-red-600">{emailForm.formState.errors.email.message}</p>
            )}
          </div>
          <Button
            className="w-full h-11 bg-[#001e3c] hover:bg-[#002b54] text-white rounded-lg text-sm font-semibold transition-all active:scale-[0.98] shadow-sm"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.sendCode}
          </Button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-6">
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
                    otpForm.formState.errors.otp ? "border-red-400" : "border-zinc-200"
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
            <input type="hidden" {...otpForm.register("otp")} />
            {otpForm.formState.errors.otp && (
              <p className="text-xs font-medium text-red-600 text-center">{otpForm.formState.errors.otp.message}</p>
            )}
          </div>
          <Button
            className="w-full h-11 bg-[#001e3c] hover:bg-[#002b54] text-white rounded-lg text-sm font-semibold transition-all active:scale-[0.98] shadow-sm"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.verifyCode}
          </Button>
          <button
            type="button"
            onClick={() => setStep("email")}
            className="w-full text-center text-xs font-semibold text-zinc-500 hover:text-[#001e3c] transition-colors"
          >
            {t.backToEmail}
          </button>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {t.newPassword}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                className={cn(
                  "h-11 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300 pr-10",
                  resetForm.formState.errors.password && "border-red-400 focus-visible:ring-red-200 focus-visible:border-red-400"
                )}
                {...resetForm.register("password")}
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
            {resetForm.formState.errors.password && (
              <p className="text-xs font-medium text-red-600">{resetForm.formState.errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {t.confirmPassword}
            </Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              className={cn(
                "h-11 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300",
                resetForm.formState.errors.confirmPassword && "border-red-400 focus-visible:ring-red-200 focus-visible:border-red-400"
              )}
              {...resetForm.register("confirmPassword")}
            />
            {resetForm.formState.errors.confirmPassword && (
              <p className="text-xs font-medium text-red-600">{resetForm.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            className="w-full h-11 bg-[#001e3c] hover:bg-[#002b54] text-white rounded-lg text-sm font-semibold transition-all active:scale-[0.98] shadow-sm"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.resetButton}
          </Button>
        </form>
      )}

      {step === "completed" && (
        <div className="space-y-6 pt-2">
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-16 w-16 bg-green-50 rounded-full flex items-center justify-center border border-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <Button
            onClick={() => router.push("/login")}
            className="w-full h-11 bg-[#001e3c] hover:bg-[#002b54] text-white rounded-lg text-sm font-semibold transition-all active:scale-[0.98] shadow-sm"
          >
            {t.goToLogin}
          </Button>
        </div>
      )}

      <p className="text-center text-sm text-zinc-500">
        {t.rememberPrompt}{" "}
        <Link href="/login" className="font-semibold text-[#001e3c] hover:underline underline-offset-4">
          {t.loginCta}
        </Link>
      </p>
    </div>
  )
}
        
