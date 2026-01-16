// appsail/src/services/webhooks.service.ts
import { AppError } from "../lib/errors";
import { toCatalystDateTime } from "../lib/datetime";
import { encryptText } from "../lib/crypto";
import { TenantsRepo } from "../repositories/tenants.repo";
import { SallaOauthTokensRepo } from "../repositories/sallaOauthTokens.repo";
import { WebhookEventsRepo } from "../repositories/webhookEvents.repo";

export type SallaWebhookEvent = {
  event?: string;
  type?: string;
  action?: string;
  merchant?: string | number;
  store_id?: string | number;
  created_at?: string;
  data?: any;
  portal_public_slug?: string;
  meta?: any;
  [k: string]: any;
};

function assertRowIdDigits(id: any) {
  const v = String(id ?? "").trim();
  if (!/^\d+$/.test(v)) throw new AppError(400, "Invalid tenant ROWID", "TENANT_ID_INVALID");
  return v;
}

function normalizeEventType(evt: SallaWebhookEvent): string {
  return String(evt.event ?? evt.type ?? evt.action ?? "").trim().toLowerCase();
}

function extractMerchantId(evt: SallaWebhookEvent): string | null {
  const v = evt.merchant ?? evt.store_id ?? evt.data?.merchant ?? evt.data?.store_id ?? evt.data?.store?.id ?? evt.store?.id;
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function extractPortalSlug(evt: SallaWebhookEvent): string | null {
  const v = evt.portal_public_slug ?? evt.data?.portal_public_slug ?? evt.meta?.portal_public_slug ?? evt.data?.meta?.portal_public_slug;
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function extractTokens(evt: SallaWebhookEvent): {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string | null;
  scope: string | null;
} | null {
  const d = evt.data ?? {};
  const access_token = String(d.access_token ?? "").trim();
  if (!access_token) return null;
  const refresh_token = String(d.refresh_token ?? "").trim();
  const expires_in = Number(d.expires_in ?? 0);
  const token_type = d.token_type != null ? String(d.token_type).trim() : null;
  const scope = d.scope != null ? String(d.scope).trim() : null;
  return { access_token, refresh_token, expires_in, token_type, scope };
}

function toExpiresAt(expiresInSeconds: number): string | null {
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) return null;
  return toCatalystDateTime(new Date(Date.now() + expiresInSeconds * 1000));
}

function isUninstallEvent(t: string) {
  return !!t && t.includes("uninstall");
}
function isAuthorizeEvent(t: string) {
  return t === "app.store.authorize" || (t.includes("app") && t.includes("authorize"));
}
function isInstallEvent(t: string) {
  return t === "app.store.install" || (t.includes("app") && t.includes("install"));
}
function isUpdateEvent(t: string) {
  return t === "app.store.update" || (t.includes("app") && t.includes("update"));
}

async function resolveTenantId(req: any, tenantIdOrNull: string | null, storeId: string | null, portalSlug: string | null) {
  if (tenantIdOrNull) return assertRowIdDigits(tenantIdOrNull);

  if (storeId) {
    const byStore = await TenantsRepo.findBySallaStoreId(req, storeId).catch(() => null);
    if (byStore) return assertRowIdDigits(byStore.ROWID);
  }

  if (portalSlug) {
    const bySlug = await TenantsRepo.findByPortalSlug(req, portalSlug).catch(() => null);
    if (bySlug) return assertRowIdDigits(bySlug.ROWID);
  }

  return null;
}

/**
 * Deterministic lifecycle handler.
 * - install/update => ensure tenant by portal slug (if present)
 * - authorize => MUST resolve tenant (storeId/portalSlug), but if portalSlug exists we auto-ensure
 */
export async function handleSallaWebhook(req: any, tenantIdOrNull: string | null, event: SallaWebhookEvent) {
  const t = normalizeEventType(event);
  const storeId = extractMerchantId(event);
  const portalSlug = extractPortalSlug(event);

  // 1) uninstall
  if (isUninstallEvent(t)) {
    const tid = await resolveTenantId(req, tenantIdOrNull, storeId, portalSlug);
    if (!tid) return { ok: true, handled: "uninstall", tenant: null };

    const nowStr = toCatalystDateTime(new Date());
    await SallaOauthTokensRepo.revoke(req, tid, nowStr);
    await TenantsRepo.updateSallaConnectionFields(req, tid, { status: "uninstalled" });

    return { ok: true, handled: "uninstall", tenant: tid };
  }

  // 2) install/update => ensure tenant by portal slug (so authorize later can link)
  if (isInstallEvent(t) || isUpdateEvent(t)) {
    if (!portalSlug) return { ok: true, handled: "ignored", type: t || null };

    const tenant = await TenantsRepo.ensureTenantByPortalSlug(req, portalSlug, {
      status: "installed_pending_authorize",
      plan_code: "free",
    });

    // if storeId is present, attach it (helps future routing)
    if (storeId) {
      await TenantsRepo.updateSallaConnectionFields(req, tenant.ROWID, {
        salla_store_id: storeId,
        status: "installed_pending_authorize",
      });
    } else {
      await TenantsRepo.updateSallaConnectionFields(req, tenant.ROWID, { status: "installed_pending_authorize" });
    }

    return { ok: true, handled: isInstallEvent(t) ? "install" : "update", tenant: tenant.ROWID, store_id: storeId ?? null };
  }

  // 3) authorize
  if (isAuthorizeEvent(t)) {
    if (!storeId) throw new AppError(400, "Missing merchant id in authorize event", "AUTHORIZE_MISSING_MERCHANT");

    // If portalSlug exists, ensure tenant (install might not have been called manually)
    if (portalSlug) {
      await TenantsRepo.ensureTenantByPortalSlug(req, portalSlug, { status: "installed_pending_authorize", plan_code: "free" }).catch(() => null);
    }

    const tid = await resolveTenantId(req, tenantIdOrNull, storeId, portalSlug);
    if (!tid) throw new AppError(404, "Tenant not resolved for authorize event", "TENANT_NOT_RESOLVED");

    const tokens = extractTokens(event);
    if (!tokens) throw new AppError(400, "Missing tokens in authorize event", "AUTHORIZE_MISSING_TOKENS");

    const nowStr = toCatalystDateTime(new Date());
    const expiresAt = toExpiresAt(tokens.expires_in);

    const existing = await SallaOauthTokensRepo.findByTenantId(req, tid).catch(() => null);

    await SallaOauthTokensRepo.upsertByTenant(req, tid, {
      tenant_unique_key: existing?.tenant_unique_key ? String(existing.tenant_unique_key) : `store:${storeId}`,
      token_status: "active",
      access_token_enc: encryptText(tokens.access_token),
      refresh_token_enc: tokens.refresh_token ? encryptText(tokens.refresh_token) : existing?.refresh_token_enc ?? null,
      token_type: tokens.token_type || "Bearer",
      scopes: tokens.scope,
      access_token_expires_at: expiresAt,
      last_token_refresh_at: nowStr,
      installed_at: existing?.installed_at ? String(existing.installed_at) : nowStr,
      uninstalled_at: null,
    });

    await TenantsRepo.updateSallaConnectionFields(req, tid, {
      salla_store_id: storeId,
      status: "connected",
    });

    return { ok: true, handled: "authorize", tenant: tid, store_id: storeId };
  }

  return { ok: true, handled: "ignored", type: t || null };
}

function safeJsonParse<T = any>(s: string, fallback: T): T {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

export async function processPendingSallaWebhooks(req: any, opts: { limit?: number; maxRetries?: number } = {}) {
  const limit = Number.isFinite(opts.limit) && (opts.limit as number) > 0 ? (opts.limit as number) : 25;
  const maxRetries = Number.isFinite(opts.maxRetries) && (opts.maxRetries as number) >= 0 ? (opts.maxRetries as number) : 5;

  const rows = await WebhookEventsRepo.listPendingBatch(req, { limit, maxRetries });

  let done = 0;
  let failed = 0;
  let ignored = 0;

  for (const row of rows) {
    await WebhookEventsRepo.markProcessing(req, row.ROWID).catch(() => null);

    if (!row.signature_valid) {
      await WebhookEventsRepo.markDone(req, row.ROWID).catch(() => null);
      ignored++;
      continue;
    }

    const eventObj = safeJsonParse<SallaWebhookEvent>(row.payload_json, {} as any);
    const tenantIdOrNull = row.tenant_id == null ? null : String(row.tenant_id);

    try {
      await handleSallaWebhook(req, tenantIdOrNull, eventObj);
      await WebhookEventsRepo.markDone(req, row.ROWID).catch(() => null);
      done++;
    } catch {
      await WebhookEventsRepo.markFailedAndIncrementRetry(req, row.ROWID, row.retry_count).catch(() => null);
      failed++;
    }
  }

  return { ok: true, scanned: rows.length, done, failed, ignored };
}
