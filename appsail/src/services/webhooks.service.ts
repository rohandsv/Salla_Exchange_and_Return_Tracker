import { AppError } from "../lib/errors";
import { toCatalystDateTime } from "../lib/datetime";
import { encryptText } from "../lib/crypto";
import { TenantsRepo } from "../repositories/tenants.repo";
import { SallaOauthTokensRepo } from "../repositories/sallaOauthTokens.repo";

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
  const v = evt.merchant ?? evt.store_id ?? evt.data?.merchant ?? evt.data?.store_id;
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function extractPortalSlug(evt: SallaWebhookEvent): string | null {
  const v =
    evt.portal_public_slug ??
    evt.data?.portal_public_slug ??
    evt.meta?.portal_public_slug ??
    evt.data?.meta?.portal_public_slug;

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

export async function handleSallaWebhook(req: any, tenantIdOrNull: string | null, event: SallaWebhookEvent) {
  const t = normalizeEventType(event);
  const storeId = extractMerchantId(event);
  const portalSlug = extractPortalSlug(event);

  if (isUninstallEvent(t)) {
    const tid = await resolveTenantId(req, tenantIdOrNull, storeId, portalSlug);
    if (!tid) return { ok: true, handled: "uninstall", tenant: null };

    const nowStr = toCatalystDateTime(new Date());
    await SallaOauthTokensRepo.revoke(req, tid, nowStr);
    await TenantsRepo.updateSallaConnectionFields(req, tid, { status: "uninstalled" });

    return { ok: true, handled: "uninstall", tenant: tid };
  }

  if (isAuthorizeEvent(t)) {
    if (!storeId) throw new AppError(400, "Missing merchant id in authorize event", "AUTHORIZE_MISSING_MERCHANT");

    const tid = await resolveTenantId(req, tenantIdOrNull, storeId, portalSlug);
    if (!tid) {
      throw new AppError(404, "Tenant not resolved for authorize event", "TENANT_NOT_RESOLVED");
    }

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
