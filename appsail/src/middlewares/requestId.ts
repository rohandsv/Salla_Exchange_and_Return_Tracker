import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";

export function requestId(req: Request, res: Response, next: NextFunction) {
  const rid = (req.headers["x-request-id"] as string) || randomUUID();
  (req as any).requestId = rid;
  res.setHeader("x-request-id", rid);
  next();
}
