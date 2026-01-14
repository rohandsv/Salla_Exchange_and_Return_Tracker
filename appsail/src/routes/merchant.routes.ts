import { Router } from "express";
import { z } from "zod";
import { SallaOAuthService } from "../services/sallaOAuth.service";
import { TenantsRepo } from "../repositories/tenants.repo";
import { SallaOauthTokensRepo } from "../repositories/sallaOauthTokens.repo";
import { AppError } from "../lib/errors";
import { env } from "../env";

export const merchantRoutes = Router();

function isTruthy(v: any) {
  const s = String(v ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(s);
}

function isProdEnv() {
  const nodeEnv = String(process.env.NODE_ENV ?? "").toLowerCase();
  const catalystEnv = String((env as any).CATALYST_ENV ?? "").toLowerCase();
  return nodeEnv === "production" || catalystEnv === "production";
}

function devAutoProvisionEnabled() {
  if (isProdEnv()) return false;
  const flag = (env as any).DEV_AUTO_PROVISION_TENANT ?? process.env.DEV_AUTO_PROVISION_TENANT ?? "";
  if (String(flag).trim() === "") return true;
  return isTruthy(flag);
}

function normalizeSlug(slug: string) {
  return String(slug ?? "").trim();
}

function validateSlug(slug: string) {
  const s = normalizeSlug(slug);
  if (!s) throw new AppError(400, "portal_public_slug is required", "PORTAL_SLUG_REQUIRED");
  if (s.length > 120) throw new AppError(400, "portal_public_slug too long", "PORTAL_SLUG_INVALID");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9\-._~]*$/.test(s)) {
    throw new AppError(400, "portal_public_slug contains invalid characters", "PORTAL_SLUG_INVALID");
  }
  return s;
}

async function resolveTenantBySlug(req: any, portal_public_slug: string) {
  const slug = validateSlug(portal_public_slug);

  let tenant = await TenantsRepo.findByPortalSlug(req, slug);

  if (!tenant && devAutoProvisionEnabled()) {
    tenant = await TenantsRepo.create(req, { portal_public_slug: slug, status: "draft" });
  }

  if (!tenant) throw new AppError(404, "Unknown portal_public_slug", "TENANT_NOT_FOUND");
  return tenant;
}

merchantRoutes.post("/tenants", async (req: any, res, next) => {
  try {
    const body = z
      .object({
        portal_public_slug: z.string().min(1),
      })
      .parse(req.body);

    const slug = validateSlug(body.portal_public_slug);

    let tenant = await TenantsRepo.findByPortalSlug(req, slug);

    if (!tenant) {
      await TenantsRepo.create(req, { portal_public_slug: slug, status: "draft" });
      tenant = await TenantsRepo.findByPortalSlug(req, slug);
      if (!tenant) {
        throw new AppError(500, "Tenant created but could not be loaded", "TENANT_CREATE_FAILED");
      }

      return res.status(201).json({
        ok: true,
        created: true,
        tenant: {
          tenant_id: tenant.ROWID,
          portal_public_slug: tenant.portal_public_slug,
          status: tenant.status ?? null,
        },
      });
    }

    return res.json({
      ok: true,
      created: false,
      tenant: {
        tenant_id: tenant.ROWID,
        portal_public_slug: tenant.portal_public_slug,
        status: tenant.status ?? null,
      },
    });
  } catch (e) {
    next(e);
  }
});

merchantRoutes.get("/oauth/start", async (req: any, res, next) => {
  try {
    const qs = z
      .object({
        portal_public_slug: z.string().min(1),
        mode: z.enum(["json", "redirect"]).optional(),
      })
      .parse(req.query);

    await resolveTenantBySlug(req, qs.portal_public_slug);

    const result = await SallaOAuthService.start(req, { portal_public_slug: qs.portal_public_slug });

    const mode = qs.mode || "redirect";
    if (mode === "json") return res.json(result);
    return res.redirect(result.url);
  } catch (e) {
    next(e);
  }
});

merchantRoutes.post("/oauth/start", async (req: any, res, next) => {
  try {
    const input = { ...req.query, ...(req.body ?? {}) };

    const qs = z
      .object({
        portal_public_slug: z.string().min(1),
        mode: z.enum(["json", "redirect"]).optional(),
      })
      .parse(input);

    await resolveTenantBySlug(req, qs.portal_public_slug);

    const result = await SallaOAuthService.start(req, { portal_public_slug: qs.portal_public_slug });

    const mode = qs.mode || "redirect";
    if (mode === "json") return res.json(result);
    return res.redirect(result.url);
  } catch (e) {
    next(e);
  }
});

merchantRoutes.get("/oauth/status", async (req: any, res, next) => {
  try {
    const qs = z.object({ portal_public_slug: z.string().min(1) }).parse(req.query);
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
        oauth_mode: SallaOAuthService.mode(),
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
      oauth_mode: SallaOAuthService.mode(),
    });
  } catch (e) {
    next(e);
  }
});
