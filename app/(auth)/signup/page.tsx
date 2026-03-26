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

const signupSchema = z.z.object({
  fullName: z.string().min(2, "Full Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

type SignupValues = z.infer<typeof signupSchema>

export default function SignupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
  })

  async function onSubmit() {
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
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
          Create Account
        </h1>
        <p className="text-zinc-500 font-medium text-sm">
          Join the executive management platform.
        </p>
      </div>

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
            <p className="text-[11px] font-semibold text-red-600 mt-1.5 ml-0.5">
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
            <p className="text-[11px] font-semibold text-red-600 mt-1.5 ml-0.5">
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
            <p className="text-[11px] font-semibold text-red-600 mt-1.5 ml-0.5">
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
            <p className="text-[11px] font-semibold text-red-600 mt-1.5 ml-0.5">
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

      <div className="pt-4 text-center">
        <p className="text-zinc-500 text-sm font-medium">
          Already have an account?{" "}
          <Link 
            href="/login" 
            className="text-[#001e3c] font-bold hover:underline underline-offset-4"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}
