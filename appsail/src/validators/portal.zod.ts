import { z } from "zod";

export const requestOtpSchema = z.object({
  // NEW: preferred
  portal_public_slug: z.string().min(1).optional(),

  // old: allow temporarily (ROWID digits only if used)
  tenant_id: z.string().regex(/^\d+$/).optional(),

  order_number: z.string().min(1),
  channel: z.enum(["sms", "email"]),
  contact: z.string().min(3),
});

export const verifyOtpSchema = z.object({
  portal_public_slug: z.string().min(1).optional(),
  tenant_id: z.string().regex(/^\d+$/).optional(),

  order_number: z.string().min(1),
  channel: z.enum(["sms", "email"]),
  contact: z.string().min(3),
  otp: z.string().regex(/^\d{6}$/),
});
