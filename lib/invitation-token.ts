import { createHash, randomBytes } from "crypto";

const INVITATION_TOKEN_BYTES = 32;

export function generateInvitationToken() {
  return randomBytes(INVITATION_TOKEN_BYTES).toString("hex");
}

export function hashInvitationToken(token: string) {
  const secret = process.env.INVITATION_TOKEN_SECRET || process.env.JWT_SECRET || "invitation-secret";
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}

export function createInvitationExpiry(hours = 72) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + hours);
  return expiresAt;
}
