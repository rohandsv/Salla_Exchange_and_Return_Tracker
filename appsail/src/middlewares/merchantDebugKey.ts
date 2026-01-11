import type { Request, Response, NextFunction } from "express";
import { env } from "../env";

export function requireMerchantDebugKey(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-merchant-debug-key");
  if (!key || key !== env.MERCHANT_DEBUG_KEY) {
    return res.status(403).json({ error: "forbidden" });
  }
  next();
}
