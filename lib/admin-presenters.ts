import type { CompanyFeatureKey } from '@/lib/company-features';

export type AdminPresenterLocale = 'en' | 'fr';

type ConnectionEventTone = 'green' | 'red' | 'amber' | 'blue' | 'slate';

type ConnectionEventMeta = {
  title: string;
  description: string;
  shortLabel: string;
  tone: ConnectionEventTone;
};

const CONNECTION_EVENT_LABELS: Record<AdminPresenterLocale, Record<string, ConnectionEventMeta>> = {
  en: {
    login_success: { title: 'CRM login succeeded', description: 'A company user signed in successfully.', shortLabel: 'CRM login success', tone: 'green' },
    login_failed: { title: 'CRM login failed', description: 'Someone tried to sign in with incorrect credentials.', shortLabel: 'CRM login failed', tone: 'red' },
    logout: { title: 'User logged out', description: 'A user ended their session.', shortLabel: 'Logout', tone: 'slate' },
    portal_login_success: { title: 'Accountant login succeeded', description: 'An external accountant entered the portal.', shortLabel: 'Accountant login success', tone: 'green' },
    portal_login_failed: { title: 'Accountant login failed', description: 'An accountant portal login attempt failed.', shortLabel: 'Accountant login failed', tone: 'red' },
    force_logout: { title: 'Forced logout', description: 'Access was changed and the user session was forced out.', shortLabel: 'Forced logout', tone: 'amber' },
    revoke_access: { title: 'Access revoked', description: 'A pending invitation or user access was revoked.', shortLabel: 'Access revoked', tone: 'amber' },
    impersonation_start: { title: 'Support session started', description: 'A support impersonation session was started.', shortLabel: 'Support session start', tone: 'blue' },
    impersonation_stop: { title: 'Support session ended', description: 'A support impersonation session was ended.', shortLabel: 'Support session end', tone: 'blue' },
  },
  fr: {
    login_success: { title: 'Connexion CRM reussie', description: 'Un utilisateur entreprise s est connecte avec succes.', shortLabel: 'Connexion CRM reussie', tone: 'green' },
    login_failed: { title: 'Connexion CRM echouee', description: 'Une tentative de connexion avec des identifiants invalides a ete bloquee.', shortLabel: 'Connexion CRM echouee', tone: 'red' },
    logout: { title: 'Deconnexion utilisateur', description: 'Un utilisateur a mis fin a sa session.', shortLabel: 'Deconnexion', tone: 'slate' },
    portal_login_success: { title: 'Connexion comptable reussie', description: 'Un comptable externe a accede au portail.', shortLabel: 'Connexion comptable reussie', tone: 'green' },
    portal_login_failed: { title: 'Connexion comptable echouee', description: 'Une tentative de connexion au portail comptable a echoue.', shortLabel: 'Connexion comptable echouee', tone: 'red' },
    force_logout: { title: 'Deconnexion forcee', description: 'Les acces ont change et la session active a ete interrompue.', shortLabel: 'Deconnexion forcee', tone: 'amber' },
    revoke_access: { title: 'Acces revoque', description: 'Un acces utilisateur ou une invitation en attente a ete revoque.', shortLabel: 'Acces revoque', tone: 'amber' },
    impersonation_start: { title: 'Session support demarree', description: 'Une session d assistance a ete ouverte.', shortLabel: 'Session support ouverte', tone: 'blue' },
    impersonation_stop: { title: 'Session support terminee', description: 'Une session d assistance a ete fermee.', shortLabel: 'Session support fermee', tone: 'blue' },
  },
};

const FEATURE_LABELS: Record<AdminPresenterLocale, Record<CompanyFeatureKey, string>> = {
  en: {
    expenses: 'Expenses',
    tickets: 'Tickets',
    financialDashboard: 'Financial dashboard',
    accountantPortal: 'Accountant portal',
    exports: 'Exports',
    advancedRoles: 'Advanced roles',
  },
  fr: {
    expenses: 'Depenses',
    tickets: 'Tickets',
    financialDashboard: 'Tableau financier',
    accountantPortal: 'Portail comptable',
    exports: 'Exports',
    advancedRoles: 'Roles avances',
  },
};

const COMPANY_STATUS_LABELS = {
  en: {
    active: 'Active',
    suspended: 'Suspended',
  },
  fr: {
    active: 'Active',
    suspended: 'Suspendue',
  },
} as const;

const USER_ACCOUNT_STATUS_LABELS: Record<AdminPresenterLocale, Record<string, string>> = {
  en: {
    active: 'Active',
    inactive: 'Inactive',
    invited: 'Invited',
    suspended: 'Suspended',
    revoked: 'Revoked',
    pending: 'Pending',
  },
  fr: {
    active: 'Actif',
    inactive: 'Inactif',
    invited: 'Invitation envoyee',
    suspended: 'Suspendu',
    revoked: 'Revoque',
    pending: 'En attente',
  },
};

export function getConnectionEventMeta(eventType: string | null | undefined, locale: AdminPresenterLocale): ConnectionEventMeta {
  const fallback = locale === 'fr'
    ? { title: 'Evenement d acces', description: 'Un evenement de connexion ou d acces a ete enregistre.', shortLabel: 'Evenement d acces', tone: 'slate' as const }
    : { title: 'Access event', description: 'A sign-in or access event was recorded.', shortLabel: 'Access event', tone: 'slate' as const };

  if (!eventType) {
    return fallback;
  }

  return CONNECTION_EVENT_LABELS[locale][eventType] || {
    ...fallback,
    shortLabel: eventType,
  };
}

export function getConnectionEventLabel(eventType: string | null | undefined, locale: AdminPresenterLocale) {
  return getConnectionEventMeta(eventType, locale).shortLabel;
}

export function getCompanyFeatureLabel(featureKey: string, locale: AdminPresenterLocale) {
  return FEATURE_LABELS[locale][featureKey as CompanyFeatureKey] || featureKey;
}

export function getCompanyStatusLabel(status: string | null | undefined, locale: AdminPresenterLocale) {
  if (!status) {
    return locale === 'fr' ? 'Non renseigne' : 'Not recorded';
  }

  return COMPANY_STATUS_LABELS[locale][status as keyof typeof COMPANY_STATUS_LABELS.en] || status;
}

export function getUserAccountStatusLabel(status: string | null | undefined, locale: AdminPresenterLocale) {
  if (!status) {
    return locale === 'fr' ? 'Non renseigne' : 'Not recorded';
  }

  return USER_ACCOUNT_STATUS_LABELS[locale][status] || status;
}