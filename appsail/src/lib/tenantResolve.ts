// appsail/src/lib/tenantResolve.ts
import { z } from "zod";
import { env } from "../env";
import { TenantsRepo } from "../repositories/tenants.repo";
import { AppError } from "../lib/errors";

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

export function validatePortalSlug(slug: string) {
  const s = String(slug ?? "").trim();
  if (!s) throw new AppError(400, "portal_public_slug is required", "PORTAL_SLUG_REQUIRED");
  if (s.length > 120) throw new AppError(400, "portal_public_slug too long", "PORTAL_SLUG_INVALID");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9\-._~]*$/.test(s)) {
    throw new AppError(400, "portal_public_slug contains invalid characters", "PORTAL_SLUG_INVALID");
  }
  return s;
}

export async function resolveTenantByPortalSlug(req: any, portal_public_slug: string) {
  const slug = validatePortalSlug(portal_public_slug);

  let tenant = await TenantsRepo.findByPortalSlug(req, slug);

  if (!tenant && devAutoProvisionEnabled()) {
    tenant = await TenantsRepo.create(req, { portal_public_slug: slug, status: "draft" });
  }

  if (!tenant) throw new AppError(404, "Unknown portal_public_slug", "TENANT_NOT_FOUND");
  return tenant;
}

/**
 * Resolve tenant by a route param name, e.g. "/merchant/:tenantSlug"
 */
export async function resolveTenantFromRouteParam(req: any, paramName: string) {
  const raw = req?.params?.[paramName];
  const slug = validatePortalSlug(String(raw ?? ""));
  return resolveTenantByPortalSlug(req, slug);
}

export const tenantSlugParamSchema = z.object({
  tenantSlug: z.string().min(1),
});
