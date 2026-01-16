// appsail/src/routes/webhooks.routes.ts
import { Router } from "express";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { logger } from "../lib/logger";
import { AppError } from "../lib/errors";
import { toCatalystDateTime } from "../lib/datetime";
import { TenantsRepo } from "../repositories/tenants.repo";
import { WebhookEventsRepo } from "../repositories/webhookEvents.repo";
import { handleSallaWebhook, processPendingSallaWebhooks } from "../services/webhooks.service";

export const webhooksRoutes = Router();

webhooksRoutes.get("/_ping", (_req, res) => res.status(200).json({ ok: true, route: "/webhooks/_ping" }));

webhooksRoutes.post("/salla", async (req: any, res, next) => {
  try {
    const secret = process.env.SALLA_WEBHOOK_SECRET_KEY || process.env.SALLA_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || "";
    if (!secret) throw new AppError(500, "Webhook secret is not configured", "WEBHOOK_SECRET_MISSING");

    const rawBody = getRawBodyBuffer(req);
    const providedSig = extractProvidedSignature(req);
    if (!providedSig) throw new AppError(401, "Missing webhook signature", "WEBHOOK_SIGNATURE_MISSING");

    const digest = createHmac("sha256", secret).update(rawBody).digest();
    const providedBuf = decodeSignatureToBuffer(providedSig);

    const ok = !!providedBuf && providedBuf.length === digest.length && timingSafeEqual(providedBuf, digest);

    if (!ok) {
      const nodeEnv = String(process.env.NODE_ENV ?? "").toLowerCase();
      const debugEnabled = nodeEnv !== "production" && ["1", "true", "yes", "on"].includes(String(process.env.WEBHOOK_DEBUG ?? "1").toLowerCase());

      if (debugEnabled) {
        return res.status(401).json({
          ok: false,
          request_id: req.requestId,
          code: "WEBHOOK_SIGNATURE_INVALID",
          error: "Invalid webhook signature",
          debug: {
            provided_signature_normalized: providedSig,
            provided_signature_hex: providedBuf ? providedBuf.toString("hex") : null,
            computed_digest_hex: digest.toString("hex"),
            raw_body_len: rawBody.length,
            raw_body_sha1: sha1Hex(rawBody),
            content_type: req.headers["content-type"] ?? null,
            has_rawBody_buffer: !!(req.rawBody && Buffer.isBuffer(req.rawBody)),
            secret_len: secret.length,
            secret_sha1: sha1Hex(Buffer.from(secret, "utf8")),
          },
        });
      }

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

    // ✅ avoid collisions when storeId is missing
    const partitionKey = storeId ?? portalSlug ?? "unknown";
    const idempotencyKey = clampKey(`${partitionKey}:${eventType}:${eventIdExternal}`, 240);

    const stored = await WebhookEventsRepo.insertPendingIdempotent(req, {
      tenant_id: tenantId ?? null,
      event_type: eventType,
      event_id_external: eventIdExternal,
      idempotency_key: idempotencyKey,
      signature_valid: true,
      body,
      received_at: receivedAt,
    });

    try {
      const result = await handleSallaWebhook(req, tenantId, body);
      await WebhookEventsRepo.markDone(req, stored.row.ROWID).catch(() => null);

      if (!tenantId) {
        logger.warn({
          code: "WEBHOOK_TENANT_NOT_RESOLVED_AT_INSERT",
          event_type: eventType,
          store_id: storeId ?? null,
          portal_public_slug: portalSlug ?? null,
          handled: result?.handled ?? null,
        });
      }
    } catch (e) {
      await WebhookEventsRepo.markFailedAndIncrementRetry(req, stored.row.ROWID, stored.row.retry_count).catch(() => null);
      throw e;
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

webhooksRoutes.post("/process-pending", async (req: any, res, next) => {
  try {
    const limitRaw = Number(req.query?.limit ?? 25);
    const maxRetriesRaw = Number(req.query?.maxRetries ?? 5);

    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 25;
    const maxRetries = Number.isFinite(maxRetriesRaw) && maxRetriesRaw >= 0 ? maxRetriesRaw : 5;

    const result = await processPendingSallaWebhooks(req, { limit, maxRetries });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

function getRawBodyBuffer(req: any): Buffer {
  if (req?.rawBody && Buffer.isBuffer(req.rawBody)) return req.rawBody;
  return Buffer.from(JSON.stringify(req.body ?? {}), "utf8");
}

function extractProvidedSignature(req: any): string | null {
  const headerSig = (req.header?.("x-salla-signature") as string | undefined) || (req.header?.("X-Salla-Signature") as string | undefined);
  if (headerSig && headerSig.trim()) return normalizeSignature(headerSig);

  const auth = (req.header?.("authorization") as string | undefined) || (req.header?.("Authorization") as string | undefined);
  if (auth && auth.toLowerCase().startsWith("bearer ")) return normalizeSignature(auth.slice(7));

  return null;
}

function normalizeSignature(sig: string): string {
  const s = sig.trim();
  if (s.toLowerCase().startsWith("sha256=")) return s.slice(7).trim();
  return s;
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
  const direct = body?.merchant ?? body?.store_id ?? body?.storeId ?? body?.data?.merchant ?? body?.data?.store_id ?? body?.data?.storeId ?? body?.data?.store?.id ?? body?.store?.id;
  if (direct === undefined || direct === null) return null;
  const s = String(direct).trim();
  return s ? s : null;
}

function extractPortalSlug(body: any): string | null {
  const v = body?.portal_public_slug ?? body?.data?.portal_public_slug ?? body?.meta?.portal_public_slug ?? body?.data?.meta?.portal_public_slug;
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

function sha1Hex(buf: Buffer): string {
  return createHash("sha1").update(buf).digest("hex");
}

function clampKey(s: string, maxLen: number) {
  const v = String(s ?? "");
  return v.length <= maxLen ? v : v.slice(0, maxLen);
}
