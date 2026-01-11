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
import { webhooksRoutes } from "./routes/webhooks.routes";

// OPTIONAL: if you already have webhooks routes, uncomment
// import { webhooksRoutes } from "./routes/webhooks.routes";

/**
 * Raw body saver:
 * - Needed when webhook signature verification requires the exact raw body
 * - Safe: only stores buffer on req.rawBody, does not change your req.body behavior
 */
function rawBodySaver(req: any, _res: any, buf: Buffer) {
  if (buf?.length) req.rawBody = buf;
}

export const app = express();

app.use(helmet());
app.use(cors({ origin: true }));

/**
 * IMPORTANT:
 * - Use a verify hook to capture raw body (for webhook signature verification),
 *   while still parsing JSON normally for all routes.
 */
app.use(express.json({ limit: "1mb", verify: rawBodySaver }));

app.use(requestId);

/**
 * BigInt-safe JSON serialization (Catalyst ROWID can behave like BigInt)
 */
app.set("json replacer", (_k: string, v: unknown) => (typeof v === "bigint" ? (v as bigint).toString() : v));

/**
 * Routes
 */
app.use("/health", healthRoutes);
app.use("/portal", portalRoutes);
app.use("/merchant", merchantRoutes);
app.use("/auth", authRoutes);
app.use("/webhooks", webhooksRoutes);

// OPTIONAL: if you already have webhook routes, mount them here
// app.use("/webhooks", webhooksRoutes);

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "appsail",
    routes: ["/health", "/portal", "/merchant", "/auth" /*, "/webhooks"*/],
  });
});

/**
 * 404 (AFTER all routes)
 */
app.use((_req, _res, next) => next(new AppError(404, "Not found", "NOT_FOUND")));

/**
 * Error handler (LAST)
 */
app.use((err: any, req: any, res: any, _next: any) => {
  const status = err instanceof AppError ? err.status : 500;

  logger.error({
    requestId: req?.requestId,
    status,
    code: err?.code || "UNHANDLED",
    msg: err?.message || "Unhandled error",
    stack: status === 500 ? err?.stack : undefined,
  });

  res.status(status).json({
    ok: false,
    request_id: req?.requestId,
    code: err?.code || "INTERNAL",
    error: status === 500 ? "Internal error" : err?.message,
  });
});
