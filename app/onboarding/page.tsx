"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { 
  ArrowRight, 
  Loader2,
  ShieldCheck,
  ArrowLeft,
  Check
} from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
export default function IdentitySetupPage() {
  //if serach params hash not there redirect to logi
 const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isAgreed, setIsAgreed] = useState(true)

  const handleComplete = () => {
    if (!isAgreed) return
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      router.push("/dashboard")
    }, 1500)
  }

  return (
    <div className="h-screen bg-white flex overflow-hidden">
      {/* Left Sidebar - Fixed positioning */}
      <div className="hidden lg:flex w-[480px] bg-[#001e3c] flex-col relative overflow-hidden shrink-0 h-full">
        <div className="absolute top-[-10%] right-[-5%] w-[100%] h-[40%] bg-blue-400/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[80%] h-[40%] bg-indigo-500/10 blur-[100px] rounded-full" />
        
        <div className="relative z-10 flex flex-col h-full p-16">
          <div className="space-y-1.5 mb-20">
            <h2 className="text-3xl font-bold tracking-tight text-white/95 leading-none">Executive CRM</h2>
            <p className="text-[10px] uppercase tracking-[0.4em] text-blue-400 font-black opacity-90">Onboarding Phase 01</p>
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
                <p className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-black">Editorial Management Protocol</p>
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

      {/* Main Content Area - Scrollable and Balanced Width */}
      <div className="flex-1 overflow-y-auto bg-white lg:bg-[#F8FAFC]">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1] }}
          className="max-w-[1100px] mx-auto w-full py-20 px-10 md:px-20"
        >
          <div className="mb-14">
            <h1 className="text-[52px] font-semibold text-[#001e3c] tracking-tight mb-4">Setup your identity</h1>
            <p className="text-zinc-500 font-medium max-w-xl leading-relaxed text-lg">
              Welcome to the executive suite. To provide you with a tailored management experience, please confirm your company&apos;s core credentials.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12">
            {[
              { label: "Company Name", placeholder: "Acme Corporation" },
              { label: "Owner Name", placeholder: "Eleanor Vance" },
              { label: "Business Email", placeholder: "executive@company.com" },
              { label: "Phone Number", placeholder: "+1 (555) 000-0000" },
              { label: "VAT Number", placeholder: "IE 1234567T" }
            ].map((field, i) => (
              <div key={i} className="group space-y-2 relative">
                <Label className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-600 ml-0.5">
                  {field.label} <span className="text-red-500 ml-0.5">*</span>
                </Label>
                <div className="relative">
                  <Input 
                    placeholder={field.placeholder} 
                    className="h-12 bg-zinc-50/50 border-t-0 border-x-0 border-b border-zinc-400 rounded-none px-3 shadow-none focus-visible:ring-0 focus-visible:border-transparent transition-all placeholder:text-zinc-300 font-medium text-zinc-900 text-base" 
                  />
                  <span className="absolute bottom-[-1px] left-1/2 w-0 h-[1.5px] bg-[#001e3c] transition-all duration-500 ease-out group-focus-within:left-0 group-focus-within:w-full" />
                </div>
              </div>
            ))}

            <div className="group space-y-2 md:col-span-2 relative mt-4">
              <Label className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-600 ml-0.5">
                HQ Address <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <div className="relative">
                <Input 
                  placeholder="123 Editorial Way, Suite 400, New York, NY" 
                  className="h-12 bg-zinc-50/50 border-t-0 border-x-0 border-b border-zinc-400 rounded-none px-3 shadow-none focus-visible:ring-0 focus-visible:border-transparent transition-all placeholder:text-zinc-300 font-medium text-zinc-900 text-base" 
                />
                <span className="absolute bottom-[-1px] left-1/2 w-0 h-[1.5px] bg-[#001e3c] transition-all duration-500 ease-out group-focus-within:left-0 group-focus-within:w-full" />
              </div>
              <p className="text-[11px] text-zinc-400 font-medium pt-2 ml-0.5">Include building and floor numbers for document accuracy.</p>
            </div>
          </div>

          <div 
            onClick={() => setIsAgreed(!isAgreed)}
            className={cn(
              "mt-16 p-6 border rounded-2xl flex items-start gap-5 transition-all cursor-pointer group hover:bg-white/50",
              isAgreed ? "bg-zinc-50 border-zinc-100" : "bg-red-50/30 border-red-200/50"
            )}
          >
            <div className={cn(
              "h-6 w-6 flex items-center justify-center rounded-md shrink-0 transition-all border-2",
              isAgreed ? "bg-[#001e3c] border-[#001e3c]" : "bg-white border-zinc-300 group-hover:border-zinc-400"
            )}>
              {isAgreed && <Check className="h-4 w-4 text-white" />}
            </div>
            <div className="space-y-1">
              <p className="text-[13px] text-zinc-700 leading-relaxed font-semibold">
                By completing this setup, you acknowledge that the data provided will be used for official document generation and internal reporting. 
              </p>
              <p className="text-[11px] text-zinc-400 font-medium">Agreement is required to initialize the executive protocol.</p>
            </div>
          </div>

          <div className="mt-20 flex items-center justify-between">
            <button className="text-[11px] font-bold text-zinc-400 hover:text-[#001e3c] flex items-center gap-3 transition-colors uppercase tracking-[0.2em] group">
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Save draft & Exit
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
                  <span>Complete Setup</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  )}
