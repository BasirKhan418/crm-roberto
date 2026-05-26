'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MailPlus, RefreshCcw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import { useAuthMe } from '@/hooks/useAuthMe';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLocale } from '@/components/providers/locale-provider';
import { broadcastAuthRefresh } from '@/lib/auth-refresh';
import { resolveTranslatedError, resolveTranslatedText } from '@/lib/i18n/messages';
import { hasModuleActionAccess } from '@/lib/route-access';
import { COMPANY_ASSIGNABLE_ROLES } from '@/lib/permissions';

type CompanyUser = {
  _id: string;
  name?: string;
  email: string;
  role: string;
  account_status: 'active' | 'suspended';
  invitationStatus?: string;
  isEmailVerified?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
  accessRevokedAt?: string | null;
};

type InviteFormState = {
  email: string;
  name: string;
  role: string;
};

type UserActionType =
  | 'suspend'
  | 'activate'
  | 'set_role'
  | 'revoke_invitation'
  | 'unrevoke_invitation';

type PendingUserAction = {
  userId: string;
  userEmail: string;
  type: UserActionType;
  payload: Record<string, unknown>;
  destructive?: boolean;
};

const ROLE_OPTIONS = COMPANY_ASSIGNABLE_ROLES;

const ROLE_LABELS = {
  en: {
    administrator: 'Admin',
    manager: 'Manager',
    standard_user: 'Standard user',
    secretary: 'Secretary',
    technician: 'Technician',
    read_only: 'Read-only user',
    external_accountant: 'Accountant',
  },
  fr: {
    administrator: 'Admin',
    manager: 'Manager',
    standard_user: 'Utilisateur standard',
    secretary: 'Secretaire',
    technician: 'Technicien',
    read_only: 'Lecture seule',
    external_accountant: 'Comptable',
  },
} as const;

const texts = {
  en: {
    pageTitle: 'Company Users',
    pageDescription: 'Invite users and manage role or account access in your company workspace.',
    unauthorized: 'You do not have permission to manage users.',
    unauthorizedHelp: 'Ask an administrator to grant access.',
    inviteTitle: 'Invite User',
    inviteDescription: 'Send a secure invitation link and assign the right company role before first login.',
    emailLabel: 'Email',
    nameLabel: 'Name (optional)',
    roleLabel: 'Role',
    inviteAction: 'Send Invitation',
    usersTitle: 'Users',
    usersDescription: 'Active and invited users in your company.',
    emptyUsers: 'No users found in this company yet.',
    nameColumn: 'Name',
    emailColumn: 'Email',
    roleColumn: 'Role',
    statusColumn: 'Status',
    invitationColumn: 'Invitation',
    actionsColumn: 'Actions',
    suspend: 'Suspend',
    activate: 'Activate',
    revokeInvitation: 'Revoke invitation',
    unrevokeInvitation: 'Unrevoke invitation',
    makeAdmin: 'Set admin',
    makeAccountant: 'Set accountant',
    changeRole: (role: string) => `Set role to ${role}`,
    confirmActionTitle: 'Confirm action',
    confirmCancel: 'Cancel',
    confirmProceed: 'Proceed',
    copiedInvite: 'Invitation link copied.',
    createdInvite: 'Invitation created successfully.',
    inviteEmailSent: 'Invitation email sent successfully.',
    inviteEmailSentAndCopied: 'Invitation email sent and link copied.',
    inviteEmailFailed: 'Invitation created, but email delivery failed. Share the link manually.',
    inviteEmailFailedAndCopied:
      'Invitation created, email delivery failed, and link copied for manual sharing.',
    loadUsersFailed: 'Unable to load users.',
    updateUserFailed: 'Unable to update user.',
    selfActionProtected: 'You cannot edit your own role or access from this screen.',
    active: 'Active',
    suspended: 'Suspended',
    pending: 'Pending',
    accepted: 'Accepted',
    revoked: 'Revoked',
    refresh: 'Refresh',
    invitationLinkLabel: 'Last invitation link',
    invitationEmailStatusLabel: 'Email delivery',
    invitationEmailSentStatus: 'Sent',
    invitationEmailFailedStatus: 'Failed',
    suspendedHelp: 'Sign-in is blocked while this account is suspended.',
    revokedHelp: 'This invitation is revoked and cannot be used until restored.',
    confirmActionDescription: (actionLabel: string, userEmail: string) =>
      `${actionLabel}: ${userEmail}`,
  },
  fr: {
    pageTitle: 'Utilisateurs de la société',
    pageDescription: "Invitez des utilisateurs et gérez les rôles ou l'accès de votre espace entreprise.",
    unauthorized: "Vous n'avez pas l'autorisation de gérer les utilisateurs.",
    unauthorizedHelp: "Demandez l'accès à un administrateur.",
    inviteTitle: 'Inviter un utilisateur',
    inviteDescription:
      "Envoyez un lien d'invitation sécurisé et attribuez le bon rôle entreprise avant la première connexion.",
    emailLabel: 'E-mail',
    nameLabel: 'Nom (optionnel)',
    roleLabel: 'Rôle',
    inviteAction: "Envoyer l'invitation",
    usersTitle: 'Utilisateurs',
    usersDescription: "Utilisateurs actifs et invités dans votre entreprise.",
    emptyUsers: "Aucun utilisateur trouvé pour l'instant.",
    nameColumn: 'Nom',
    emailColumn: 'E-mail',
    roleColumn: 'Rôle',
    statusColumn: 'Statut',
    invitationColumn: 'Invitation',
    actionsColumn: 'Actions',
    suspend: 'Suspendre',
    activate: 'Activer',
    revokeInvitation: "Révoquer l'invitation",
    unrevokeInvitation: "Rétablir l'invitation",
    makeAdmin: 'Passer admin',
    makeAccountant: 'Passer comptable',
    changeRole: (role: string) => `Passer au rôle ${role}`,
    confirmActionTitle: "Confirmer l'action",
    confirmCancel: 'Annuler',
    confirmProceed: 'Continuer',
    copiedInvite: "Lien d'invitation copié.",
    createdInvite: 'Invitation créée avec succès.',
    inviteEmailSent: "E-mail d'invitation envoyé avec succès.",
    inviteEmailSentAndCopied: "E-mail d'invitation envoyé et lien copié.",
    inviteEmailFailed:
      "Invitation créée, mais l'envoi de l'e-mail a échoué. Partagez le lien manuellement.",
    inviteEmailFailedAndCopied:
      "Invitation créée, e-mail non envoyé, lien copié pour partage manuel.",
    loadUsersFailed: 'Impossible de charger les utilisateurs.',
    updateUserFailed: "Impossible de mettre à jour l'utilisateur.",
    selfActionProtected: "Vous ne pouvez pas modifier votre propre rôle ou accès depuis cet écran.",
    active: 'Actif',
    suspended: 'Suspendu',
    pending: 'En attente',
    accepted: 'Acceptée',
    revoked: 'Révoquée',
    refresh: 'Actualiser',
    invitationLinkLabel: "Dernier lien d'invitation",
    invitationEmailStatusLabel: "Envoi e-mail",
    invitationEmailSentStatus: 'Envoyé',
    invitationEmailFailedStatus: 'Échec',
    suspendedHelp: 'La connexion est bloquée tant que ce compte est suspendu.',
    revokedHelp: "Cette invitation est révoquée et inutilisable tant qu'elle n'est pas rétablie.",
    confirmActionDescription: (actionLabel: string, userEmail: string) =>
      `${actionLabel} : ${userEmail}`,
  },
} as const;

function InvitationBadge({ status, locale }: { status?: string; locale: 'en' | 'fr' }) {
  const t = texts[locale];
  const normalized = status || 'none';

  if (normalized === 'pending') return <Badge variant="secondary">{t.pending}</Badge>;
  if (normalized === 'accepted') return <Badge>{t.accepted}</Badge>;
  if (normalized === 'revoked') return <Badge variant="destructive">{t.revoked}</Badge>;

  return <Badge variant="outline">-</Badge>;
}

export default function SettingsUsersPage() {
  const { user, loading } = useAuthMe();
  const { locale } = useLocale();
  const t = texts[locale];
  const roleLabels = ROLE_LABELS[locale];

  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [lastInvitationLink, setLastInvitationLink] = useState('');
  const [lastInvitationEmailStatus, setLastInvitationEmailStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [inviteForm, setInviteForm] = useState<InviteFormState>({
    email: '',
    name: '',
    role: 'external_accountant',
  });
  const [pendingAction, setPendingAction] = useState<PendingUserAction | null>(null);
  const [isApplyingAction, setIsApplyingAction] = useState(false);

  const canViewUsers = useMemo(
    () => hasModuleActionAccess({ role: user?.role, modulePermissions: user?.modulePermissions, moduleKey: 'users', action: 'view' }),
    [user?.modulePermissions, user?.role]
  );
  const canInviteUsers = useMemo(
    () => hasModuleActionAccess({ role: user?.role, modulePermissions: user?.modulePermissions, moduleKey: 'users', action: 'create' }),
    [user?.modulePermissions, user?.role]
  );
  const canUpdateUsers = useMemo(
    () =>
      hasModuleActionAccess({ role: user?.role, modulePermissions: user?.modulePermissions, moduleKey: 'users', action: 'edit' }) ||
      hasModuleActionAccess({ role: user?.role, modulePermissions: user?.modulePermissions, moduleKey: 'users', action: 'delete' }) ||
      hasModuleActionAccess({ role: user?.role, modulePermissions: user?.modulePermissions, moduleKey: 'users', action: 'manage' }),
    [user?.modulePermissions, user?.role]
  );

  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch('/api/settings/users', { cache: 'no-store' });
      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
        users?: CompanyUser[];
      };
      if (!response.ok || !result.success) {
        toast.error(resolveTranslatedText(locale, result.message, t.loadUsersFailed));
        return;
      }
      setUsers(result.users || []);
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t.loadUsersFailed));
    } finally {
      setIsLoadingUsers(false);
    }
  }, [locale, t.loadUsersFailed]);

  useEffect(() => {
    if (!loading && canViewUsers) {
      void loadUsers();
    }
  }, [loading, canViewUsers, loadUsers]);

  async function onInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canInviteUsers) return;

    setIsInviting(true);
    try {
      const response = await fetch('/api/settings/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });

      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
        data?: {
          invitationUrl?: string;
          emailDelivery?: { success?: boolean; message?: string };
        };
      };
      if (!response.ok || !result.success) {
        toast.error(resolveTranslatedText(locale, result.message, t.updateUserFailed));
        return;
      }

      const invitationUrl = result?.data?.invitationUrl as string | undefined;
      const emailDelivery = result?.data?.emailDelivery as { success?: boolean; message?: string } | undefined;
      const emailSent = Boolean(emailDelivery?.success);

      let copied = false;
      if (invitationUrl) {
        setLastInvitationLink(invitationUrl);
        try {
          await navigator.clipboard.writeText(invitationUrl);
          copied = true;
        } catch {
          copied = false;
        }
      }

      if (emailDelivery) {
        setLastInvitationEmailStatus({
          success: emailSent,
          message: emailDelivery.message || '',
        });
      } else {
        setLastInvitationEmailStatus(null);
      }

      if (emailSent) {
        toast.success(copied ? t.inviteEmailSentAndCopied : t.inviteEmailSent);
      } else {
        toast.error(copied ? t.inviteEmailFailedAndCopied : t.inviteEmailFailed);
      }

      setInviteForm({ email: '', name: '', role: 'external_accountant' });
      void loadUsers();
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t.updateUserFailed));
    } finally {
      setIsInviting(false);
    }
  }

  async function updateUser(userId: string, payload: Record<string, unknown>) {
    if (!canUpdateUsers) return false;

    try {
      const response = await fetch('/api/settings/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...payload }),
      });
      const result = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !result.success) {
        toast.error(resolveTranslatedText(locale, result.message, t.updateUserFailed));
        return false;
      }
      broadcastAuthRefresh();
      void loadUsers();
      return true;
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t.updateUserFailed));
      return false;
    }
  }

  function queueUserAction(action: PendingUserAction) {
    if (!canUpdateUsers) return;
    setPendingAction(action);
  }

  function getActionLabel(action: PendingUserAction) {
    if (action.type === 'suspend') return t.suspend;
    if (action.type === 'activate') return t.activate;
    if (action.type === 'set_role') {
      const role = typeof action.payload.role === 'string' ? action.payload.role : '';
      return t.changeRole(roleLabels[role as keyof typeof roleLabels] || role);
    }
    if (action.type === 'unrevoke_invitation') return t.unrevokeInvitation;
    return t.revokeInvitation;
  }

  async function onConfirmPendingAction() {
    if (!pendingAction) return;

    setIsApplyingAction(true);
    try {
      const success = await updateUser(pendingAction.userId, pendingAction.payload);
      if (success) {
        setPendingAction(null);
      }
    } finally {
      setIsApplyingAction(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-65 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canViewUsers) {
    return (
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" />
            {t.unauthorized}
          </CardTitle>
          <CardDescription>{t.unauthorizedHelp}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{t.pageTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.pageDescription}</p>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">{t.inviteTitle}</CardTitle>
          <CardDescription>{t.inviteDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onInviteSubmit} className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="invite-email">{t.emailLabel}</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteForm.email}
                onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
                required
                disabled={!canInviteUsers || isInviting}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-name">{t.nameLabel}</Label>
              <Input
                id="invite-name"
                value={inviteForm.name}
                onChange={(event) => setInviteForm((prev) => ({ ...prev, name: event.target.value }))}
                disabled={!canInviteUsers || isInviting}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-role">{t.roleLabel}</Label>
              <select
                id="invite-role"
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
                value={inviteForm.role}
                onChange={(event) => setInviteForm((prev) => ({ ...prev, role: event.target.value }))}
                disabled={!canInviteUsers || isInviting}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4 flex items-center justify-between gap-3">
              <Button type="submit" disabled={!canInviteUsers || isInviting}>
                {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}
                {t.inviteAction}
              </Button>
              {lastInvitationLink ? (
                <div className="min-w-0 text-right text-xs text-muted-foreground">
                  <p className="font-medium">{t.invitationLinkLabel}</p>
                  <p className="truncate">{lastInvitationLink}</p>
                  {lastInvitationEmailStatus ? (
                    <p
                      className={`mt-1 truncate ${
                        lastInvitationEmailStatus.success ? 'text-emerald-600' : 'text-destructive'
                      }`}
                    >
                      {t.invitationEmailStatusLabel}: {lastInvitationEmailStatus.success
                        ? t.invitationEmailSentStatus
                        : t.invitationEmailFailedStatus}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">{t.usersTitle}</CardTitle>
            <CardDescription>{t.usersDescription}</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => void loadUsers()} disabled={isLoadingUsers}>
            <RefreshCcw className="h-4 w-4" />
            {t.refresh}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className="flex min-h-30 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.emptyUsers}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-190 text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2">{t.nameColumn}</th>
                    <th className="px-2 py-2">{t.emailColumn}</th>
                    <th className="px-2 py-2">{t.roleColumn}</th>
                    <th className="px-2 py-2">{t.statusColumn}</th>
                    <th className="px-2 py-2">{t.invitationColumn}</th>
                    <th className="px-2 py-2 text-right">{t.actionsColumn}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((companyUser) => {
                    const isSuspended = companyUser.account_status === 'suspended';
                    const isCurrentUser = companyUser._id === user?.id;
                    const invitationStatus = companyUser.invitationStatus || 'none';
                    const canToggleInvitationRevocation =
                      invitationStatus === 'pending' || invitationStatus === 'revoked';
                    const isInvitationRevoked = invitationStatus === 'revoked';
                    return (
                      <tr key={companyUser._id} className="border-b align-top">
                        <td className="px-2 py-3 font-medium">{companyUser.name || '-'}</td>
                        <td className="px-2 py-3 text-muted-foreground">{companyUser.email}</td>
                        <td className="px-2 py-3">{roleLabels[companyUser.role as keyof typeof roleLabels] || companyUser.role}</td>
                        <td className="px-2 py-3">
                          <Badge variant={isSuspended ? 'destructive' : 'default'}>
                            {isSuspended ? t.suspended : t.active}
                          </Badge>
                          {isSuspended ? (
                            <p className="mt-1 text-xs text-muted-foreground">{t.suspendedHelp}</p>
                          ) : null}
                        </td>
                        <td className="px-2 py-3">
                          <InvitationBadge status={companyUser.invitationStatus} locale={locale} />
                          {isInvitationRevoked ? (
                            <p className="mt-1 text-xs text-muted-foreground">{t.revokedHelp}</p>
                          ) : null}
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!canUpdateUsers || isCurrentUser || isApplyingAction}
                              title={isCurrentUser ? t.selfActionProtected : undefined}
                              onClick={() =>
                                queueUserAction({
                                  userId: companyUser._id,
                                  userEmail: companyUser.email,
                                  type: isSuspended ? 'activate' : 'suspend',
                                  payload: {
                                    account_status: isSuspended ? 'active' : 'suspended',
                                  },
                                  destructive: !isSuspended,
                                })
                              }
                            >
                              {isSuspended ? t.activate : t.suspend}
                            </Button>
                            <select
                              className="h-8 min-w-36 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                              value={companyUser.role}
                              disabled={!canUpdateUsers || isCurrentUser || isApplyingAction}
                              title={isCurrentUser ? t.selfActionProtected : undefined}
                              onChange={(event) => {
                                const nextRole = event.target.value;
                                if (!nextRole || nextRole === companyUser.role) return;
                                queueUserAction({
                                  userId: companyUser._id,
                                  userEmail: companyUser.email,
                                  type: 'set_role',
                                  payload: { role: nextRole },
                                });
                              }}
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>
                                  {roleLabels[role]}
                                </option>
                              ))}
                            </select>
                            {canToggleInvitationRevocation ? (
                              <Button
                                type="button"
                                variant={isInvitationRevoked ? 'outline' : 'destructive'}
                                size="sm"
                                disabled={!canUpdateUsers || isCurrentUser || isApplyingAction}
                                title={isCurrentUser ? t.selfActionProtected : undefined}
                                onClick={() =>
                                  queueUserAction({
                                    userId: companyUser._id,
                                    userEmail: companyUser.email,
                                    type: isInvitationRevoked ? 'unrevoke_invitation' : 'revoke_invitation',
                                    payload: { revokeAccess: !isInvitationRevoked },
                                    destructive: !isInvitationRevoked,
                                  })
                                }
                              >
                                {isInvitationRevoked ? t.unrevokeInvitation : t.revokeInvitation}
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open && !isApplyingAction) {
            setPendingAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmActionTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction
                ? t.confirmActionDescription(getActionLabel(pendingAction), pendingAction.userEmail)
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApplyingAction}>{t.confirmCancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!pendingAction || isApplyingAction}
              className={pendingAction?.destructive ? 'bg-destructive text-white hover:bg-destructive/90' : 'text-white'}
              onClick={(event) => {
                event.preventDefault();
                void onConfirmPendingAction();
              }}
            >
              {isApplyingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : t.confirmProceed}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
