// appsail/src/env.ts
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  TZ: z.string().default("Asia/Riyadh"),
  APP_BASE_URL: z.string().min(1),

  SECURITY_PEPPER: z.string().min(32),
  ENCRYPTION_KEY_B64: z.string().min(1),
  PORTAL_SESSION_SIGNING_KEY: z.string().min(1),

  OTP_TTL_SECONDS: z.coerce.number().int().positive(),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive(),
  OTP_LOCKOUT_SECONDS: z.coerce.number().int().positive(),
  OTP_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive(),
  OTP_RATE_LIMIT_MAX_IN_WINDOW: z.coerce.number().int().positive(),

  PORTAL_SESSION_TTL_SECONDS: z.coerce.number().int().positive(),
  PORTAL_SESSION_TOUCH_INTERVAL_SECONDS: z.coerce.number().int().positive(),

  DATA_RETENTION_DAYS: z.coerce.number().int().positive(),

  // ✅ optional (only needed when we implement OAuth step)
  SALLA_CLIENT_ID: z.string().optional(),
  SALLA_CLIENT_SECRET: z.string().optional(),

  // ✅ strongly recommended to keep URLs configurable
  SALLA_OAUTH_AUTHORIZE_URL: z.string().optional(),
  SALLA_OAUTH_TOKEN_URL: z.string().optional(),
  SALLA_API_BASE_URL: z.string().optional(),
  SALLA_OAUTH_REDIRECT_URI: z.string().optional(),
});

export const env = schema.parse(process.env);
