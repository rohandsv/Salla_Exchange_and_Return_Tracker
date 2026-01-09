import { env } from "../env";
import { generateOtp6, hashContact, hashOtp } from "../lib/crypto";
import { toCatalystDateTime } from "../lib/datetime";
import { normalizeEmail, normalizePhone } from "../lib/normalize";
import { checkRateLimit } from "../lib/rateLimit";
import { OtpSessionsRepo } from "../repositories/otpSessions.repo";

export type OtpChannel = "sms" | "email";

function normalizeContact(channel: OtpChannel, value: string) {
  return channel === "email" ? normalizeEmail(value) : normalizePhone(value);
}

function safeBool(v: any, def = false) {
  if (v === true || v === "true" || v === "1") return true;
  if (v === false || v === "false" || v === "0") return false;
  return def;
}

export class OtpService {
  /**
   * Integrate your SMS/email provider here.
   * Production rule: never log OTP.
   */
  static async sendOtp(_channel: OtpChannel, _to: string, _otp: string) {
    return;
  }

  static async requestOtp(
    req: any,
    args: {
      tenantId: string;        // tenants.ROWID (digits string)
      orderNumber: string;
      channel: OtpChannel;
      contact: string;
      requestIp?: string;
      userAgent?: string;
    }
  ) {
    const { tenantId, orderNumber, channel, contact, requestIp, userAgent } = args;

    const normalized = normalizeContact(channel, contact);
    const contactHash = hashContact(tenantId, channel, normalized);

    /**
     * Best-effort in-memory limiter (burst control)
     * This is ONLY extra protection; DB limiter is authoritative.
     */
    const memKey = `otp:${tenantId}:${channel}:${contactHash}:${requestIp ?? "na"}`;
    const mem = checkRateLimit(
      memKey,
      env.OTP_RATE_LIMIT_WINDOW_SECONDS * 1000,
      env.OTP_RATE_LIMIT_MAX_IN_WINDOW
    );

    if (!mem.allowed) {
      // Generic response (no information leaks)
      return { ok: true, message: "If your details are correct, an OTP has been sent." };
    }

    /**
     * Authoritative limiter in DB (safe across multiple instances)
     */
    const windowStart = new Date(Date.now() - env.OTP_RATE_LIMIT_WINDOW_SECONDS * 1000);
    const recentCount = await OtpSessionsRepo.countRecentRequests(req, tenantId, channel, contactHash, windowStart);

    if (recentCount >= env.OTP_RATE_LIMIT_MAX_IN_WINDOW) {
      // Generic response (no information leaks)
      return { ok: true, message: "If your details are correct, an OTP has been sent." };
    }

    const otp = generateOtp6();

    // IMPORTANT: Catalyst DateTime format (YYYY-MM-DD HH:MM:SS)
    const expiresAt = toCatalystDateTime(new Date(Date.now() + env.OTP_TTL_SECONDS * 1000));

    const otpHash = hashOtp(tenantId, orderNumber, contactHash, otp);

    await OtpSessionsRepo.insert(req, {
      tenant_id: tenantId,            // FK expects tenants.ROWID (digits)
      channel,
      contact_hash: contactHash,
      order_number: orderNumber,
      otp_hash: otpHash,
      expires_at: expiresAt,
      attempt_count: 0,
      max_attempts: env.OTP_MAX_ATTEMPTS,
      locked_until: null,
      verified_at: null,
      request_ip: requestIp ?? null,
      user_agent: userAgent ?? null,
    });

    await this.sendOtp(channel, normalized, otp);

    // DEV ONLY: return otp for testing if enabled
    // Add to app-config.json: "OTP_DEV_MODE": "true" (development only)
    const otpDevMode = safeBool((process.env as any).OTP_DEV_MODE, env.NODE_ENV !== "production");

    return otpDevMode
      ? { ok: true, message: "OTP generated (dev).", otp_dev: otp, expires_at: expiresAt }
      : { ok: true, message: "If your details are correct, an OTP has been sent." };
  }
}
