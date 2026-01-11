import { Router } from "express";
import { z } from "zod";
import { SallaOAuthService } from "../services/sallaOAuth.service";
import { TenantsRepo } from "../repositories/tenants.repo";
import { SallaOauthTokensRepo } from "../repositories/sallaOauthTokens.repo";
import { AppError } from "../lib/errors";
import { env } from "../env";

export const merchantRoutes = Router();

async function resolveTenantBySlug(req: any, portal_public_slug: string) {
  const slug = String(portal_public_slug ?? "").trim();
  if (!slug) throw new AppError(400, "portal_public_slug is required", "PORTAL_SLUG_REQUIRED");

  const tenant = await TenantsRepo.findByPortalSlug(req, slug);
  if (!tenant) throw new AppError(404, "Unknown portal_public_slug", "TENANT_NOT_FOUND");

  return tenant;
}

function requireEnvString(name: string, val: any) {
  const s = typeof val === "string" ? val.trim() : "";
  if (!s) throw new AppError(500, `Missing ${name}`, "MERCHANT_CONFIG_MISSING");
  return s;
}

function requireValidAbsoluteUrl(name: string, val: any) {
  const s = requireEnvString(name, val);
  try {
    // eslint-disable-next-line no-new
    new URL(s);
  } catch {
    throw new AppError(500, `Invalid URL in ${name}`, "MERCHANT_CONFIG_INVALID");
  }
  return s;
}

function buildInstallUrl(args: { portal_public_slug: string }): string {
  const base = (env as any).SALLA_INSTALL_URL_BASE || "https://s.salla.sa/apps/install";
  const appId = (env as any).SALLA_APP_ID;

  const baseUrl = requireValidAbsoluteUrl("SALLA_INSTALL_URL_BASE", String(base)).replace(/\/+$/, "");
  const sallaAppId = requireEnvString("SALLA_APP_ID", appId);

  const u = new URL(`${baseUrl}/${encodeURIComponent(sallaAppId)}`);
  u.searchParams.set("portal_public_slug", String(args.portal_public_slug || "").trim());
  return u.toString();
}

merchantRoutes.get("/oauth/start", async (req: any, res, next) => {
  try {
    const qs = z
      .object({
        portal_public_slug: z.string().min(1),
        mode: z.enum(["json", "redirect", "install"]).optional(),
      })
      .parse(req.query);

    await resolveTenantBySlug(req, qs.portal_public_slug);

    const mode = qs.mode || "redirect";

    if (mode === "install") {
      const installUrl = buildInstallUrl({ portal_public_slug: qs.portal_public_slug });
      return res.redirect(installUrl);
    }

    const result = await SallaOAuthService.start(req, {
      portal_public_slug: qs.portal_public_slug,
    });

    if (mode === "json") return res.json(result);
    return res.redirect(result.url);
  } catch (e) {
    next(e);
  }
});

merchantRoutes.get("/oauth/status", async (req: any, res, next) => {
  try {
    const qs = z
      .object({
        portal_public_slug: z.string().min(1),
      })
      .parse(req.query);

    const tenant = await resolveTenantBySlug(req, qs.portal_public_slug);
    const row = await SallaOauthTokensRepo.findByTenantId(req, tenant.ROWID);

    if (!row) {
      return res.json({
        ok: true,
        connected: false,
        portal_public_slug: tenant.portal_public_slug,
        tenant: {
          tenant_id: tenant.ROWID,
          status: tenant.status ?? null,
          salla_store_id: tenant.salla_store_id ?? null,
          store_name: tenant.store_name ?? null,
          store_domain: tenant.store_domain ?? null,
        },
        token: null,
      });
    }

    const tokenStatus = String(row.token_status || "").toLowerCase();
    const connected = tokenStatus === "active";

    return res.json({
      ok: true,
      connected,
      portal_public_slug: tenant.portal_public_slug,
      tenant: {
        tenant_id: tenant.ROWID,
        status: tenant.status ?? null,
        salla_store_id: tenant.salla_store_id ?? null,
        store_name: tenant.store_name ?? null,
        store_domain: tenant.store_domain ?? null,
      },
      token: {
        token_status: row.token_status ?? null,
        scopes: row.scopes ?? null,
        token_type: row.token_type ?? null,
        access_token_expires_at: row.access_token_expires_at ?? null,
        last_token_refresh_at: row.last_token_refresh_at ?? null,
        installed_at: row.installed_at ?? null,
        uninstalled_at: row.uninstalled_at ?? null,
      },
    });
  } catch (e) {
    next(e);
  }
});
