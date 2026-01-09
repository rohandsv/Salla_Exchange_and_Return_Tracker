import { env } from "../env";
import { AppError } from "../lib/errors";
import { hashContact, hashToken, randomSessionToken, verifyOtpHash } from "../lib/crypto";
import { normalizeEmail, normalizePhone } from "../lib/normalize";
import { toCatalystDateTime } from "../lib/datetime";
import { OtpSessionsRepo } from "../repositories/otpSessions.repo";
import { PortalSessionsRepo } from "../repositories/portalSessions.repo";

export type OtpChannel = "sms" | "email";

function normalizeContact(channel: OtpChannel, value: string) {
  return channel === "email" ? normalizeEmail(value) : normalizePhone(value);
}

export class PortalAuthService {
  static async verifyOtpAndCreateSession(
    req: any,
    args: {
      tenantId: string;
      orderNumber: string;
      channel: OtpChannel;
      contact: string;
      otp: string;
      createdIp?: string;
    }
  ) {
    const { tenantId, orderNumber, channel, contact, otp, createdIp } = args;

    const normalized = normalizeContact(channel, contact);
    const contactHash = hashContact(tenantId, channel, normalized);

    const otpRow = await OtpSessionsRepo.findLatestActive(req, tenantId, channel, contactHash, orderNumber);
    if (!otpRow) throw new AppError(400, "Invalid OTP or expired", "OTP_INVALID");

    const ok = verifyOtpHash(tenantId, orderNumber, contactHash, otp, otpRow.otp_hash);
    if (!ok) {
      const nextAttempt = (otpRow.attempt_count ?? 0) + 1;

      let lockedUntil: string | null = null;
      if (nextAttempt >= (otpRow.max_attempts ?? env.OTP_MAX_ATTEMPTS)) {
        lockedUntil = toCatalystDateTime(new Date(Date.now() + env.OTP_LOCKOUT_SECONDS * 1000));
      }

      await OtpSessionsRepo.incrementAttempt(req, otpRow.ROWID, nextAttempt, lockedUntil);
      throw new AppError(400, "Invalid OTP or expired", "OTP_INVALID");
    }

    await OtpSessionsRepo.markVerified(req, otpRow.ROWID);

    const rawToken = randomSessionToken();
    const tokenHash = hashToken(rawToken);

    const expiresAt = toCatalystDateTime(new Date(Date.now() + env.PORTAL_SESSION_TTL_SECONDS * 1000));
    const nowStr = toCatalystDateTime(new Date());

    await PortalSessionsRepo.insert(req, {
      tenant_id: tenantId,
      session_token_hash: tokenHash,
      contact_hash: contactHash,
      order_number: orderNumber,
      expires_at: expiresAt,
      created_ip: createdIp ?? null,
      last_seen_at: nowStr,
    });

    return {
      session_token: rawToken,
      expires_at: expiresAt,
      order_number: orderNumber,
    };
  }
}
