import { randomInt } from "crypto";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

import getUserByEmail from "@/db/repository/getUserByEmail";
import { SendForgotPasswordEmail } from "@/emails/auth/forgotEmail";
import { resolveLocaleFromRequest } from "@/lib/i18n/locale";
import { buildValidationError } from "@/utils/api/validation";
import { generateOtp } from "@/utils/otp/generateOtp";
import { verifyOtp } from "@/utils/otp/verifyotp";
import { forgotPasswordSchema } from "@/validators/forgot.schema";

export const runtime = "nodejs";

const ACCOUNTANT_FORGOT_PREFIX = "accountant-forgot";
const GENERIC_SUCCESS_MESSAGE = "If that email is registered, a reset code has been sent.";

const maskEmail = (value: string) => {
  const [local, domain] = value.split("@");
  if (!domain) return "invalid-email";
  if (local.length <= 2) return `${local[0] ?? "*"}*@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
};

function buildAccountantForgotKey(email: string) {
  return `${ACCOUNTANT_FORGOT_PREFIX}:${email.toLowerCase()}`;
}

async function getAccountantUserByEmail(email: string) {
  const result = await getUserByEmail(email);
  if (!result.success || !result.user || result.user.role !== "external_accountant") {
    return null;
  }

  return result.user;
}

export async function POST(request: NextRequest) {
  try {
    const { email, status, otp, locale: rawLocale } = await request.json() as {
      email: string;
      status?: "forgot" | "verify";
      otp?: string;
      locale?: string;
    };

    const locale = resolveLocaleFromRequest(request, { rawLocale });
    const parseResult = forgotPasswordSchema.safeParse({ email, status, otp });
    if (!parseResult.success) {
      return NextResponse.json(buildValidationError(parseResult.error), { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (status === "forgot") {
      const accountantUser = await getAccountantUserByEmail(normalizedEmail);
      if (!accountantUser) {
        return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE, success: true }, { status: 200 });
      }

      console.info("[accountant-forgot] request-received", {
        email: maskEmail(normalizedEmail),
        locale,
      });

      const generatedOtp = randomInt(100000, 1000000).toString();
      const ttl = 5 * 60;
      const otpResult = await generateOtp(buildAccountantForgotKey(normalizedEmail), generatedOtp, ttl);
      if (!otpResult.success) {
        if (otpResult.reason === "rate_limit" || otpResult.reason === "cooldown") {
          const retryAfterSeconds = otpResult.retryAfterSeconds ?? 5 * 60;
          return NextResponse.json(
            {
              message: otpResult.message,
              success: false,
              rateLimit: {
                maxRequests: 5,
                windowSeconds: 5 * 60,
                retryAfterSeconds,
                reason: otpResult.reason,
              },
            },
            {
              status: 429,
              headers: {
                "Retry-After": String(retryAfterSeconds),
              },
            }
          );
        }

        return NextResponse.json({ message: otpResult.message, success: false }, { status: 503 });
      }

      const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      const resetUrl = `${appBaseUrl}/accountant-portal/forgot-password?email=${encodeURIComponent(normalizedEmail)}&otp=${encodeURIComponent(generatedOtp)}`;
      const emailSendResult = await SendForgotPasswordEmail({ email: normalizedEmail, otp: generatedOtp, locale, resetUrl });
      if (!emailSendResult.success) {
        console.error("[accountant-forgot] email-send-failed", {
          email: maskEmail(normalizedEmail),
          locale,
          appBaseUrl,
        });
        return NextResponse.json({ message: "Failed to send reset email. Please try again.", success: false }, { status: 500 });
      }

      console.info("[accountant-forgot] email-send-success", {
        email: maskEmail(normalizedEmail),
        locale,
      });

      return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE, success: true }, { status: 200 });
    }

    if (status === "verify") {
      const accountantUser = await getAccountantUserByEmail(normalizedEmail);
      if (!accountantUser) {
        return NextResponse.json({ message: "Invalid or expired reset code", success: false }, { status: 400 });
      }

      if (typeof otp !== "string" || !otp.trim()) {
        return NextResponse.json({ message: "OTP is required", success: false }, { status: 400 });
      }

      const verifyResult = await verifyOtp(buildAccountantForgotKey(normalizedEmail), otp);
      if (!verifyResult.success) {
        return NextResponse.json(
          { message: verifyResult.message, success: false },
          { status: verifyResult.reason === "store_unavailable" ? 503 : 400 }
        );
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        console.error("[accountant-forgot] JWT_SECRET missing");
        return NextResponse.json({ message: "Server configuration error", success: false }, { status: 500 });
      }

      const token = jwt.sign({ email: normalizedEmail, purpose: "accountant_password_reset" }, jwtSecret, { expiresIn: "15m" });
      return NextResponse.json({ message: "OTP verified successfully", success: true, token }, { status: 200 });
    }

    return NextResponse.json({ message: "Invalid status value", success: false }, { status: 400 });
  } catch (error) {
    console.error("[accountant-forgot] unhandled-error", error);
    return NextResponse.json({ message: `Error occurred while processing forgot password request: ${error}`, success: false }, { status: 500 });
  }
}