import { z } from "zod";

const num = (def: number) =>
  z.preprocess((v) => {
    if (v === undefined || v === null || String(v).trim() === "") return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }, z.number());

const schema = z
  .object({
    NODE_ENV: z.string().optional(),
    TZ: z.string().optional(),

    CATALYST_ENV: z.string().optional(),

    APP_BASE_URL: z.string().url().optional(),

    SALLA_OAUTH_MODE: z.enum(["easy", "custom"]).optional(),

    SALLA_APP_ID: z.string().min(1).optional(),
    SALLA_INSTALL_URL_BASE: z.string().optional(),
    SALLA_INSTALL_URL_BASE_URL: z.string().optional(),

    SALLA_CLIENT_ID: z.string().min(1).optional(),
    SALLA_CLIENT_SECRET: z.string().min(1).optional(),
    SALLA_OAUTH_TOKEN_URL: z.string().url().optional(),

    SALLA_OAUTH_AUTHORIZE_URL: z.string().url().optional(),
    SALLA_OAUTH_REDIRECT_URI: z.string().url().optional(),
    SALLA_OAUTH_SCOPE: z.string().optional(),

    SALLA_TOKEN_REFRESH_SKEW_SECONDS: num(120),

    SALLA_API_BASE_URL: z.string().url().optional(),
    SALLA_VERIFY_ENDPOINT: z.string().optional(),

    SALLA_WEBHOOK_SECRET_KEY: z.string().optional(),
    SALLA_WEBHOOK_SECRET: z.string().optional(),
    WEBHOOK_SECRET: z.string().optional(),

    DEV_AUTO_PROVISION_TENANT: z.string().optional(),

    SECURITY_PEPPER: z.string().min(1),
    ENCRYPTION_KEY_B64: z.string().min(1),

    MERCHANT_DEBUG_KEY: z.string().optional(),

    OTP_RATE_LIMIT_WINDOW_SECONDS: num(300),
    OTP_RATE_LIMIT_MAX_IN_WINDOW: num(5),
    OTP_TTL_SECONDS: num(300),
    OTP_MAX_ATTEMPTS: num(5),
    OTP_LOCKOUT_SECONDS: num(900),

    PORTAL_SESSION_TTL_SECONDS: num(3600),
    PORTAL_SESSION_TOUCH_INTERVAL_SECONDS: num(300),
  })
  .superRefine((v, ctx) => {
    const mode = (v.SALLA_OAUTH_MODE ?? "easy") as "easy" | "custom";

    if (mode === "easy") {
      if (!v.SALLA_APP_ID) {
        ctx.addIssue({
          code: "custom",
          path: ["SALLA_APP_ID"],
          message: "SALLA_APP_ID is required in easy mode",
        });
      }
      if (!v.SALLA_CLIENT_ID) {
        ctx.addIssue({
          code: "custom",
          path: ["SALLA_CLIENT_ID"],
          message: "SALLA_CLIENT_ID is required to refresh tokens",
        });
      }
      if (!v.SALLA_CLIENT_SECRET) {
        ctx.addIssue({
          code: "custom",
          path: ["SALLA_CLIENT_SECRET"],
          message: "SALLA_CLIENT_SECRET is required to refresh tokens",
        });
      }
      if (!v.SALLA_OAUTH_TOKEN_URL) {
        ctx.addIssue({
          code: "custom",
          path: ["SALLA_OAUTH_TOKEN_URL"],
          message: "SALLA_OAUTH_TOKEN_URL is required to refresh tokens",
        });
      }
      return;
    }

    if (!v.SALLA_CLIENT_ID) {
      ctx.addIssue({
        code: "custom",
        path: ["SALLA_CLIENT_ID"],
        message: "SALLA_CLIENT_ID is required in custom mode",
      });
    }
    if (!v.SALLA_CLIENT_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["SALLA_CLIENT_SECRET"],
        message: "SALLA_CLIENT_SECRET is required in custom mode",
      });
    }
    if (!v.SALLA_OAUTH_AUTHORIZE_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["SALLA_OAUTH_AUTHORIZE_URL"],
        message: "SALLA_OAUTH_AUTHORIZE_URL is required in custom mode",
      });
    }
    if (!v.SALLA_OAUTH_TOKEN_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["SALLA_OAUTH_TOKEN_URL"],
        message: "SALLA_OAUTH_TOKEN_URL is required in custom mode",
      });
    }

    const hasOverride = !!(v.SALLA_OAUTH_REDIRECT_URI && v.SALLA_OAUTH_REDIRECT_URI.trim());
    if (!hasOverride) {
      const base = (v.APP_BASE_URL ?? "").trim();
      if (!base) {
        ctx.addIssue({
          code: "custom",
          path: ["APP_BASE_URL"],
          message: "APP_BASE_URL is required in custom mode (used to derive /auth/callback)",
        });
      }
    }
  });

export const env = schema.parse(process.env);
