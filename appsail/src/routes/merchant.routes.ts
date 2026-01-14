// appsail/src/routes/merchant.routes.ts
import { Router } from "express";
import { z } from "zod";
import { SallaOAuthService } from "../services/sallaOAuth.service";
import { TenantsRepo } from "../repositories/tenants.repo";
import { SallaOauthTokensRepo } from "../repositories/sallaOauthTokens.repo";
import { AppError } from "../lib/errors";
import { authMerchant } from "../middlewares/authMerchantPlaceholder";
import {
  validatePortalSlug,
  resolveTenantByPortalSlug,
  resolveTenantFromRouteParam,
} from "../lib/tenantResolve";
import { ReturnRequestsRepo } from "../repositories/returnRequests.repo";
import { ReturnItemsRepo } from "../repositories/returnItems.repo";

export const merchantRoutes = Router();

merchantRoutes.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "merchant",
    routes: [
      "POST /merchant/tenants",
      "GET  /merchant/oauth/start?portal_public_slug=...",

      "GET  /merchant/:tenantSlug/kpis",
      "GET  /merchant/:tenantSlug/returns",
      "GET  /merchant/:tenantSlug/returns/:return_number",
      "GET  /merchant/:tenantSlug/rules",
      "PUT  /merchant/:tenantSlug/rules",
      "GET  /merchant/:tenantSlug/settings",
      "PUT  /merchant/:tenantSlug/settings",
    ],
  });
});

/**
 * -------------------------
 * Existing endpoints (kept)
 * -------------------------
 */

merchantRoutes.post("/tenants", async (req: any, res, next) => {
  try {
    const body = z
      .object({
        portal_public_slug: z.string().min(1),
      })
      .parse(req.body);

    const slug = validatePortalSlug(body.portal_public_slug);

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

    await resolveTenantByPortalSlug(req, qs.portal_public_slug);

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

    await resolveTenantByPortalSlug(req, qs.portal_public_slug);

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
    const tenant = await resolveTenantByPortalSlug(req, qs.portal_public_slug);
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

/**
 * -----------------------------------------
 * Tenant-aware Merchant API
 * -----------------------------------------
 */

const kpisResponseSchema = z.object({
  awaiting_action: z.number().int().nonnegative(),
  transit_volume: z.number().int().nonnegative(),
  retention_rate: z.number().min(0).max(100),
  automation_pct: z.number().min(0).max(100),
  financial_guard: z.object({
    total_savings_sar: z.number().nonnegative(),
    delta_pct: z.number(),
    cash_refunded_sar: z.number(),
    credit_issued_sar: z.number(),
  }),
});
type MerchantKpis = z.infer<typeof kpisResponseSchema>;

function defaultKpis(): MerchantKpis {
  return {
    awaiting_action: 0,
    transit_volume: 0,
    retention_rate: 0,
    automation_pct: 0,
    financial_guard: {
      total_savings_sar: 0,
      delta_pct: 0,
      cash_refunded_sar: 0,
      credit_issued_sar: 0,
    },
  };
}

const rulesSchema = z.object({
  return_window_days: z.number().int().min(0).max(365).default(30),
  auto_approval_threshold_sar: z.number().min(0).default(150),
  accept_store_credit: z.boolean().default(true),
  allow_exchanges: z.boolean().default(true),
  auto_approve_low_value: z.boolean().default(true),
  category_overrides: z
    .array(
      z.object({
        category_name: z.string().min(1),
        rule: z.enum(["STANDARD_WINDOW", "NON_RETURNABLE", "DAY_LIMIT"]),
        day_limit: z.number().int().min(0).max(365).optional(),
      })
    )
    .default([]),
});
type MerchantRules = z.infer<typeof rulesSchema>;

function defaultRules(): MerchantRules {
  return {
    return_window_days: 30,
    auto_approval_threshold_sar: 150,
    accept_store_credit: true,
    allow_exchanges: true,
    auto_approve_low_value: true,
    category_overrides: [],
  };
}

const settingsSchema = z.object({
  branding: z
    .object({
      primary_color: z.string().min(1).default("#4f46e5"),
      logo_url: z.string().url().optional(),
    })
    .default({ primary_color: "#4f46e5" }),
  portal: z
    .object({
      support_email: z.string().email().optional(),
      policy_url: z.string().url().optional(),
    })
    .default({}),
});
type MerchantSettings = z.infer<typeof settingsSchema>;

function readNested<T>(obj: any, path: string[]): T | undefined {
  let cur = obj;
  for (const k of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[k];
  }
  return cur as T;
}

merchantRoutes.get("/:tenantSlug/kpis", authMerchant, async (req: any, res, next) => {
  try {
    const tenant = req.tenant ?? (await resolveTenantFromRouteParam(req, "tenantSlug"));
    const flags = await TenantsRepo.getFlagsObject(req, tenant.ROWID);

    const stored = readNested<MerchantKpis>(flags, ["merchant", "kpis"]);
    const kpis = stored ? kpisResponseSchema.parse(stored) : defaultKpis();

    res.json({
      ok: true,
      tenant: {
        tenant_id: tenant.ROWID,
        portal_public_slug: tenant.portal_public_slug,
        store_name: tenant.store_name ?? null,
        store_domain: tenant.store_domain ?? null,
      },
      kpis,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * ✅ Merchant returns inbox (DB-backed)
 * Query params:
 * - status (optional)
 * - limit  (optional, max 200)
 */
merchantRoutes.get("/:tenantSlug/returns", authMerchant, async (req: any, res, next) => {
  try {
    const tenant = req.tenant ?? (await resolveTenantFromRouteParam(req, "tenantSlug"));

    const qs = z
      .object({
        status: z.string().optional(),
        limit: z
          .string()
          .optional()
          .transform((v) => (v == null || v.trim() === "" ? undefined : Number(v))),
      })
      .parse(req.query);

    const rows = await ReturnRequestsRepo.listByTenant(req, tenant.ROWID, {
      status: qs.status ? String(qs.status).trim() : undefined,
      limit: typeof qs.limit === "number" && Number.isFinite(qs.limit) ? qs.limit : 200,
    });

    res.json({
      ok: true,
      tenant: {
        tenant_id: tenant.ROWID,
        portal_public_slug: tenant.portal_public_slug,
      },
      items: rows.map((r) => ({
        return_request_id: r.ROWID,
        return_number: r.return_number,
        order_number: r.order_number,
        order_id_external: r.order_id_external ?? null,
        requested_resolution: r.requested_resolution,
        status: r.status,
        status_reason: r.status_reason ?? null,
        requested_at: r.requested_at,
        resolved_at: r.resolved_at ?? null,
        total_items_count: Number(r.total_items_count ?? 0),
        total_request_value: r.total_request_value == null ? null : Number(r.total_request_value),
        is_warranty: Boolean(r.is_warranty),
      })),
      page: { next_cursor: null },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * ✅ Merchant return detail (DB-backed)
 */
merchantRoutes.get("/:tenantSlug/returns/:return_number", authMerchant, async (req: any, res, next) => {
  try {
    const tenant = req.tenant ?? (await resolveTenantFromRouteParam(req, "tenantSlug"));

    const params = z
      .object({
        return_number: z.string().min(1),
      })
      .parse(req.params);

    const rr = await ReturnRequestsRepo.findByReturnNumber(req, tenant.ROWID, params.return_number);
    if (!rr) throw new AppError(404, "Return not found", "RETURN_NOT_FOUND");

    const items = await ReturnItemsRepo.listByReturnRequestId(req, tenant.ROWID, rr.ROWID);

    res.json({
      ok: true,
      tenant: { tenant_id: tenant.ROWID, portal_public_slug: tenant.portal_public_slug },
      return: {
        return_request_id: rr.ROWID,
        return_number: rr.return_number,
        order_number: rr.order_number,
        order_id_external: rr.order_id_external ?? null,

        requested_resolution: rr.requested_resolution,
        status: rr.status,
        status_reason: rr.status_reason ?? null,

        requested_at: rr.requested_at,
        approved_at: rr.approved_at ?? null,
        received_at: rr.received_at ?? null,
        resolved_at: rr.resolved_at ?? null,

        notes_customer: rr.notes_customer ?? null,
        notes_internal: rr.notes_internal ?? null,

        total_items_count: Number(rr.total_items_count ?? 0),
        total_request_value: rr.total_request_value == null ? null : Number(rr.total_request_value),
        is_warranty: Boolean(rr.is_warranty),

        items: items.map((it) => ({
          return_item_id: it.ROWID,
          sku: it.sku,
          product_name: it.product_name ?? null,
          variant_name: it.variant_name ?? null,
          quantity: Number((it as any).quantity ?? 0),
          unit_price: (it as any).unit_price == null ? null : Number((it as any).unit_price),
          reason_code: it.reason_code,
          reason_note: it.reason_note ?? null,
          decision: it.decision,
          decision_reason: it.decision_reason ?? null,
        })),
      },
    });
  } catch (e) {
    next(e);
  }
});

merchantRoutes.get("/:tenantSlug/rules", authMerchant, async (req: any, res, next) => {
  try {
    const tenant = req.tenant ?? (await resolveTenantFromRouteParam(req, "tenantSlug"));
    const flags = await TenantsRepo.getFlagsObject(req, tenant.ROWID);

    const stored = readNested<MerchantRules>(flags, ["merchant", "rules"]);
    const rules = stored ? rulesSchema.parse(stored) : defaultRules();

    res.json({
      ok: true,
      tenant: { tenant_id: tenant.ROWID, portal_public_slug: tenant.portal_public_slug },
      rules,
    });
  } catch (e) {
    next(e);
  }
});

merchantRoutes.put("/:tenantSlug/rules", authMerchant, async (req: any, res, next) => {
  try {
    const tenant = req.tenant ?? (await resolveTenantFromRouteParam(req, "tenantSlug"));
    const body = rulesSchema.parse(req.body ?? {});

    const merged = await TenantsRepo.mergeFlagsObject(req, tenant.ROWID, {
      merchant: {
        rules: body,
      },
    });

    res.json({
      ok: true,
      tenant: { tenant_id: tenant.ROWID, portal_public_slug: tenant.portal_public_slug },
      rules: rulesSchema.parse(readNested<any>(merged, ["merchant", "rules"]) ?? body),
    });
  } catch (e) {
    next(e);
  }
});

merchantRoutes.get("/:tenantSlug/settings", authMerchant, async (req: any, res, next) => {
  try {
    const tenant = req.tenant ?? (await resolveTenantFromRouteParam(req, "tenantSlug"));
    const flags = await TenantsRepo.getFlagsObject(req, tenant.ROWID);

    const stored = readNested<MerchantSettings>(flags, ["merchant", "settings"]);
    const settings = stored ? settingsSchema.parse(stored) : settingsSchema.parse({});

    res.json({
      ok: true,
      tenant: { tenant_id: tenant.ROWID, portal_public_slug: tenant.portal_public_slug },
      settings,
    });
  } catch (e) {
    next(e);
  }
});

merchantRoutes.put("/:tenantSlug/settings", authMerchant, async (req: any, res, next) => {
  try {
    const tenant = req.tenant ?? (await resolveTenantFromRouteParam(req, "tenantSlug"));
    const body = settingsSchema.parse(req.body ?? {});

    const merged = await TenantsRepo.mergeFlagsObject(req, tenant.ROWID, {
      merchant: {
        settings: body,
      },
    });

    res.json({
      ok: true,
      tenant: { tenant_id: tenant.ROWID, portal_public_slug: tenant.portal_public_slug },
      settings: settingsSchema.parse(readNested<any>(merged, ["merchant", "settings"]) ?? body),
    });
  } catch (e) {
    next(e);
  }
});
