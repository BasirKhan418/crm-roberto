"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
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

const loginSchema = z.object({
  email: z.string().email("Please enter a valid business email address."),
  password: z.string().min(1, "Password is required to access your account."),
})

type LoginValues = z.infer<typeof loginSchema>

const loginMessages = {
  en: {
    heading: "Welcome Back",
    subtitle: "Sign in to your editorial dashboard.",
    emailLabel: "Email Address",
    passwordLabel: "Password",
    forgotPassword: "Forgot password?",
    loginButton: "Login",
    signupPrompt: "New to the executive platform?",
    signupCta: "Signup",
    toastLoginSuccess: "Login successful! Redirecting to dashboard...",
    toastLoginFailed: "Login failed. Please check your credentials and try again.",
    toastLoginError: "An error occurred during login. Please try again.",
  },
  fr: {
    heading: "Bon retour",
    subtitle: "Connectez-vous a votre tableau de bord editorial.",
    emailLabel: "Adresse e-mail",
    passwordLabel: "Mot de passe",
    forgotPassword: "Mot de passe oublie ?",
    loginButton: "Connexion",
    signupPrompt: "Nouveau sur la plateforme executive ?",
    signupCta: "Inscription",
    toastLoginSuccess: "Connexion reussie ! Redirection vers le tableau de bord...",
    toastLoginFailed: "Echec de la connexion. Veuillez verifier vos identifiants et reessayer.",
    toastLoginError: "Une erreur s'est produite lors de la connexion. Veuillez reessayer.",
  },
} as const

export default function LoginPage() {
  const router = useRouter()
  const { locale } = useLocale()
  const t = loginMessages[locale]
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginValues) {
    setIsLoading(true)
    try{
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })
      const result = await response.json()
      console.log("Login result:", result)
        setIsLoading(false)
        if(result.success){
          toast.success(result.message || t.toastLoginSuccess)
          if(result.isOnboardingComplete){
            router.push("/dashboard")
          }
          else{
          
            router.push("/onboarding")
          }
        }
        else{
          toast.error(result.message || t.toastLoginFailed)
        }
    }
    catch(error){
      toast.error(t.toastLoginError)
      console.error("Login error:", error)
      setIsLoading(false)
    }
    // setTimeout(() => {
    //   setIsLoading(false)
    //   router.push("/dashboard")
    // }, 1500)
  }

  return (
    <div className="space-y-8">
      {/* Heading */}
      <div className="space-y-1.5">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-zinc-900">
          {t.heading}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.subtitle}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {t.passwordLabel}
            </Label>
            <Link
              href="/forgot-password"
              className="text-[11px] font-semibold text-[#001e3c] hover:underline underline-offset-4 transition-colors"
            >
              {t.forgotPassword}
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
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

        <Button
          className="w-full h-11 bg-[#001e3c] hover:bg-[#002b54] text-white rounded-lg text-sm font-semibold transition-all active:scale-[0.98] shadow-sm mt-2"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="flex items-center gap-2">
              {t.loginButton}
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-zinc-500">
        {t.signupPrompt}{" "}
        <Link href="/signup" className="font-semibold text-[#001e3c] hover:underline underline-offset-4">
          {t.signupCta}
        </Link>
      </p>
    </div>
  )
}
