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

import {
  returnNumberParamSchema,
  setItemsSchema,
  approveReturnSchema,
  rejectReturnSchema,
  receiveReturnSchema,
  resolveReturnSchema,
} from "../validators/merchantReturns.zod";

import { MerchantReturnsService } from "../services/merchantReturns.service";

export const merchantRoutes = Router();

/**
 * ✅ Base route
 */
merchantRoutes.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "merchant",
    routes: [
      "POST /merchant/tenants",
      "GET  /merchant/oauth/start?portal_public_slug=...",
      "POST /merchant/oauth/start",
      "GET  /merchant/oauth/status?portal_public_slug=...",

      "GET  /merchant/:tenantSlug/kpis",

      "GET  /merchant/:tenantSlug/returns",
      "GET  /merchant/:tenantSlug/returns/:return_number",

      "POST /merchant/:tenantSlug/returns/:return_number/items",
      "POST /merchant/:tenantSlug/returns/:return_number/approve",
      "POST /merchant/:tenantSlug/returns/:return_number/reject",
      "POST /merchant/:tenantSlug/returns/:return_number/received",
      "POST /merchant/:tenantSlug/returns/:return_number/resolve",

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
    const body = z.object({ portal_public_slug: z.string().min(1) }).parse(req.body);
    const slug = validatePortalSlug(body.portal_public_slug);

    let tenant = await TenantsRepo.findByPortalSlug(req, slug);

    if (!tenant) {
      await TenantsRepo.create(req, { portal_public_slug: slug, status: "draft" });
      tenant = await TenantsRepo.findByPortalSlug(req, slug);
      if (!tenant) throw new AppError(500, "Tenant created but could not be loaded", "TENANT_CREATE_FAILED");

      return res.status(201).json({
        ok: true,
        created: true,
        tenant: { tenant_id: tenant.ROWID, portal_public_slug: tenant.portal_public_slug, status: tenant.status ?? null },
      });
    }

    return res.json({
      ok: true,
      created: false,
      tenant: { tenant_id: tenant.ROWID, portal_public_slug: tenant.portal_public_slug, status: tenant.status ?? null },
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
 * ----------------------------
 * Returns listing + details
 * ----------------------------
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
      tenant: { tenant_id: tenant.ROWID, portal_public_slug: tenant.portal_public_slug },
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

merchantRoutes.get("/:tenantSlug/returns/:return_number", authMerchant, async (req: any, res, next) => {
  try {
    const tenant = req.tenant ?? (await resolveTenantFromRouteParam(req, "tenantSlug"));
    const params = returnNumberParamSchema.parse(req.params);

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

/**
 * ----------------------------
 * ✅ Merchant action routes
 * ----------------------------
 */
merchantRoutes.post("/:tenantSlug/returns/:return_number/items", authMerchant, async (req: any, res, next) => {
  try {
    const tenant = req.tenant ?? (await resolveTenantFromRouteParam(req, "tenantSlug"));
    const params = returnNumberParamSchema.parse(req.params);
    const body = setItemsSchema.parse(req.body ?? {});

    const { rr, items } = await MerchantReturnsService.setItemDecisions(req, tenant.ROWID, params.return_number, body.items);
    return res.json({ ok: true, return_request_id: rr.ROWID, return_number: rr.return_number, items });
  } catch (e) {
    next(e);
  }
});

merchantRoutes.post("/:tenantSlug/returns/:return_number/approve", authMerchant, async (req: any, res, next) => {
  try {
    const tenant = req.tenant ?? (await resolveTenantFromRouteParam(req, "tenantSlug"));
    const params = returnNumberParamSchema.parse(req.params);
    const body = approveReturnSchema.parse(req.body ?? {});

    const { rr, items } = await MerchantReturnsService.approve(req, tenant.ROWID, params.return_number, body);
    return res.json({ ok: true, return_request_id: rr.ROWID, return_number: rr.return_number, status: "approved", items });
  } catch (e) {
    next(e);
  }
});

merchantRoutes.post("/:tenantSlug/returns/:return_number/reject", authMerchant, async (req: any, res, next) => {
  try {
    const tenant = req.tenant ?? (await resolveTenantFromRouteParam(req, "tenantSlug"));
    const params = returnNumberParamSchema.parse(req.params);
    const body = rejectReturnSchema.parse(req.body ?? {});

    const { rr } = await MerchantReturnsService.reject(req, tenant.ROWID, params.return_number, body);
    return res.json({ ok: true, return_request_id: rr.ROWID, return_number: rr.return_number, status: "rejected" });
  } catch (e) {
    next(e);
  }
});

merchantRoutes.post("/:tenantSlug/returns/:return_number/received", authMerchant, async (req: any, res, next) => {
  try {
    const tenant = req.tenant ?? (await resolveTenantFromRouteParam(req, "tenantSlug"));
    const params = returnNumberParamSchema.parse(req.params);
    const body = receiveReturnSchema.parse(req.body ?? {});

    const { rr } = await MerchantReturnsService.markReceived(req, tenant.ROWID, params.return_number, body);
    return res.json({ ok: true, return_request_id: rr.ROWID, return_number: rr.return_number, status: "received" });
  } catch (e) {
    next(e);
  }
});

merchantRoutes.post("/:tenantSlug/returns/:return_number/resolve", authMerchant, async (req: any, res, next) => {
  try {
    const tenant = req.tenant ?? (await resolveTenantFromRouteParam(req, "tenantSlug"));
    const params = returnNumberParamSchema.parse(req.params);
    const body = resolveReturnSchema.parse(req.body ?? {});

    const { rr } = await MerchantReturnsService.resolve(req, tenant.ROWID, params.return_number, body);

    return res.json({
      ok: true,
      return_request_id: rr.ROWID,
      return_number: rr.return_number,
      status: "resolved",
      resolution_type: body.type,
    });
  } catch (e) {
    next(e);
  }
});
