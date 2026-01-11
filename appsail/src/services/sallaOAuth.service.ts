// FILE: appsail/src/services/sallaOAuth.service.ts
import crypto from "crypto";
import { env } from "../env";
import { AppError } from "../lib/errors";
import { encryptText, decryptText } from "../lib/crypto";
import { toCatalystDateTime } from "../lib/datetime";
import { getCatalystApp } from "../lib/catalyst";
import { OAuthStatesRepo } from "../repositories/oauthStates.repo";
import { SallaOauthTokensRepo } from "../repositories/sallaOauthTokens.repo";
import { TenantsRepo } from "../repositories/tenants.repo";

function assertDigits(v: any) {
  const s = String(v ?? "").trim();
  if (!/^\d+$/.test(s)) throw new Error("Expected ROWID digits");
  return s;
}

function requireEnvString(name: string, val: any) {
  const s = typeof val === "string" ? val.trim() : "";
  if (!s) throw new AppError(500, `Missing ${name}`, "OAUTH_NOT_CONFIGURED");
  return s;
}

function requireEnvUrl(name: string, val: any) {
  const s = requireEnvString(name, val);
  try {
    // eslint-disable-next-line no-new
    new URL(s);
  } catch {
    throw new AppError(500, `Invalid URL in ${name}`, "OAUTH_NOT_CONFIGURED");
  }
  return s;
}

function getOAuthConfig() {
  return {
    clientId: requireEnvString("SALLA_CLIENT_ID", (env as any).SALLA_CLIENT_ID),
    clientSecret: requireEnvString("SALLA_CLIENT_SECRET", (env as any).SALLA_CLIENT_SECRET),
    authorizeUrl: requireEnvUrl("SALLA_OAUTH_AUTHORIZE_URL", (env as any).SALLA_OAUTH_AUTHORIZE_URL),
    tokenUrl: requireEnvUrl("SALLA_OAUTH_TOKEN_URL", (env as any).SALLA_OAUTH_TOKEN_URL),
  };
}

function resolveRedirectUri(): string {
  const override = (env as any).SALLA_OAUTH_REDIRECT_URI;
  if (override && typeof override === "string" && override.trim()) {
    // must be absolute url
    return requireEnvUrl("SALLA_OAUTH_REDIRECT_URI", override.trim());
  }

  const base = String(env.APP_BASE_URL || "").replace(/\/+$/, "");
  // APP_BASE_URL must be absolute when oauth is enabled (env.ts already enforces)
  const redirect = `${base}/auth/callback`;
  return requireEnvUrl("APP_BASE_URL (for redirect)", redirect);
}

function toExpiresAt(expiresInSeconds: number): string | null {
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) return null;
  return toCatalystDateTime(new Date(Date.now() + expiresInSeconds * 1000));
}

function shouldRefresh(expiresAt: string | null | undefined): boolean {
  const skewSeconds = Number((env as any).SALLA_TOKEN_REFRESH_SKEW_SECONDS ?? 120);
  const skewMs = (Number.isFinite(skewSeconds) && skewSeconds > 0 ? skewSeconds : 120) * 1000;

  if (!expiresAt) return true;

  const isoLike = String(expiresAt).replace(" ", "T");
  const t = Date.parse(isoLike);
  if (!Number.isFinite(t)) return true;

  return Date.now() + skewMs >= t;
}

async function httpForm(tokenUrl: string, form: URLSearchParams) {
  // avoid hanging forever
  const controller = new AbortController();
  const timeoutMs = 15000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: form.toString(),
      signal: controller.signal,
    });

    const text = await resp.text().catch(() => "");
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      // ignore parse; we will use text in errors
    }

    return { ok: resp.ok, status: resp.status, text, json };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Optional, config-driven verification (NO hardcoded endpoint).
 */
async function verifyStoreProfile(accessToken: string): Promise<{
  salla_store_id?: string;
  store_name?: string;
  store_domain?: string | null;
} | null> {
  const base = (env as any).SALLA_API_BASE_URL;
  const endpoint = (env as any).SALLA_VERIFY_ENDPOINT;

  if (!base || !endpoint) return null;
  if (typeof base !== "string" || typeof endpoint !== "string") return null;

  const baseUrl = requireEnvUrl("SALLA_API_BASE_URL", base);
  const ep = String(endpoint).trim();
  if (!ep) return null;

  const url = `${baseUrl.replace(/\/+$/, "")}/${ep.replace(/^\/+/, "")}`;

  const controller = new AbortController();
  const timeoutMs = 15000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const text = await resp.text().catch(() => "");
    if (!resp.ok) return null;

    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      return null;
    }

    const data = payload?.data ?? payload;

    const id = data?.id ?? data?.store_id ?? data?.store?.id ?? payload?.store_id ?? payload?.id;
    const name = data?.name ?? data?.store_name ?? data?.store?.name ?? payload?.name;
    const domain =
      data?.domain ?? data?.store_domain ?? data?.store?.domain ?? payload?.domain ?? null;

    const salla_store_id = id != null ? String(id).trim() : undefined;
    const store_name = name != null ? String(name).trim() : undefined;
    const store_domain = domain != null ? String(domain).trim() : null;

    if (!salla_store_id && !store_name && !store_domain) return null;
    return { salla_store_id, store_name, store_domain };
  } finally {
    clearTimeout(t);
  }
}

export class SallaOAuthService {
  private static async getTenantUniqueKey(req: any, tenantRowId: string): Promise<string> {
    const app = getCatalystApp(req);
    const rowId = assertDigits(tenantRowId);

    const tenant: any = await app.datastore().table("tenants").getRow(rowId as any).catch(() => null);

    const storeDomain = tenant?.store_domain ? String(tenant.store_domain).trim() : "";
    const storeId = tenant?.salla_store_id ? String(tenant.salla_store_id).trim() : "";

    if (storeDomain) return `domain:${storeDomain.toLowerCase()}`;
    if (storeId) return `store:${storeId}`;
    return `tenant:${rowId}`;
  }

  /**
   * Start OAuth -> authorization URL
   */
  static async start(req: any, args: { portal_public_slug: string }) {
    const { clientId, authorizeUrl } = getOAuthConfig();

    const slug = String(args.portal_public_slug ?? "").trim();
    if (!slug) throw new AppError(400, "Missing portal_public_slug", "OAUTH_START_INVALID");

    const tenant = await TenantsRepo.findByPortalSlug(req, slug);
    if (!tenant) throw new AppError(404, "Unknown portal_public_slug", "TENANT_NOT_FOUND");

    const tenantId = assertDigits(tenant.ROWID);

    const state = crypto.randomBytes(24).toString("base64url");
    const expiresAt = toCatalystDateTime(new Date(Date.now() + 10 * 60 * 1000));

    await OAuthStatesRepo.insert(req, {
      tenant_id: tenantId,
      state,
      expires_at: expiresAt,
    });

    const redirectUri = resolveRedirectUri();

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
    });

    const scope = (env as any).SALLA_OAUTH_SCOPE;
    if (scope && typeof scope === "string" && scope.trim()) {
      params.set("scope", scope.trim());
    }

    return { ok: true, url: `${authorizeUrl}?${params.toString()}`, state_expires_at: expiresAt };
  }

  /**
   * Callback -> exchange tokens -> store encrypted -> verify -> update tenants
   */
  static async callback(req: any, args: { code: string; state: string }) {
    const { clientId, clientSecret, tokenUrl } = getOAuthConfig();

    const code = String(args.code ?? "").trim();
    const state = String(args.state ?? "").trim();
    if (!code || !state) throw new AppError(400, "Missing code/state", "OAUTH_CALLBACK_INVALID");

    const st = await OAuthStatesRepo.findValid(req, state);
    if (!st) throw new AppError(400, "Invalid/expired state", "OAUTH_STATE_INVALID");

    const tenantId = assertDigits(st.tenant_id);

    const redirectUri = resolveRedirectUri();

    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });

    const { ok, status, text, json } = await httpForm(tokenUrl, form);

    if (!ok) {
      // IMPORTANT: do NOT delete state on failure; allow retry until it expires.
      throw new AppError(
        400,
        "Token exchange failed",
        "OAUTH_TOKEN_EXCHANGE_FAILED",
        `HTTP ${status}: ${text}`
      );
    }

    const accessToken = String(json.access_token || "").trim();
    const refreshToken = String(json.refresh_token || "").trim();
    const tokenType = json.token_type ? String(json.token_type) : "Bearer";
    const expiresIn = Number(json.expires_in || 0);
    const scope = json.scope ? String(json.scope) : null;

    if (!accessToken) {
      throw new AppError(400, "Missing access_token", "OAUTH_TOKEN_INVALID");
    }

    // ✅ Now that we have a successful exchange, consume state (prevents replay)
    await OAuthStatesRepo.deleteByRowId(req, st.ROWID);

    const nowStr = toCatalystDateTime(new Date());
    const accessTokenExpiresAt = toExpiresAt(expiresIn);

    const tenantUniqueKey = await this.getTenantUniqueKey(req, tenantId);
    const existing = await SallaOauthTokensRepo.findByTenantId(req, tenantId);

    await SallaOauthTokensRepo.upsertByTenant(req, tenantId, {
      tenant_unique_key: existing?.tenant_unique_key
        ? String(existing.tenant_unique_key)
        : tenantUniqueKey,
      token_status: "active",

      access_token_enc: encryptText(accessToken),
      refresh_token_enc: refreshToken ? encryptText(refreshToken) : existing?.refresh_token_enc ?? null,

      token_type: tokenType,
      scopes: scope,

      access_token_expires_at: accessTokenExpiresAt,
      last_token_refresh_at: nowStr,

      installed_at: existing?.installed_at ? String(existing.installed_at) : nowStr,
      uninstalled_at: null,
    });

    const storeInfo = await verifyStoreProfile(accessToken).catch(() => null);

    if (storeInfo) {
      await TenantsRepo.updateSallaConnectionFields(req, tenantId, {
        salla_store_id: storeInfo.salla_store_id ?? "",
        store_name: storeInfo.store_name ?? "",
        store_domain: storeInfo.store_domain ?? null,
        status: "connected",
      });
      return { ok: true, verified: true };
    }

    await TenantsRepo.updateSallaConnectionFields(req, tenantId, {
      status: "connected_unverified",
    });
    return { ok: true, verified: false };
  }

  static async getValidAccessTokenForTenant(req: any, tenantId: string) {
    const { clientId, clientSecret, tokenUrl } = getOAuthConfig(); // ensure configured
    void clientId; void clientSecret; // (kept for clarity; used below)

    const tid = assertDigits(tenantId);
    const row = await SallaOauthTokensRepo.findByTenantId(req, tid);

    if (!row || !row.access_token_enc || row.access_token_enc === "__revoked__") {
      throw new AppError(409, "Salla not connected", "SALLA_NOT_CONNECTED");
    }

    if (row.token_status === "active" && !shouldRefresh(row.access_token_expires_at)) {
      return decryptText(String(row.access_token_enc));
    }

    const refreshEnc = row.refresh_token_enc ? String(row.refresh_token_enc) : "";
    if (!refreshEnc || refreshEnc === "__revoked__") {
      await SallaOauthTokensRepo.upsertByTenant(req, tid, { token_status: "missing_refresh_token" });
      throw new AppError(409, "Refresh token missing; reconnect required", "REFRESH_TOKEN_MISSING");
    }

    const refreshToken = decryptText(refreshEnc);

    const form = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: String((env as any).SALLA_CLIENT_ID),
      client_secret: String((env as any).SALLA_CLIENT_SECRET),
      refresh_token: refreshToken,
    });

    const { ok, status, text, json } = await httpForm(tokenUrl, form);

    if (!ok) {
      await SallaOauthTokensRepo.upsertByTenant(req, tid, { token_status: "refresh_failed" });
      throw new AppError(502, "Token refresh failed", "OAUTH_REFRESH_FAILED", `HTTP ${status}: ${text}`);
    }

    const newAccess = String(json.access_token || "").trim();
    const newRefresh = String(json.refresh_token || "").trim();
    const expiresIn = Number(json.expires_in || 0);

    if (!newAccess) {
      await SallaOauthTokensRepo.upsertByTenant(req, tid, { token_status: "refresh_failed" });
      throw new AppError(502, "Refresh missing access_token", "OAUTH_REFRESH_INVALID");
    }

    const nowStr = toCatalystDateTime(new Date());
    const newExpiresAt = toExpiresAt(expiresIn);

    await SallaOauthTokensRepo.upsertByTenant(req, tid, {
      token_status: "active",
      access_token_enc: encryptText(newAccess),
      refresh_token_enc: newRefresh ? encryptText(newRefresh) : row.refresh_token_enc ?? null,
      access_token_expires_at: newExpiresAt,
      last_token_refresh_at: nowStr,
    });

    return newAccess;
  }

  static async handleUninstall(req: any, tenantId: string) {
    const tid = assertDigits(tenantId);
    const nowStr = toCatalystDateTime(new Date());

    await SallaOauthTokensRepo.revoke(req, tid, nowStr);
    await TenantsRepo.updateSallaConnectionFields(req, tid, { status: "uninstalled" });
  }
}
