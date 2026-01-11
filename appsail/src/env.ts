import { z } from "zod";

const schema = z
  .object({
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

    SALLA_CLIENT_ID: z.string().min(1).optional(),
    SALLA_CLIENT_SECRET: z.string().min(1).optional(),

    SALLA_OAUTH_AUTHORIZE_URL: z.string().url().optional(),
    SALLA_OAUTH_TOKEN_URL: z.string().url().optional(),
    SALLA_API_BASE_URL: z.string().url().optional(),
    SALLA_OAUTH_REDIRECT_URI: z.string().url().optional(),

    SALLA_OAUTH_SCOPE: z.string().min(1).optional(),
    SALLA_VERIFY_ENDPOINT: z.string().min(1).optional(),

    SALLA_TOKEN_REFRESH_SKEW_SECONDS: z.coerce.number().int().positive().default(120),

    SALLA_APP_ID: z.string().min(1).optional(),
    SALLA_INSTALL_URL_BASE: z.string().url().optional(),

    MERCHANT_DEBUG_KEY: z.string().min(8).optional(),
  })
  .superRefine((v, ctx) => {
    const oauthEnabled =
      !!v.SALLA_CLIENT_ID ||
      !!v.SALLA_CLIENT_SECRET ||
      !!v.SALLA_OAUTH_AUTHORIZE_URL ||
      !!v.SALLA_OAUTH_TOKEN_URL ||
      !!v.SALLA_API_BASE_URL ||
      !!v.SALLA_OAUTH_REDIRECT_URI ||
      !!v.SALLA_OAUTH_SCOPE ||
      !!v.SALLA_VERIFY_ENDPOINT;

    if (!oauthEnabled) return;

    const required: Array<[keyof typeof v, string]> = [
      ["SALLA_CLIENT_ID", "SALLA_CLIENT_ID is required when OAuth is enabled"],
      ["SALLA_CLIENT_SECRET", "SALLA_CLIENT_SECRET is required when OAuth is enabled"],
      ["SALLA_OAUTH_AUTHORIZE_URL", "SALLA_OAUTH_AUTHORIZE_URL is required when OAuth is enabled"],
      ["SALLA_OAUTH_TOKEN_URL", "SALLA_OAUTH_TOKEN_URL is required when OAuth is enabled"],
      ["SALLA_API_BASE_URL", "SALLA_API_BASE_URL is required when OAuth is enabled"],
    ];

    for (const [k, msg] of required) {
      if (!v[k]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [k as string], message: msg });
      }
    }

    try {
      // eslint-disable-next-line no-new
      new URL(v.APP_BASE_URL);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["APP_BASE_URL"],
        message: "APP_BASE_URL must be a valid absolute URL (e.g., https://example.com) when OAuth is enabled",
      });
    }

    if (v.SALLA_VERIFY_ENDPOINT && !v.SALLA_VERIFY_ENDPOINT.startsWith("/")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SALLA_VERIFY_ENDPOINT"],
        message: "SALLA_VERIFY_ENDPOINT should start with '/' (path appended to SALLA_API_BASE_URL)",
      });
    }
  });

export const env = schema.parse(process.env);
export type Env = typeof env;
