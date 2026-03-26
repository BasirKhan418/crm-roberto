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
          toast.success(result.message || "Login successful! Redirecting to dashboard...")
          if(result.isOnboardingComplete){
            router.push("/dashboard")
          }
          else{
          
            router.push("/onboarding")
          }
        }
        else{
          toast.error(result.message || "Login failed. Please check your credentials and try again.")
        }
    }
    catch(error){
      toast.error("An error occurred during login. Please try again.")
      console.error("Login error:", error)
      setIsLoading(false)
    }
    // setTimeout(() => {
    //   setIsLoading(false)
    //   router.push("/dashboard")
    // }, 1500)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-poppins text-4xl font-semibold tracking-tight text-zinc-900">
          {t.heading}
        </h1>
        <p className="font-roboto text-zinc-500 font-medium text-sm">
          {t.subtitle}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label 
            htmlFor="email" 
            className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 ml-0.5"
          >
            {t.emailLabel}
          </Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              className={cn(
                "h-12 bg-zinc-50/50 border-zinc-400 text-zinc-900 focus:bg-white transition-all rounded-none border-t-0 border-r-0 border-l-0 border-b-[1.5px] px-0 shadow-none focus-visible:ring-0 focus-visible:border-zinc-900 placeholder:text-zinc-300",
                errors.email && "border-red-500 focus:border-red-500"
              )}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="font-roboto text-[11px] font-semibold text-red-600 mt-1.5 ml-0.5">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label 
              htmlFor="password" 
              className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 ml-0.5"
            >
              {t.passwordLabel}
            </Label>
            <Link 
              href="/forgot-password" 
              className="text-[10px] font-bold uppercase tracking-widest text-[#001e3c] hover:text-zinc-600 transition-colors"
            >
              {t.forgotPassword}
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className={cn(
                "h-12 bg-zinc-50/50 border-zinc-400 text-zinc-900 focus:bg-white transition-all rounded-none border-t-0 border-r-0 border-l-0 border-b-[1.5px] px-0 shadow-none focus-visible:ring-0 focus-visible:border-zinc-900 placeholder:text-zinc-300 pr-10",
                errors.password && "border-red-500 focus:border-red-500"
              )}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="font-roboto text-[11px] font-semibold text-red-600 mt-1.5 ml-0.5">
              {errors.password.message}
            </p>
          )}
        </div>

        <Button 
          className="w-full h-12 bg-[#001e3c] hover:bg-[#002b54] text-white rounded-md shadow-lg shadow-blue-900/10 text-sm font-semibold transition-all active:scale-[0.98] mt-4" 
          type="submit" 
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-white/50" />
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span>{t.loginButton}</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          )}
        </Button>
      </form>

      <div className="pt-4 text-center">
        <p className="font-roboto text-zinc-500 text-sm font-medium">
          {t.signupPrompt}{" "}
          <Link 
            href="/signup" 
            className="text-[#001e3c] font-bold hover:underline underline-offset-4"
          >
            {t.signupCta}
          </Link>
        </p>
      </div>
    </div>
  )
}
