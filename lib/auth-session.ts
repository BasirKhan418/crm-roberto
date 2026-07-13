import jwt from "jsonwebtoken";

type SignableAuthUser = {
  _id?: string | { toString(): string };
  id?: string | { toString(): string };
  name: string;
  email: string;
  locale?: "en" | "fr";
  isOnboardingComplete?: boolean;
  isEmailVerified?: boolean;
  role?: string;
  companyId?: string | null;
  kind?: string;
};

export type AuthTokenPayload = {
  sub: string;
  name: string;
  email: string;
  locale?: "en" | "fr";
  isOnboardingComplete?: boolean;
  isEmailVerified?: boolean;
  role?: string;
  companyId?: string | null;
  kind?: string;
  iat?: number;
  exp?: number;
};

export function signAuthToken(user: SignableAuthUser) {
  const subRaw = user._id || user.id;
  const sub = typeof subRaw === "string" ? subRaw : subRaw?.toString();
  if (!sub) {
    throw new Error("Cannot sign auth token without user id");
  }

  return jwt.sign(
    {
      sub,
      name: user.name,
      email: user.email,
      locale: user.locale,
      isOnboardingComplete: user.isOnboardingComplete,
      isEmailVerified: user.isEmailVerified,
      role: user.role,
      companyId: user.companyId ?? null,
      kind: user.kind,
    },
    process.env.JWT_SECRET || "",
    { expiresIn: "7d" }
  );
}
