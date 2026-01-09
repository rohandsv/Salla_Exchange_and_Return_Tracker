// appsail/src/app.ts
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { requestId } from "./middlewares/requestId";
import { logger } from "./lib/logger";
import { AppError } from "./lib/errors";

import { healthRoutes } from "./routes/health.routes";
import { portalRoutes } from "./routes/portal.routes";
import { merchantRoutes } from "./routes/merchant.routes";
import { authRoutes } from "./routes/auth.routes";

export const app = express();

app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));
app.use(requestId);

app.set("json replacer", (_k: string, v: unknown) => (typeof v === "bigint" ? (v as bigint).toString() : v));

app.use("/health", healthRoutes);
app.use("/portal", portalRoutes);
app.use("/merchant", merchantRoutes);
app.use("/auth", authRoutes);

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "appsail", routes: ["/health", "/portal", "/merchant"] });
});

// 404 (AFTER all routes)
app.use((_req, _res, next) => next(new AppError(404, "Not found", "NOT_FOUND")));

// Error handler (LAST)
app.use((err: any, req: any, res: any, _next: any) => {
  const status = err instanceof AppError ? err.status : 500;

  logger.error({
    requestId: req.requestId,
    status,
    code: err?.code || "UNHANDLED",
    msg: err?.message || "Unhandled error",
  });

  res.status(status).json({
    ok: false,
    request_id: req.requestId,
    code: err?.code || "INTERNAL",
    error: status === 500 ? "Internal error" : err.message,
  });
});
