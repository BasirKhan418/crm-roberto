"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useLocale } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createI18nKey as i18nKey, resolveTranslatedText } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

const workspaceSetupSchema = z
  .object({
    companyName: z.string().min(1, i18nKey("validation.companyNameRequired")),
    name: z.string().min(1, i18nKey("validation.nameRequired")),
    email: z.string().email(i18nKey("validation.invalidEmailAddress")),
    password: z.string().min(8, i18nKey("validation.passwordMin8")),
    confirmPassword: z.string().min(1, i18nKey("validation.confirmPasswordRequired")),
    bootstrapCode: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: i18nKey("validation.passwordsDoNotMatch"),
  });

type WorkspaceSetupValues = z.infer<typeof workspaceSetupSchema>;

const messages = {
  en: {
    heading: "Create Company Workspace",
    subtitle: "Use this flow to onboard a new company owner while keeping member signup invitation-only.",
    companyName: "Company name",
    ownerName: "Owner name",
    email: "Owner email",
    password: "Password",
    confirmPassword: "Confirm password",
    bootstrapCode: "Setup code (if provided)",
    submit: "Create workspace",
    success: "Workspace created. Redirecting to onboarding...",
    failed: "Unable to create workspace.",
    haveAccount: "Already have an account?",
    login: "Log in",
    haveInvite: "Have an invitation link?",
    invitationSignup: "Accept invitation",
  },
  fr: {
    heading: "Creer un espace entreprise",
    subtitle: "Utilisez ce flux pour onboarder un nouveau proprietaire d'entreprise tout en gardant l'inscription des membres par invitation.",
    companyName: "Nom de l'entreprise",
    ownerName: "Nom du proprietaire",
    email: "E-mail du proprietaire",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    bootstrapCode: "Code de creation (si fourni)",
    submit: "Creer l'espace",
    success: "Espace cree. Redirection vers l'onboarding...",
    failed: "Impossible de creer l'espace.",
    haveAccount: "Vous avez deja un compte ?",
    login: "Connexion",
    haveInvite: "Vous avez un lien d'invitation ?",
    invitationSignup: "Accepter l'invitation",
  },
} as const;

export default function WorkspaceSetupPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = messages[locale];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkspaceSetupValues>({
    resolver: zodResolver(workspaceSetupSchema),
    defaultValues: {
      companyName: "",
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      bootstrapCode: "",
    },
  });

  async function onSubmit(values: WorkspaceSetupValues) {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/workspace-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(resolveTranslatedText(locale, result.message, t.failed));
        return;
      }

      toast.success(t.success);
      const redirectTo = typeof result?.data?.redirectTo === "string" ? result.data.redirectTo : "/onboarding";
      router.push(redirectTo);
    } catch {
      toast.error(t.failed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-zinc-900">{t.heading}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="companyName" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t.companyName}
          </Label>
          <Input
            id="companyName"
            autoComplete="organization"
            className={cn(
              "h-11 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300",
              errors.companyName && "border-red-400 focus-visible:ring-red-200 focus-visible:border-red-400"
            )}
            {...register("companyName")}
          />
          {errors.companyName ? (
            <p className="text-xs font-medium text-red-600">{resolveTranslatedText(locale, errors.companyName.message)}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t.ownerName}
          </Label>
          <Input
            id="name"
            autoComplete="name"
            className={cn(
              "h-11 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300",
              errors.name && "border-red-400 focus-visible:ring-red-200 focus-visible:border-red-400"
            )}
            {...register("name")}
          />
          {errors.name ? (
            <p className="text-xs font-medium text-red-600">{resolveTranslatedText(locale, errors.name.message)}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t.email}
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            className={cn(
              "h-11 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300",
              errors.email && "border-red-400 focus-visible:ring-red-200 focus-visible:border-red-400"
            )}
            {...register("email")}
          />
          {errors.email ? (
            <p className="text-xs font-medium text-red-600">{resolveTranslatedText(locale, errors.email.message)}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t.password}
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className={cn(
                "h-11 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300 pr-10",
                errors.password && "border-red-400 focus-visible:ring-red-200 focus-visible:border-red-400"
              )}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
              aria-label="toggle password visibility"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? (
            <p className="text-xs font-medium text-red-600">{resolveTranslatedText(locale, errors.password.message)}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t.confirmPassword}
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              className={cn(
                "h-11 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300 pr-10",
                errors.confirmPassword && "border-red-400 focus-visible:ring-red-200 focus-visible:border-red-400"
              )}
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
              aria-label="toggle confirm password visibility"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword ? (
            <p className="text-xs font-medium text-red-600">{resolveTranslatedText(locale, errors.confirmPassword.message)}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bootstrapCode" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t.bootstrapCode}
          </Label>
          <Input
            id="bootstrapCode"
            className="h-11 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300"
            {...register("bootstrapCode")}
          />
        </div>

        <Button
          className="w-full h-11 bg-[#001e3c] hover:bg-[#002b54] text-white rounded-lg text-sm font-semibold transition-all active:scale-[0.98] shadow-sm mt-2"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="flex items-center gap-2">
              {t.submit}
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>

      <div className="space-y-2 text-center text-sm text-zinc-500">
        <p>
          {t.haveInvite}{" "}
          <Link href="/signup" className="font-semibold text-[#001e3c] hover:underline underline-offset-4">
            {t.invitationSignup}
          </Link>
        </p>
        <p>
          {t.haveAccount}{" "}
          <Link href="/login" className="font-semibold text-[#001e3c] hover:underline underline-offset-4">
            {t.login}
          </Link>
        </p>
      </div>
    </div>
  );
}
