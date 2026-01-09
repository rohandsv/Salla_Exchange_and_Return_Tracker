import pino from "pino";
import { env } from "../env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  base: undefined,
  redact: {
    paths: [
      "req.headers.authorization",
      "headers.authorization",
      "*.authorization",
      "*.otp",
      "*.otp_hash",
      "*.access_token",
      "*.refresh_token",
      "*.ENCRYPTION_KEY_B64",
      "*.PORTAL_SESSION_SIGNING_KEY",
      "*.SECURITY_PEPPER",
    ],
    remove: true,
  },
});
