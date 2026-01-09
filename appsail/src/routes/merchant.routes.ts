// appsail/src/routes/merchant.routes.ts
import { Router } from "express";
import { z } from "zod";
import { SallaOAuthService } from "../services/sallaOAuth.service";
import { TenantsRepo } from "../repositories/tenants.repo";
import { SallaOauthTokensRepo } from "../repositories/sallaOauthTokens.repo";
import { AppError } from "../lib/errors";

// Optional: if you already have a placeholder auth middleware, you can enable it.
// import { authMerchantPlaceholder } from "../middlewares/authMerchantPlaceholder";

export const merchantRoutes = Router();

function assertRowIdDigits(id: any) {
  const v = String(id ?? "").trim();
  if (!/^\d+$/.test(v)) throw new AppError(400, "Invalid tenant_id", "TENANT_ID_INVALID");
  return v;
}

/**
 * Accept either:
 * - tenant_id (ROWID digits)
 * - portal_public_slug (we resolve to tenant ROWID)
 */
async function resolveTenantRowId(req: any, q: any): Promise<string> {
  if (q.tenant_id) return assertRowIdDigits(q.tenant_id);

  if (q.portal_public_slug) {
    const tenant = await TenantsRepo.findByPortalSlug(req, String(q.portal_public_slug));
    if (!tenant) throw new AppError(400, "Invalid portal", "TENANT_NOT_FOUND");
    return assertRowIdDigits(tenant.ROWID);
  }

  throw new AppError(400, "tenant_id or portal_public_slug is required", "TENANT_REQUIRED");
}

/**
 * GET /merchant/oauth/start?tenant_id=1768...  (or ?portal_public_slug=aaa)
 * Returns JSON { ok, url } and also supports redirect mode.
 */
merchantRoutes.get("/oauth/start", async (req: any, res, next) => {
  try {
    // authMerchantPlaceholder(req, res, next) // enable if you want merchant-side protection

    const qs = z
      .object({
        tenant_id: z.union([z.string(), z.number()]).optional(),
        portal_public_slug: z.string().min(1).optional(),
        mode: z.enum(["json", "redirect"]).optional(), // redirect by default if not json
      })
      .parse(req.query);

    const tenantRowId = await resolveTenantRowId(req, qs);

    const result = await SallaOAuthService.start(req, { tenantRowId });

    // Default behavior = redirect
    const mode = qs.mode || "redirect";
    if (mode === "json") return res.json(result);

    return res.redirect(result.url);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /merchant/oauth/callback?code=...&state=...
 * Exchanges tokens + stores encrypted tokens in salla_oauth_tokens.
 */
merchantRoutes.get("/oauth/callback", async (req: any, res, next) => {
  try {
    const qs = z
      .object({
        code: z.string().min(1),
        state: z.string().min(1),
      })
      .parse(req.query);

    await SallaOAuthService.callback(req, {
      code: String(qs.code),
      state: String(qs.state),
    });

    // Simple success page (replace later with redirect to your web UI)
    res.status(200).send(`
      <html>
        <head><title>Salla Connected</title></head>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <h2>✅ Salla OAuth Connected</h2>
          <p>You can close this window now.</p>
        </body>
      </html>
    `);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /merchant/oauth/status?tenant_id=...
 * Returns safe status for merchant UI (NO tokens).
 */
merchantRoutes.get("/oauth/status", async (req: any, res, next) => {
  try {
    const qs = z
      .object({
        tenant_id: z.union([z.string(), z.number()]).optional(),
        portal_public_slug: z.string().min(1).optional(),
      })
      .parse(req.query);

    const tenantRowId = await resolveTenantRowId(req, qs);
    const row = await SallaOauthTokensRepo.findByTenantId(req, tenantRowId);

    if (!row) {
      return res.json({
        ok: true,
        connected: false,
        tenant_id: tenantRowId,
      });
    }

    return res.json({
      ok: true,
      connected: String(row.token_status || "").toLowerCase() === "active",
      tenant_id: tenantRowId,
      token_status: row.token_status ?? null,
      scopes: row.scopes ?? null,
      access_token_expires_at: row.access_token_expires_at ?? null,
      last_token_refresh_at: row.last_token_refresh_at ?? null,
      installed_at: row.installed_at ?? null,
      uninstalled_at: row.uninstalled_at ?? null,
      tenant_unique_key: row.tenant_unique_key ?? null,
    });
  } catch (e) {
    next(e);
  }
});
