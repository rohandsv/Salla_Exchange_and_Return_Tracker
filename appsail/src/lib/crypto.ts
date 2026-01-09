// appsail/src/lib/crypto.ts
import crypto from "crypto";
import { env } from "../env";

/**
 * HMAC helper (pepper stored in env)
 */
function hmac(data: string): Buffer {
  return crypto.createHmac("sha256", env.SECURITY_PEPPER).update(data).digest();
}

/**
 * Constant-time string compare (hex strings)
 */
function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function hashContact(tenantId: string, channel: string, normalizedContact: string): string {
  return hmac(`${tenantId}:${channel}:${normalizedContact}`).toString("hex");
}

export function hashToken(rawToken: string): string {
  return hmac(`portal_token:${rawToken}`).toString("hex");
}

/**
 * OTP hash format stored in DB: v1$<saltB64url>$<digestHex>
 * Salt is included inside the stored hash -> no extra DB column needed.
 */
export function hashOtp(tenantId: string, orderNumber: string, contactHash: string, otp: string): string {
  const salt = crypto.randomBytes(16).toString("base64url");
  const digestHex = hmac(`otp:v1:${tenantId}:${orderNumber}:${contactHash}:${salt}:${otp}`).toString("hex");
  return `v1$${salt}$${digestHex}`;
}

/**
 * Verify an OTP against a stored v1$<salt>$<digest> hash.
 * IMPORTANT: Must reuse the SAME salt extracted from expectedHash.
 */
export function verifyOtpHash(
  tenantId: string,
  orderNumber: string,
  contactHash: string,
  otp: string,
  expectedHash: string
): boolean {
  // Expected format: v1$<saltB64url>$<digestHex>
  const parts = expectedHash.split("$");
  if (parts.length !== 3) return false;

  const [version, salt, digestHex] = parts;
  if (version !== "v1" || !salt || !digestHex) return false;

  const expectedDigest = hmac(`otp:v1:${tenantId}:${orderNumber}:${contactHash}:${salt}:${otp}`).toString("hex");
  return timingSafeEqualHex(expectedDigest, digestHex);
}

export function generateOtp6(): string {
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(6, "0");
}

export function randomSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * AES-256-GCM encryption for storing secrets (OAuth tokens later).
 */
function getEncKey(): Buffer {
  const key = Buffer.from(env.ENCRYPTION_KEY_B64, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY_B64 must decode to 32 bytes");
  return key;
}

export function encryptText(plain: string): string {
  const key = getEncKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // v1:<iv>:<tag>:<ciphertext>
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decryptText(payload: string): string {
  const [v, ivB64, tagB64, dataB64] = payload.split(":");
  if (v !== "v1" || !ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted payload");

  const key = getEncKey();
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}
