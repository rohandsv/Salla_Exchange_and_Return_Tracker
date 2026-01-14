// appsail/src/middlewares/authMerchantPlaceholder.ts
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors";
import { env } from "../env";
import { resolveTenantFromRouteParam } from "../lib/tenantResolve";

function getHeader(req: Request, name: string): string {
  const v = (req.headers as any)?.[name.toLowerCase()];
  if (Array.isArray(v)) return String(v[0] ?? "").trim();
  return String(v ?? "").trim();
}

/**
 * Merchant auth placeholder:
 * - Production-safe: supports requiring a debug key via env.MERCHANT_DEBUG_KEY
 * - Tenant-aware: resolves tenant from :tenantSlug and sets req.tenantId / req.tenant
 */
export async function authMerchant(req: Request, _res: Response, next: NextFunction) {
  try {
    const expected = String(env.MERCHANT_DEBUG_KEY ?? "").trim();

    if (expected) {
      const provided = getHeader(req, "x-merchant-debug-key");
      if (!provided || provided !== expected) {
        throw new AppError(401, "Unauthorized", "MERCHANT_UNAUTHORIZED");
      }
    }

    const tenant = await resolveTenantFromRouteParam(req as any, "tenantSlug");
    (req as any).tenantId = String(tenant.ROWID);
    (req as any).tenant = tenant;

    next();
  } catch (e) {
    next(e);
  }
}
