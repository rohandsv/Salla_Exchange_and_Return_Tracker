import { Router } from "express";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { getCatalystApp } from "../lib/catalyst";
import { logger } from "../lib/logger";
import { AppError } from "../lib/errors";
import { toCatalystDateTime } from "../lib/datetime";
import { TenantsRepo } from "../repositories/tenants.repo";
import { handleSallaWebhook } from "../services/webhooks.service";

export const webhooksRoutes = Router();

webhooksRoutes.post("/salla", async (req: any, res, next) => {
  try {
    const secret =
      process.env.SALLA_WEBHOOK_SECRET_KEY ||
      process.env.SALLA_WEBHOOK_SECRET ||
      process.env.WEBHOOK_SECRET ||
      "";

    if (!secret) throw new AppError(500, "Webhook secret is not configured", "WEBHOOK_SECRET_MISSING");

    const rawBody = getRawBodyBuffer(req);
    const providedSig = extractProvidedSignature(req);

    if (!providedSig) throw new AppError(401, "Missing webhook signature", "WEBHOOK_SIGNATURE_MISSING");
    if (!verifyHmacSha256(secret, rawBody, providedSig)) {
      throw new AppError(401, "Invalid webhook signature", "WEBHOOK_SIGNATURE_INVALID");
    }

    const body = req.body ?? {};
    const eventType = String(body.event ?? body.type ?? body.action ?? "unknown").trim();
    const storeId = extractStoreId(body);
    const portalSlug = extractPortalSlug(body);
    const receivedAt = toCatalystDateTime(new Date());

    let tenant: any = null;

    if (storeId) tenant = await TenantsRepo.findBySallaStoreId(req, storeId).catch(() => null);
    if (!tenant && portalSlug) tenant = await TenantsRepo.findByPortalSlug(req, portalSlug).catch(() => null);

    const tenantId = tenant ? String(tenant.ROWID) : null;

    const externalId = extractExternalEventId(body);
    const fallbackId = sha1Hex(rawBody);
    const eventIdExternal = externalId ?? fallbackId;

    const idempotencyKey = clampKey(`${storeId ?? "unknown"}:${eventType}:${eventIdExternal}`, 240);

    await insertWebhookEvent(req, {
      tenant_id: tenantId ?? undefined,
      event_type: eventType,
      event_id_external: eventIdExternal,
      idempotency_key: idempotencyKey,
      signature_valid: true,
      payload_json: safeJsonStringify(body),
      received_at: receivedAt,
      process_status: "pending",
      retry_count: 0,
    });

    const result = await handleSallaWebhook(req, tenantId, body);

    if (!tenantId) {
      logger.warn({
        code: "WEBHOOK_TENANT_NOT_RESOLVED",
        event_type: eventType,
        store_id: storeId ?? null,
        portal_public_slug: portalSlug ?? null,
        handled: result?.handled ?? null,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

function getRawBodyBuffer(req: any): Buffer {
  if (req?.rawBody && Buffer.isBuffer(req.rawBody)) return req.rawBody;
  return Buffer.from(JSON.stringify(req.body ?? {}), "utf8");
}

function extractProvidedSignature(req: any): string | null {
  const headerSig =
    (req.header?.("x-salla-signature") as string | undefined) ||
    (req.header?.("X-Salla-Signature") as string | undefined);

  if (headerSig && headerSig.trim()) return normalizeSignature(headerSig);

  const auth =
    (req.header?.("authorization") as string | undefined) ||
    (req.header?.("Authorization") as string | undefined);

  if (auth && auth.toLowerCase().startsWith("bearer ")) return normalizeSignature(auth.slice(7));

  return null;
}

function normalizeSignature(sig: string): string {
  const s = sig.trim();
  if (s.toLowerCase().startsWith("sha256=")) return s.slice(7).trim();
  return s;
}

function verifyHmacSha256(secret: string, rawBody: Buffer, providedSig: string): boolean {
  const digest = createHmac("sha256", secret).update(rawBody).digest();
  const providedBuf = decodeSignatureToBuffer(providedSig);
  if (!providedBuf) return false;
  if (providedBuf.length !== digest.length) return false;
  return timingSafeEqual(providedBuf, digest);
}

function decodeSignatureToBuffer(sig: string): Buffer | null {
  const s = sig.trim();

  if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) {
    try {
      return Buffer.from(s, "hex");
    } catch {
      return null;
    }
  }

  try {
    const b = Buffer.from(s, "base64");
    if (b.length === 32) return b;
    return null;
  } catch {
    return null;
  }
}

function extractStoreId(body: any): string | null {
  const direct =
    body?.merchant ??
    body?.store_id ??
    body?.storeId ??
    body?.data?.merchant ??
    body?.data?.store_id ??
    body?.data?.storeId ??
    body?.data?.store?.id ??
    body?.store?.id;

  if (direct === undefined || direct === null) return null;
  const s = String(direct).trim();
  return s ? s : null;
}

function extractPortalSlug(body: any): string | null {
  const v =
    body?.portal_public_slug ??
    body?.data?.portal_public_slug ??
    body?.meta?.portal_public_slug ??
    body?.data?.meta?.portal_public_slug;

  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function extractExternalEventId(body: any): string | null {
  const v = body?.id ?? body?.event_id ?? body?.data?.id ?? body?.data?.event_id;
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

async function insertWebhookEvent(req: any, payload: Record<string, any>): Promise<void> {
  try {
    const app = getCatalystApp(req);
    const table = app.datastore().table("webhook_events_salla");

    const row: any = {
      event_type: String(payload.event_type ?? "unknown"),
      event_id_external: payload.event_id_external ? String(payload.event_id_external) : null,
      idempotency_key: String(payload.idempotency_key),
      signature_valid: Boolean(payload.signature_valid),
      payload_json: String(payload.payload_json ?? "{}"),
      received_at: String(payload.received_at ?? toCatalystDateTime(new Date())),
      process_status: String(payload.process_status ?? "pending"),
      retry_count: Number.isFinite(payload.retry_count) ? Number(payload.retry_count) : 0,
    };

    if (payload.tenant_id) row.tenant_id = String(payload.tenant_id);

    await table.insertRow(row);
  } catch (e: any) {
    const msg = String(e?.message ?? "").toLowerCase();
    if (msg.includes("unique") || msg.includes("duplicate")) return;

    logger.error({
      code: "WEBHOOK_EVENT_STORE_FAILED",
      msg: e?.message || "Failed to store webhook event",
    });
  }
}

function safeJsonStringify(v: any): string {
  try {
    return JSON.stringify(v);
  } catch {
    return "{}";
  }
}

function sha1Hex(buf: Buffer): string {
  return createHash("sha1").update(buf).digest("hex");
}

function clampKey(s: string, maxLen: number) {
  const v = String(s ?? "");
  return v.length <= maxLen ? v : v.slice(0, maxLen);
}
