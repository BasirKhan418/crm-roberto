export interface AddressDetails {
  streetNumber?: string | null;
  streetName?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface ClientSnapshotAddressFields {
  fullName: string;
  companyName?: string | null;
  address?: string | null;
  addressDetails?: AddressDetails | null;
  email?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
}

export function hasStructuredAddress(details?: AddressDetails | null): boolean {
  if (!details) return false;
  return !!(details.streetNumber || details.streetName || details.postalCode || details.city || details.country);
}

export function formatStructuredAddress(details?: AddressDetails | null): string | null {
  if (!hasStructuredAddress(details)) return null;

  const streetParts = [details!.streetNumber, details!.streetName].map((p) => (p ?? '').trim()).filter(Boolean);
  const line1 = streetParts.join(' ');
  const cityPostal = [details!.postalCode, details!.city].map((p) => (p ?? '').trim()).filter(Boolean).join(' ');
  const country = (details!.country ?? '').trim();
  const line2 = cityPostal && country ? `${cityPostal}, ${country}` : (cityPostal || country);

  const combined = [line1, line2].filter(Boolean).join('\n');
  return combined || null;
}


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
