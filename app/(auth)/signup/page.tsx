"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowRight, Loader2, Eye, EyeOff, MailCheck, Building2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/components/providers/locale-provider";
import {
  createI18nKey as i18nKey,
  resolveTranslatedText,
} from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

const acceptSchema = z
  .object({
    name: z.string().min(1, i18nKey("validation.nameRequired")),
    password: z.string().min(8, i18nKey("validation.passwordMin8")),
    confirmPassword: z.string().min(1, i18nKey("validation.confirmPasswordRequired")),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: i18nKey("validation.passwordsDoNotMatch"),
  });

type AcceptValues = z.infer<typeof acceptSchema>;

type InvitationDetails = {
  email: string;
  name?: string;
  role: string;
  invitationExpiresAt: string;
  companyName?: string | null;
  companySlug?: string | null;
  companyLogoUrl?: string | null;
};

const roleLabels = {
  en: {
    administrator: "Admin",
    external_accountant: "Accountant",
  },
  fr: {
    administrator: "Admin",
    external_accountant: "Comptable",
  },
} as const;

function formatRole(role: string, locale: "en" | "fr") {
  const byLocale = roleLabels[locale];
  return byLocale[role as keyof typeof byLocale] || role.replace(/_/g, " ");
}

function formatInvitationExpiry(value: string | Date | null | undefined, locale: "en" | "fr") {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const messages = {
  en: {
    title: "Invitation Required",
    subtitle:
      "Account registration is managed by company invitation. Use your invitation link to activate access.",
    invitationPill: "Invitation only",
    waitForInvite: "No invitation link yet?",
    waitForInviteBody:
      "Ask your company administrator to invite you from Settings > Users. Once invited, open the invitation link to finish signup.",
    newCompanyPrompt: "Need to onboard a new company?",
    newCompanyCta: "Create workspace",
    alreadyAccount: "Already have an account?",
    loginCta: "Log In",
    acceptTitle: "Accept Invitation",
    acceptSubtitle: "Set your password to finish joining your company workspace.",
    invitedEmail: "Invited email",
    invitedRole: "Assigned role",
    invitationExpires: "Invitation expires",
    workspace: "Company workspace",
    workspaceUnknown: "Workspace name unavailable",
    workspaceLogoAlt: "Workspace logo",
    fullName: "Full name",
    password: "Password",
    confirmPassword: "Confirm password",
    submitAccept: "Activate account",
    validating: "Checking invitation...",
    invalidInvitation: "This invitation link is invalid or expired.",
    acceptSuccess: "Invitation accepted. Redirecting...",
    acceptFailed: "Could not accept invitation.",
  },
  fr: {
    title: "Invitation requise",
    subtitle:
      "La création de compte est gérée par invitation d'entreprise. Utilisez votre lien d'invitation pour activer l'accès.",
    invitationPill: "Invitation uniquement",
    waitForInvite: "Pas encore de lien d'invitation ?",
    waitForInviteBody:
      "Demandez à votre administrateur d'entreprise de vous inviter depuis Paramètres > Utilisateurs. Ensuite ouvrez le lien reçu pour terminer l'inscription.",
    newCompanyPrompt: "Besoin d'onboarder une nouvelle entreprise ?",
    newCompanyCta: "Créer un espace",
    alreadyAccount: "Vous avez déjà un compte ?",
    loginCta: "Connexion",
    acceptTitle: "Accepter l'invitation",
    acceptSubtitle:
      "Définissez votre mot de passe pour finaliser votre accès à l'espace entreprise.",
    invitedEmail: "E-mail invité",
    invitedRole: "Rôle attribué",
    invitationExpires: "Invitation valide jusqu'au",
    workspace: "Espace entreprise",
    workspaceUnknown: "Nom de l'espace indisponible",
    workspaceLogoAlt: "Logo de l'espace",
    fullName: "Nom complet",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    submitAccept: "Activer le compte",
    validating: "Vérification de l'invitation...",
    invalidInvitation: "Ce lien d'invitation est invalide ou expiré.",
    acceptSuccess: "Invitation acceptée. Redirection...",
    acceptFailed: "Impossible d'accepter l'invitation.",
  },
} as const;

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const t = messages[locale];

  const invitationToken = useMemo(() => searchParams.get("invitationToken") || "", [searchParams]);

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingInvitation, setIsLoadingInvitation] = useState(false);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AcceptValues>({
    resolver: zodResolver(acceptSchema),
    defaultValues: {
      name: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    async function loadInvitation() {
      if (!invitationToken) {
        setInvitation(null);
        setInvitationError(null);
        return;
      }

      setIsLoadingInvitation(true);
      setInvitationError(null);

      try {
        const response = await fetch(`/api/invitations/lookup?token=${encodeURIComponent(invitationToken)}`, {
          method: "GET",
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          setInvitation(null);
          setInvitationError(resolveTranslatedText(locale, result.message, t.invalidInvitation));
          return;
        }

        setInvitation(result.invitation as InvitationDetails);
        setValue("name", (result.invitation?.name as string | undefined) || "");
      } catch {
        setInvitation(null);
        setInvitationError(t.invalidInvitation);
      } finally {
        setIsLoadingInvitation(false);
      }
    }

    void loadInvitation();
  }, [invitationToken, locale, setValue, t.invalidInvitation]);

  async function onAccept(values: AcceptValues) {
    if (!invitationToken) {
      setInvitationError(t.invalidInvitation);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: invitationToken,
          name: values.name,
          password: values.password,
          confirmPassword: values.confirmPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(resolveTranslatedText(locale, result.message, t.acceptFailed));
        return;
      }

      toast.success(t.acceptSuccess);
      const redirectTo = typeof result?.data?.redirectTo === "string" ? result.data.redirectTo : "/dashboard";
      router.push(redirectTo);
    } catch {
      toast.error(t.acceptFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  const showInvitationAccept = Boolean(invitationToken);
  const workspaceName = invitation?.companyName || invitation?.companySlug || t.workspaceUnknown;
  const formattedExpiry = formatInvitationExpiry(invitation?.invitationExpiresAt, locale);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs">
          {t.invitationPill}
        </Badge>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-zinc-900">
          {showInvitationAccept ? t.acceptTitle : t.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {showInvitationAccept ? t.acceptSubtitle : t.subtitle}
        </p>
      </div>

      {!showInvitationAccept ? (
        <div className="space-y-5 rounded-xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-zinc-900 p-2 text-white">
              <MailCheck className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-900">{t.waitForInvite}</p>
              <p className="text-sm text-zinc-600">{t.waitForInviteBody}</p>
            </div>
          </div>
          <p className="text-center text-sm text-zinc-500">
            {t.alreadyAccount}{" "}
            <Link href="/login" className="font-semibold text-[#001e3c] hover:underline underline-offset-4">
              {t.loginCta}
            </Link>
          </p>
          <p className="text-center text-sm text-zinc-500">
            {t.newCompanyPrompt}{" "}
            <Link href="/workspace-setup" className="font-semibold text-[#001e3c] hover:underline underline-offset-4">
              {t.newCompanyCta}
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-linear-to-br from-white via-zinc-50 to-blue-50/60 text-sm shadow-[0_16px_38px_-28px_rgba(0,30,60,0.6)]">
            {isLoadingInvitation ? (
              <div className="flex items-center gap-2 p-4 text-zinc-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t.validating}</span>
              </div>
            ) : invitationError ? (
              <p className="p-4 font-medium text-red-600">{invitationError}</p>
            ) : invitation ? (
              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex items-center gap-3 rounded-xl border border-zinc-200/90 bg-white/85 p-3 backdrop-blur">
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-zinc-200">
                    <Building2 className="h-5 w-5 text-zinc-500" />
                    {invitation.companyLogoUrl ? (
                      // Tenant logos may come from dynamic external URLs not covered by Next image optimizer patterns.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={invitation.companyLogoUrl}
                        alt={t.workspaceLogoAlt}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{t.workspace}</p>
                    <p className="truncate text-base font-semibold text-zinc-900">{workspaceName}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-zinc-500">{t.invitedEmail}</p>
                    <p className="break-all font-medium text-zinc-800">{invitation.email}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-zinc-500">{t.invitedRole}</p>
                    <p className="wrap-break-word font-medium text-zinc-800">{formatRole(invitation.role, locale)}</p>
                  </div>
                  <div className="min-w-0 md:col-span-2">
                    <p className="text-xs uppercase tracking-wider text-zinc-500">{t.invitationExpires}</p>
                    <p className="wrap-break-word font-medium text-zinc-800">{formattedExpiry || "-"}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <form
            onSubmit={handleSubmit(onAccept)}
            className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_14px_28px_-24px_rgba(0,0,0,0.75)]"
          >
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {t.fullName}
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
              <Label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wider text-zinc-500"
              >
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
              <Label
                htmlFor="confirmPassword"
                className="text-xs font-semibold uppercase tracking-wider text-zinc-500"
              >
                {t.confirmPassword}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                className={cn(
                  "h-11 bg-zinc-50 border-zinc-200 text-zinc-900 rounded-lg focus-visible:ring-2 focus-visible:ring-[#001e3c]/20 focus-visible:border-[#001e3c] transition-all placeholder:text-zinc-300",
                  errors.confirmPassword && "border-red-400 focus-visible:ring-red-200 focus-visible:border-red-400"
                )}
                {...register("confirmPassword")}
              />
              {errors.confirmPassword ? (
                <p className="text-xs font-medium text-red-600">
                  {resolveTranslatedText(locale, errors.confirmPassword.message)}
                </p>
              ) : null}
            </div>

            <Button
              className="w-full h-11 bg-[#001e3c] hover:bg-[#002b54] text-white rounded-lg text-sm font-semibold transition-all active:scale-[0.98] shadow-sm mt-2"
              type="submit"
              disabled={isSubmitting || isLoadingInvitation || Boolean(invitationError)}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  {t.submitAccept}
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
