import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors";

// This middleware should set req.tenantId after auth resolves tenant.
export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  const tenantId = (req as any).tenantId;
  if (!tenantId) return next(new AppError(401, "Tenant not resolved", "TENANT_REQUIRED"));
  next();
}
