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
import { useLocale } from '@/components/providers/locale-provider';
import { hasPermission } from '@/lib/permissions';

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

const ROLE_OPTIONS = [
  'administrator',
  'manager',
  'standard_user',
  'secretary',
  'technician',
  'read_only',
  'external_accountant',
] as const;

const ROLE_LABELS = {
  en: {
    administrator: 'Administrator',
    manager: 'Manager',
    standard_user: 'Standard user',
    secretary: 'Secretary',
    technician: 'Technician',
    read_only: 'Read-only',
    external_accountant: 'External accountant',
  },
  fr: {
    administrator: 'Administrateur',
    manager: 'Manager',
    standard_user: 'Utilisateur standard',
    secretary: 'Secretaire',
    technician: 'Technicien',
    read_only: 'Lecture seule',
    external_accountant: 'Comptable externe',
  },
} as const;

const texts = {
  en: {
    pageTitle: 'Company Users',
    pageDescription: 'Invite users and manage role or account access in your company workspace.',
    unauthorized: 'You do not have permission to manage users.',
    unauthorizedHelp: 'Ask an administrator to grant access.',
    inviteTitle: 'Invite User',
    inviteDescription: 'Send a secure invitation link and assign role-based access before first login.',
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
    revoke: 'Revoke',
    makeReadOnly: 'Set read-only',
    makeStandard: 'Set standard',
    copiedInvite: 'Invitation link copied.',
    createdInvite: 'Invitation created successfully.',
    inviteEmailSent: 'Invitation email sent successfully.',
    inviteEmailSentAndCopied: 'Invitation email sent and link copied.',
    inviteEmailFailed: 'Invitation created, but email delivery failed. Share the link manually.',
    inviteEmailFailedAndCopied:
      'Invitation created, email delivery failed, and link copied for manual sharing.',
    loadUsersFailed: 'Unable to load users.',
    updateUserFailed: 'Unable to update user.',
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
  },
  fr: {
    pageTitle: 'Utilisateurs de la societe',
    pageDescription: "Invitez des utilisateurs et gerez les roles ou l'acces de votre espace entreprise.",
    unauthorized: "Vous n'avez pas l'autorisation de gerer les utilisateurs.",
    unauthorizedHelp: "Demandez l'acces a un administrateur.",
    inviteTitle: 'Inviter un utilisateur',
    inviteDescription:
      "Envoyez un lien d'invitation securise et attribuez un role avant la premiere connexion.",
    emailLabel: 'E-mail',
    nameLabel: 'Nom (optionnel)',
    roleLabel: 'Role',
    inviteAction: "Envoyer l'invitation",
    usersTitle: 'Utilisateurs',
    usersDescription: "Utilisateurs actifs et invites dans votre entreprise.",
    emptyUsers: "Aucun utilisateur trouve pour l'instant.",
    nameColumn: 'Nom',
    emailColumn: 'E-mail',
    roleColumn: 'Role',
    statusColumn: 'Statut',
    invitationColumn: 'Invitation',
    actionsColumn: 'Actions',
    suspend: 'Suspendre',
    activate: 'Activer',
    revoke: 'Revoquer',
    makeReadOnly: 'Passer en lecture seule',
    makeStandard: 'Passer standard',
    copiedInvite: "Lien d'invitation copie.",
    createdInvite: 'Invitation creee avec succes.',
    inviteEmailSent: "E-mail d'invitation envoye avec succes.",
    inviteEmailSentAndCopied: "E-mail d'invitation envoye et lien copie.",
    inviteEmailFailed:
      "Invitation creee, mais l'envoi de l'e-mail a echoue. Partagez le lien manuellement.",
    inviteEmailFailedAndCopied:
      "Invitation creee, e-mail non envoye, lien copie pour partage manuel.",
    loadUsersFailed: 'Impossible de charger les utilisateurs.',
    updateUserFailed: "Impossible de mettre a jour l'utilisateur.",
    active: 'Actif',
    suspended: 'Suspendu',
    pending: 'En attente',
    accepted: 'Acceptee',
    revoked: 'Revoquee',
    refresh: 'Actualiser',
    invitationLinkLabel: "Dernier lien d'invitation",
    invitationEmailStatusLabel: "Envoi e-mail",
    invitationEmailSentStatus: 'Envoye',
    invitationEmailFailedStatus: 'Echec',
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
    role: 'standard_user',
  });

  const canViewUsers = useMemo(() => hasPermission(user?.role, 'users.view'), [user?.role]);
  const canInviteUsers = useMemo(() => hasPermission(user?.role, 'users.invite'), [user?.role]);
  const canUpdateUsers = useMemo(
    () => hasPermission(user?.role, 'users.update_role') || hasPermission(user?.role, 'users.revoke'),
    [user?.role]
  );

  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch('/api/settings/users', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(result.message || t.loadUsersFailed);
        return;
      }
      setUsers((result.users || []) as CompanyUser[]);
    } catch {
      toast.error(t.loadUsersFailed);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [t.loadUsersFailed]);

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

      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(result.message || t.updateUserFailed);
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

      setInviteForm({ email: '', name: '', role: 'standard_user' });
      void loadUsers();
    } catch {
      toast.error(t.updateUserFailed);
    } finally {
      setIsInviting(false);
    }
  }

  async function updateUser(userId: string, payload: Record<string, unknown>) {
    if (!canUpdateUsers) return;

    try {
      const response = await fetch('/api/settings/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...payload }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(result.message || t.updateUserFailed);
        return;
      }
      void loadUsers();
    } catch {
      toast.error(t.updateUserFailed);
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
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                    return (
                      <tr key={companyUser._id} className="border-b align-top">
                        <td className="px-2 py-3 font-medium">{companyUser.name || '-'}</td>
                        <td className="px-2 py-3 text-muted-foreground">{companyUser.email}</td>
                        <td className="px-2 py-3">{roleLabels[companyUser.role as keyof typeof roleLabels] || companyUser.role}</td>
                        <td className="px-2 py-3">
                          <Badge variant={isSuspended ? 'destructive' : 'default'}>
                            {isSuspended ? t.suspended : t.active}
                          </Badge>
                        </td>
                        <td className="px-2 py-3">
                          <InvitationBadge status={companyUser.invitationStatus} locale={locale} />
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!canUpdateUsers}
                              onClick={() =>
                                void updateUser(companyUser._id, {
                                  account_status: isSuspended ? 'active' : 'suspended',
                                })
                              }
                            >
                              {isSuspended ? t.activate : t.suspend}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!canUpdateUsers}
                              onClick={() =>
                                void updateUser(companyUser._id, {
                                  role: companyUser.role === 'read_only' ? 'standard_user' : 'read_only',
                                })
                              }
                            >
                              {companyUser.role === 'read_only' ? t.makeStandard : t.makeReadOnly}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={!canUpdateUsers}
                              onClick={() => void updateUser(companyUser._id, { revokeAccess: true })}
                            >
                              {t.revoke}
                            </Button>
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
    </div>
  );
}
