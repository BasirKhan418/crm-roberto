export interface AddressDetails {
  streetNumber?: string | null;
  streetName?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
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
 * Line 2: postal code + city + country
 */
export function formatStructuredAddress(details?: AddressDetails | null): string | null {
  if (!hasStructuredAddress(details)) return null;

  const streetParts = [details!.streetNumber, details!.streetName].map((p) => (p ?? '').trim()).filter(Boolean);
  const line1 = streetParts.join(' ');
  const line2Parts = [details!.postalCode, details!.city, details!.country].map((p) => (p ?? '').trim()).filter(Boolean);
  const line2 = line2Parts.join(' ');

  const combined = [line1, line2].filter(Boolean).join(', ');
  return combined || null;
}
