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
import { cn } from "@/lib/utils"

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

export default function SignupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showOtp, setShowOtp] = useState(false)
  const [userEmail, setUserEmail] = useState("")

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
    setTimeout(() => {
      setUserEmail(data.email)
      setIsLoading(false)
      setShowOtp(true)
    }, 1500)
  }

  async function onOtpSubmit(data: { otp: string }) {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      // Redirect to onboarding as per screenshot request
      router.push("/onboarding")
    }, 1500)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-poppins text-4xl font-semibold tracking-tight text-zinc-900">
          {showOtp ? "Verify OTP" : "Create Account"}
        </h1>
        <p className="font-roboto text-zinc-500 font-medium text-sm">
          {showOtp 
            ? `We've sent a 6-digit code to ${userEmail}` 
            : "Join the executive management platform."}
        </p>
      </div>

      {!showOtp ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label 
              htmlFor="fullName" 
              className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 ml-0.5"
            >
              Full Name
            </Label>
            <Input
              id="fullName"
              placeholder="John Doe"
              className={cn(
                "h-12 bg-zinc-50/50 border-zinc-400 focus:bg-white transition-all rounded-none border-t-0 border-r-0 border-l-0 border-b-[1.5px] px-0 shadow-none focus-visible:ring-0 focus-visible:border-zinc-900 placeholder:text-zinc-300",
                errors.fullName && "border-red-500 focus:border-red-500"
              )}
              {...register("fullName")}
            />
            {errors.fullName && (
              <p className="font-roboto text-[11px] font-semibold text-red-600 mt-1.5 ml-0.5">
                {errors.fullName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label 
              htmlFor="email" 
              className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 ml-0.5"
            >
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              className={cn(
                "h-12 bg-zinc-50/50 border-zinc-400 focus:bg-white transition-all rounded-none border-t-0 border-r-0 border-l-0 border-b-[1.5px] px-0 shadow-none focus-visible:ring-0 focus-visible:border-zinc-900 placeholder:text-zinc-300",
                errors.email && "border-red-500 focus:border-red-500"
              )}
              {...register("email")}
            />
            {errors.email && (
              <p className="font-roboto text-[11px] font-semibold text-red-600 mt-1.5 ml-0.5">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label 
              htmlFor="password" 
              className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 ml-0.5"
            >
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className={cn(
                  "h-12 bg-zinc-50/50 border-zinc-400 focus:bg-white transition-all rounded-none border-t-0 border-r-0 border-l-0 border-b-[1.5px] px-0 shadow-none focus-visible:ring-0 focus-visible:border-zinc-900 placeholder:text-zinc-300 pr-10",
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

          <div className="space-y-2">
            <Label 
              htmlFor="confirmPassword" 
              className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 ml-0.5"
            >
              Confirm Password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className={cn(
                  "h-12 bg-zinc-50/50 border-zinc-400 focus:bg-white transition-all rounded-none border-t-0 border-r-0 border-l-0 border-b-[1.5px] px-0 shadow-none focus-visible:ring-0 focus-visible:border-zinc-900 placeholder:text-zinc-300 pr-10",
                  errors.confirmPassword && "border-red-500 focus:border-red-500"
                )}
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="font-roboto text-[11px] font-semibold text-red-600 mt-1.5 ml-0.5">
                {errors.confirmPassword.message}
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
                <span>Create Account</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleSubmitOtp(onOtpSubmit)} className="space-y-6">
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
                    otpErrors.otp ? "border-red-500" : "border-zinc-300"
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
                      const otpValue = inputs.map(i => i.value).join("");
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
            <input
              type="hidden"
              {...registerOtp("otp")}
            />
            {otpErrors.otp && (
              <p className="font-roboto text-[11px] font-semibold text-red-600 mt-1.5 text-center">
                {otpErrors.otp.message}
              </p>
            )}
          </div>
          <Button 
            className="w-full h-12 bg-[#001e3c] hover:bg-[#002b54] text-white rounded-md shadow-lg shadow-blue-900/10 text-sm font-semibold transition-all active:scale-[0.98]" 
            type="submit" 
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-white/50" /> : "Verify Code"}
          </Button>
          <button 
            type="button" 
            onClick={() => setShowOtp(false)} 
            className="w-full text-center text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:text-[#001e3c] transition-colors"
          >
            Back to Signup
          </button>
        </form>
      )}

      <div className="pt-4 text-center">
        <p className="font-roboto text-zinc-500 text-sm font-medium">
          Already have an account?{" "}
          <Link 
            href="/login" 
            className="text-[#001e3c] font-bold hover:underline underline-offset-4"
          >
            Log In
          </Link>
        </p>
      </div>
    </div>
  )
}