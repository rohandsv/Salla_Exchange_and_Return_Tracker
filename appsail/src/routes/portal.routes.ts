import { Router } from "express";
import { requestOtpSchema, verifyOtpSchema } from "../validators/portal.zod";
import {
  createReturnSchema,
  returnNumberParamSchema,
  cancelReturnSchema,
} from "../validators/returns.zod";
import { OtpService } from "../services/otp.service";
import { PortalAuthService } from "../services/portalAuth.service";
import { ReturnsService } from "../services/returns.service";
import { TenantsRepo } from "../repositories/tenants.repo";
import { authPortal } from "../middlewares/authPortal";
import { AppError } from "../lib/errors";

export const portalRoutes = Router();

/**
 * ✅ Base route so GET /portal doesn't return NOT_FOUND
 */
portalRoutes.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "portal",
    routes: [
      "POST /portal/request-otp",
      "POST /portal/verify-otp",
      "GET  /portal/me",
      "POST /portal/returns",
      "GET  /portal/returns",
      "GET  /portal/returns/:return_number",
      "POST /portal/returns/:return_number/cancel",
    ],
  });
});

/**
 * Resolve tenant ROWID internally using portal_public_slug.
 */
async function resolveTenantRowId(req: any, body: any): Promise<string> {
  if (body.tenant_id) return String(body.tenant_id);

  if (body.portal_public_slug) {
    const slug = String(body.portal_public_slug ?? "").trim();
    if (!slug) throw new AppError(400, "portal_public_slug is required", "TENANT_REQUIRED");

    let tenant = await TenantsRepo.findByPortalSlug(req, slug);

    // ✅ dev-only auto-provision
    const nodeEnv = String(process.env.NODE_ENV ?? "").toLowerCase();
    const catalystEnv = String((process.env as any).CATALYST_ENV ?? "").toLowerCase();
    const isProd = nodeEnv === "production" || catalystEnv === "production";

    const flag = process.env.DEV_AUTO_PROVISION_TENANT;
    const allowAuto =
      !isProd && (flag ? ["1", "true", "yes", "on"].includes(String(flag).toLowerCase()) : true);

    if (!tenant && allowAuto) {
      tenant = await TenantsRepo.create(req, { portal_public_slug: slug, status: "draft" });
    }

    if (!tenant) throw new AppError(404, "Unknown portal_public_slug", "TENANT_NOT_FOUND");
    return String(tenant.ROWID);
  }

  throw new AppError(400, "portal_public_slug is required", "TENANT_REQUIRED");
}

/**
 * 1) Request OTP
 */
portalRoutes.post("/request-otp", async (req: any, res, next) => {
  try {
    const body = requestOtpSchema.parse(req.body);
    const tenantRowId = await resolveTenantRowId(req, body);

    const result = await OtpService.requestOtp(req, {
      tenantId: tenantRowId,
      orderNumber: body.order_number,
      channel: body.channel,
      contact: body.contact,
      requestIp: req.ip,
      userAgent: req.headers["user-agent"] || "",
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
});

/**
 * 2) Verify OTP -> create portal session -> return session_token
 */
portalRoutes.post("/verify-otp", async (req: any, res, next) => {
  try {
    const body = verifyOtpSchema.parse(req.body);
    const tenantRowId = await resolveTenantRowId(req, body);

    const result = await PortalAuthService.verifyOtpAndCreateSession(req, {
      tenantId: tenantRowId,
      orderNumber: body.order_number,
      channel: body.channel,
      contact: body.contact,
      otp: body.otp,
      createdIp: req.ip,
    });

    res.json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
});

/**
 * 3) Session introspection
 */
portalRoutes.get("/me", authPortal, async (req: any, res) => {
  res.json({
    ok: true,
    tenant_id: req.portalSession.tenant_id,
    order_number: req.portalSession.order_number,
    expires_at: req.portalSession.expires_at,
  });
});

/**
 * 4) Create return request (protected)
 */
portalRoutes.post("/returns", authPortal, async (req: any, res, next) => {
  try {
    const body = createReturnSchema.parse(req.body);

    const result = await ReturnsService.createPortalReturn(req, {
      requested_resolution: body.requested_resolution,
      notes_customer: body.notes_customer,
      order_id_external: body.order_id_external,
      policy_snapshot_json: body.policy_snapshot_json,
      is_warranty: body.is_warranty,
      items: body.items,
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
});

/**
 * 5) List returns for the logged-in order_number (protected)
 */
portalRoutes.get("/returns", authPortal, async (req: any, res, next) => {
  try {
    const result = await ReturnsService.listPortalReturns(req);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

/**
 * 6) Get return details by return_number (protected)
 */
portalRoutes.get("/returns/:return_number", authPortal, async (req: any, res, next) => {
  try {
    const params = returnNumberParamSchema.parse(req.params);

    const result = await ReturnsService.getPortalReturnDetails(req, {
      returnNumber: params.return_number,
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
});

/**
 * 7) Cancel return request by return_number (protected)
 * Allowed only while status === "requested"
 */
portalRoutes.post("/returns/:return_number/cancel", authPortal, async (req: any, res, next) => {
  try {
    const params = returnNumberParamSchema.parse(req.params);
    const body = cancelReturnSchema.parse(req.body ?? {});

    const result = await ReturnsService.cancelPortalReturn(req, {
      returnNumber: params.return_number,
      reason: body.reason,
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
});
