export interface AddressDetails {
  streetNumber?: string | null;
  streetName?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}

/** Minimal client snapshot shape used across PDF/send API routes. */
export interface ClientSnapshotAddressFields {
  fullName: string;
  companyName?: string | null;
  address?: string | null;
  addressDetails?: AddressDetails | null;
  email?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
}

/**
 * Returns true if the addressDetails object has at least one non-empty field.
 */
export function hasStructuredAddress(details?: AddressDetails | null): boolean {
  if (!details) return false;
  return !!(details.streetNumber || details.streetName || details.postalCode || details.city || details.country);
}

/**
 * Formats structured address fields into a single display string.
 * Line 1: street number + street name
 * Line 2: postal code + city, country
 */
export function formatStructuredAddress(details?: AddressDetails | null): string | null {
  if (!hasStructuredAddress(details)) return null;

  const streetParts = [details!.streetNumber, details!.streetName].map((p) => (p ?? '').trim()).filter(Boolean);
  const line1 = streetParts.join(' ');
  const cityAndCountry = [details!.city, details!.country].map((p) => (p ?? '').trim()).filter(Boolean).join(', ');
  const line2 = [details!.postalCode, cityAndCountry].map((p) => (p ?? '').trim()).filter(Boolean).join(' ');

  const combined = [line1, line2].filter(Boolean).join('\n');
  return combined || null;
}

/**
 * Returns the structured address split into exactly two display lines:
 * line1: street number + street name  (e.g. "15 Rue de l'Industrie")
 * line2: postal code + city, country  (e.g. "L-8069 Bertrange, Luxembourg")
 * Returns null if no structured address data is present.
 */
export function getStructuredAddressLines(details?: AddressDetails | null): { line1: string; line2: string } | null {
  if (!hasStructuredAddress(details)) return null;

  const line1Parts = [details!.streetNumber, details!.streetName].map((p) => (p ?? '').trim()).filter(Boolean);
  const line1 = line1Parts.join(' ');
  const cityAndCountry = [details!.city, details!.country].map((p) => (p ?? '').trim()).filter(Boolean).join(', ');
  const line2 = [details!.postalCode, cityAndCountry].map((p) => (p ?? '').trim()).filter(Boolean).join(' ');

  if (!line1 && !line2) return null;
  return { line1, line2 };
}

/**
 * Extracts address fields from a raw Mongoose document's clientSnapshot,
 * returning a typed ClientSnapshotAddressFields object.
 */
export function extractClientSnapshot(raw: unknown): ClientSnapshotAddressFields {
  const s = raw as {
    fullName?: string;
    companyName?: string | null;
    address?: string | null;
    addressDetails?: AddressDetails | null;
    email?: string | null;
    phone?: string | null;
    vatNumber?: string | null;
  };
  return {
    fullName: s?.fullName ?? 'Client',
    companyName: s?.companyName ?? null,
    address: s?.address ?? null,
    addressDetails: s?.addressDetails ?? null,
    email: s?.email ?? null,
    phone: s?.phone ?? null,
    vatNumber: s?.vatNumber ?? null,
  };
}
