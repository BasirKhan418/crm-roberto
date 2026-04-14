export type AppLocale = 'en' | 'fr';

function normalizeLocale(value: string | null | undefined): AppLocale | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'fr' || trimmed.startsWith('fr-')) {
    return 'fr';
  }

  if (trimmed === 'en' || trimmed.startsWith('en-')) {
    return 'en';
  }

  return null;
}

function localeFromAcceptLanguage(headerValue: string | null | undefined): AppLocale | null {
  if (!headerValue) {
    return null;
  }

  const parts = headerValue.split(',');
  for (const part of parts) {
    const token = part.split(';')[0]?.trim();
    const normalized = normalizeLocale(token);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function resolveLocaleFromValue(value: string | null | undefined, fallback: AppLocale = 'fr'): AppLocale {
  return normalizeLocale(value) ?? fallback;
}

export function resolveLocaleFromRequest(
  request: { headers: { get: (name: string) => string | null } },
  options?: { rawLocale?: string | null; fallback?: AppLocale }
): AppLocale {
  const fromRaw = normalizeLocale(options?.rawLocale ?? null);
  if (fromRaw) {
    return fromRaw;
  }

  const fromHeader = localeFromAcceptLanguage(request.headers.get('accept-language'));
  if (fromHeader) {
    return fromHeader;
  }

  return options?.fallback ?? 'fr';
}
