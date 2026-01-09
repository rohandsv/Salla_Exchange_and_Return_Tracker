import crypto from "crypto";
import { env } from "../env";
import { AppError } from "../lib/errors";
import { encryptText } from "../lib/crypto";
import { toCatalystDateTime } from "../lib/datetime";
import { getCatalystApp } from "../lib/catalyst";
import { OAuthStatesRepo } from "../repositories/oauthStates.repo";
import { SallaOauthTokensRepo } from "../repositories/sallaOauthTokens.repo";

function assertDigits(v: any) {
  const s = String(v ?? "").trim();
  if (!/^\d+$/.test(s)) throw new Error("Expected ROWID digits");
  return s;
}

function requireEnvString(name: keyof typeof env) {
  const val = (env as any)[name];
  if (!val || typeof val !== "string") {
    throw new AppError(500, `Missing ${String(name)}`, "OAUTH_NOT_CONFIGURED");
  }
  return val;
}

export class SallaOAuthService {
  /**
   * Derive a stable unique key for salla_oauth_tokens.tenant_unique_key.
   * Prefer store_domain or salla_store_id if present; otherwise fallback to tenant ROWID.
   */
  private static async getTenantUniqueKey(req: any, tenantRowId: string): Promise<string> {
    const app = getCatalystApp(req);
    const rowId = assertDigits(tenantRowId);

    // safest read
    const tenant: any = await app.datastore().table("tenants").getRow(rowId as any).catch(() => null);

    const storeDomain = tenant?.store_domain ? String(tenant.store_domain).trim() : "";
    const storeId = tenant?.salla_store_id ? String(tenant.salla_store_id).trim() : "";

    if (storeDomain) return `domain:${storeDomain.toLowerCase()}`;
    if (storeId) return `store:${storeId}`;
    return `tenant:${rowId}`;
  }

  /**
   * 1) Start OAuth -> returns authorization URL
   * GET /merchant/oauth/start?portal_public_slug=aaa&mode=json
   */
  static async start(req: any, args: { tenantRowId: string }) {
    requireEnvString("SALLA_CLIENT_ID");

    const tenantId = assertDigits(args.tenantRowId);

    const state = crypto.randomBytes(24).toString("base64url");
    const expiresAt = toCatalystDateTime(new Date(Date.now() + 10 * 60 * 1000)); // 10 mins

    // IMPORTANT: oauth_states has ONLY these columns
    await OAuthStatesRepo.insert(req, {
      tenant_id: tenantId,
      state,
      expires_at: expiresAt,
    });

    // From Salla docs:
    // Authorization Endpoint: https://accounts.salla.sa/oauth2/auth
    const authorizeUrl =
      env.SALLA_OAUTH_AUTHORIZE_URL || "https://accounts.salla.sa/oauth2/auth";

    // Your callback MUST match the one set in Salla Partner Portal
    // Prefer explicit env override if your portal uses /auth/callback
    const redirectUri =
      env.SALLA_OAUTH_REDIRECT_URI || `${env.APP_BASE_URL}/merchant/oauth/callback`;

    const url =
      `${authorizeUrl}?` +
      new URLSearchParams({
        response_type: "code",
        client_id: String(env.SALLA_CLIENT_ID),
        redirect_uri: redirectUri,
        state,
        // scope: "offline_access" // enable when you want refresh tokens
      }).toString();

    return { ok: true, url, state_expires_at: expiresAt };
  }

  /**
   * 2) Callback -> exchange code for tokens -> store encrypted
   */
  static async callback(req: any, args: { code: string; state: string }) {
    requireEnvString("SALLA_CLIENT_ID");
    requireEnvString("SALLA_CLIENT_SECRET");

    const code = String(args.code ?? "").trim();
    const state = String(args.state ?? "").trim();
    if (!code || !state) throw new AppError(400, "Missing code/state", "OAUTH_CALLBACK_INVALID");

    const st = await OAuthStatesRepo.findValid(req, state);
    if (!st) throw new AppError(400, "Invalid/expired state", "OAUTH_STATE_INVALID");

    // one-time use
    await OAuthStatesRepo.deleteByRowId(req, st.ROWID);

    const tenantId = assertDigits(st.tenant_id);

    // From Salla docs:
    // Token Endpoint: https://accounts.salla.sa/oauth2/token
    const tokenUrl = env.SALLA_OAUTH_TOKEN_URL || "https://accounts.salla.sa/oauth2/token";

    const redirectUri =
      env.SALLA_OAUTH_REDIRECT_URI || `${env.APP_BASE_URL}/merchant/oauth/callback`;

    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: String(env.SALLA_CLIENT_ID),
      client_secret: String(env.SALLA_CLIENT_SECRET),
      redirect_uri: redirectUri,
      code,
    });

    const resp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new AppError(400, "Token exchange failed", "OAUTH_TOKEN_EXCHANGE_FAILED", txt);
    }

    const json: any = await resp.json().catch(() => ({}));

    const accessToken = String(json.access_token || "").trim();
    const refreshToken = String(json.refresh_token || "").trim();
    const tokenType = json.token_type ? String(json.token_type) : "Bearer";
    const expiresIn = Number(json.expires_in || 0);
    const scope = json.scope ? String(json.scope) : null;

    if (!accessToken) throw new AppError(400, "Missing access_token", "OAUTH_TOKEN_INVALID");

    const nowStr = toCatalystDateTime(new Date());
    const accessTokenExpiresAt =
      expiresIn > 0 ? toCatalystDateTime(new Date(Date.now() + expiresIn * 1000)) : null;

    const tenantUniqueKey = await this.getTenantUniqueKey(req, tenantId);

    const existing = await SallaOauthTokensRepo.findByTenantId(req, tenantId);

    await SallaOauthTokensRepo.upsertByTenant(req, tenantId, {
      // required by your schema
      tenant_unique_key: existing?.tenant_unique_key ? String(existing.tenant_unique_key) : tenantUniqueKey,
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

    return { ok: true };
  }
}
