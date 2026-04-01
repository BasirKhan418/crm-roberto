import { randomUUID } from "crypto";

// Generate a new secure token for a sign link 
export function generateSignToken(): string {
  return randomUUID();
}

// Generate expiry date — default 30 days from now
export function generateTokenExpiry(days = 30): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// Check if a token is still valid
export function isTokenExpired(expiry: Date | null): boolean {
  if (!expiry) {
    return true;
  }

  return new Date() > expiry;
}

// Build the full public sign URL
export function buildSignUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/sign/${token}`;
}
