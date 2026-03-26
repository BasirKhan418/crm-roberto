import {z} from "zod";

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid business email address."),
  status: z.enum(["forgot","verify","reset"], {
    message: "Invalid status value"
  }).optional(),
  otp: z.string().min(6, "OTP must be at least 6 characters").optional(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Please enter a valid business email address."),
  password: z.string().min(8, "Password must be at least 8 characters"),
  token: z.string().min(1, "Token is required"),
});