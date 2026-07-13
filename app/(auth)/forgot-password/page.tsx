"use client"

import { Suspense } from "react"

import { ForgotPasswordFlow } from "@/components/auth/forgot-password-flow"

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Chargement...</div>}>
      <ForgotPasswordFlow forgotApiPath="/api/forgot" resetApiPath="/api/reset" loginHref="/login" />
    </Suspense>
  )
}


