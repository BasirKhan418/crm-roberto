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
  CheckCircle2,
  Mail,
  Lock,
  Eye,
  EyeOff
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

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

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("email")
  const [isLoading, setIsLoading] = useState(false)
  const [userEmail, setUserEmail] = useState("")
  const [showPassword, setShowPassword] = useState(false)

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
    setTimeout(() => {
      setUserEmail(data.email)
      setIsLoading(false)
      setStep("otp")
    }, 1500)
  }

  async function onOtpSubmit(data: { otp: string }) {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setStep("reset")
    }, 1500)
  }

  async function onResetSubmit(data: z.infer<typeof resetPasswordSchema>) {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setStep("completed")
    }, 1500)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
          {step === "email" && "Reset Password"}
          {step === "otp" && "Verify OTP"}
          {step === "reset" && "New Password"}
          {step === "completed" && "Success!"}
        </h1>
        <p className="text-zinc-500 font-medium text-sm">
          {step === "email" && "Enter your email to receive a reset code."}
          {step === "otp" && `We've sent a 6-digit code to ${userEmail}`}
          {step === "reset" && "Set a strong password for your account."}
          {step === "completed" && "Your password has been reset successfully."}
        </p>
      </div>

      {step === "email" && (
        <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 ml-0.5">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              className={cn(
                "h-12 bg-zinc-50/50 border-zinc-400 focus:bg-white transition-all rounded-none border-t-0 border-r-0 border-l-0 border-b-[1.5px] px-0 shadow-none focus-visible:ring-0 focus-visible:border-zinc-900 placeholder:text-zinc-300",
                emailForm.formState.errors.email && "border-red-500 focus:border-red-500"
              )}
              {...emailForm.register("email")}
            />
            {emailForm.formState.errors.email && (
              <p className="text-[11px] font-semibold text-red-600 mt-1.5 ml-0.5">
                {emailForm.formState.errors.email.message}
              </p>
            )}
          </div>
          <Button className="w-full h-12 bg-[#001e3c] hover:bg-[#002b54] text-white rounded-md shadow-lg shadow-blue-900/10 text-sm font-semibold transition-all active:scale-[0.98]" type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-white/50" /> : "Send Code"}
          </Button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-6">
          <div className="space-y-4">
            <Label htmlFor="otp" className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 ml-0.5 block text-center">
              6-Digit Verification Code
            </Label>
            <div className="flex justify-between gap-2 max-w-[320px] mx-auto">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <input
                  key={index}
                  type="text"
                  maxLength={1}
                  className={cn(
                    "w-10 h-12 text-center text-lg font-bold border-b-2 bg-zinc-50 focus:bg-white focus:border-[#001e3c] focus:outline-none transition-all",
                    otpForm.formState.errors.otp ? "border-red-500" : "border-zinc-300"
                  )}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    e.target.value = value;
                    
                    if (value && index < 5) {
                      const nextInput = (e.target as HTMLInputElement).parentElement?.children[index + 1] as HTMLInputElement;
                      nextInput?.focus();
                    }
                    
                    // Update the actual hidden form field
                    const parent = (e.target as HTMLInputElement).parentElement;
                    if (parent) {
                      const inputs = Array.from(parent.querySelectorAll('input')) as HTMLInputElement[];
                      const otpValue = inputs.map(i => i.value).join('');
                      setOtpValue("otp", otpValue);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !(e.target as HTMLInputElement).value && index > 0) {
                      const prevInput = (e.target as HTMLFormElement).parentElement?.children[index - 1] as HTMLInputElement;
                      prevInput?.focus();
                    }
                  }}
                />
              ))}
            </div>
            <input
              type="hidden"
              {...otpForm.register("otp")}
            />
            {otpForm.formState.errors.otp && (
              <p className="text-[11px] font-semibold text-red-600 mt-1.5 text-center">
                {otpForm.formState.errors.otp.message}
              </p>
            )}
          </div>
          <Button className="w-full h-12 bg-[#001e3c] hover:bg-[#002b54] text-white rounded-md shadow-lg shadow-blue-900/10 text-sm font-semibold transition-all active:scale-[0.98]" type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-white/50" /> : "Verify Code"}
          </Button>
          <button type="button" onClick={() => setStep("email")} className="w-full text-center text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-500 hover:text-[#001e3c] transition-colors">
            Back to email
          </button>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 ml-0.5">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className={cn(
                  "h-12 bg-zinc-50/50 border-zinc-400 focus:bg-white transition-all rounded-none border-t-0 border-r-0 border-l-0 border-b-[1.5px] px-0 shadow-none focus-visible:ring-0 focus-visible:border-zinc-900 placeholder:text-zinc-300 pr-10",
                  resetForm.formState.errors.password && "border-red-500 focus:border-red-500"
                )}
                {...resetForm.register("password")}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {resetForm.formState.errors.password && (
              <p className="text-[11px] font-semibold text-red-600 mt-1.5 ml-0.5">
                {resetForm.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 ml-0.5">
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className={cn(
                "h-12 bg-zinc-50/50 border-zinc-400 focus:bg-white transition-all rounded-none border-t-0 border-r-0 border-l-0 border-b-[1.5px] px-0 shadow-none focus-visible:ring-0 focus-visible:border-zinc-900 placeholder:text-zinc-300",
                resetForm.formState.errors.confirmPassword && "border-red-500 focus:border-red-500"
              )}
              {...resetForm.register("confirmPassword")}
            />
            {resetForm.formState.errors.confirmPassword && (
              <p className="text-[11px] font-semibold text-red-600 mt-1.5 ml-0.5">
                {resetForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button className="w-full h-12 bg-[#001e3c] hover:bg-[#002b54] text-white rounded-md shadow-lg shadow-blue-900/10 text-sm font-semibold transition-all active:scale-[0.98]" type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-white/50" /> : "Reset Password"}
          </Button>
        </form>
      )}

      {step === "completed" && (
        <div className="space-y-6 pt-4">
          <div className="flex justify-center flex-col items-center gap-4 py-4">
            <div className="h-16 w-16 bg-zinc-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <Button onClick={() => router.push("/login")} className="w-full h-12 bg-[#001e3c] hover:bg-[#002b54] text-white rounded-md shadow-lg shadow-blue-900/10 text-sm font-semibold transition-all active:scale-[0.98]">
            Go to Login
          </Button>
        </div>
      )}

      <div className="pt-4 text-center">
        <p className="text-zinc-500 text-sm font-medium">
          Remember your password?{" "}
          <Link href="/login" className="text-[#001e3c] font-bold hover:underline underline-offset-4">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}
