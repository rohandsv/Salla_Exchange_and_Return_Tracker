import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";

export function requestId(req: Request, res: Response, next: NextFunction) {
  const rid = (req.headers["x-request-id"] as string) || randomUUID();

  (req as any).id = rid;          // ✅ standard
  (req as any).requestId = rid;   // ✅ backward compatibility (optional)

  res.setHeader("x-request-id", rid);
  next();
}
