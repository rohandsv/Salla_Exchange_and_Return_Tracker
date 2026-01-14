// appsail/src/app.ts
import express, { type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";

import { requestId } from "./middlewares/requestId";
import { logger } from "./lib/logger";
import { AppError } from "./lib/errors";

import { healthRoutes } from "./routes/health.routes";
import { portalRoutes } from "./routes/portal.routes";
import { merchantRoutes } from "./routes/merchant.routes";
import { authRoutes } from "./routes/auth.routes";
import { webhooksRoutes } from "./routes/webhooks.routes";

function rawBodySaver(req: any, _res: any, buf: Buffer) {
  if (buf?.length) req.rawBody = buf;
}

export const app = express();

app.use(helmet());

app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use((req, _res, next) => {
  const origin = req.headers.origin as string | undefined;
  if (!origin) return next();
  if (allowedOrigins.length && !allowedOrigins.includes(origin)) {
    return next(new AppError(403, "CORS not allowed", "CORS_NOT_ALLOWED"));
  }
  next();
});

app.use(requestId);

app.set("json replacer", (_k: string, v: unknown) =>
  typeof v === "bigint" ? (v as bigint).toString() : v
);

app.use("/webhooks", express.json({ limit: "2mb", verify: rawBodySaver }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/health", healthRoutes);
app.use("/portal", portalRoutes);
app.use("/merchant", merchantRoutes);
app.use("/auth", authRoutes);
app.use("/webhooks", webhooksRoutes);

app.get("/", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "appsail",
    routes: ["/health", "/portal", "/merchant", "/auth", "/webhooks"],
  });
});

app.use((_req: Request, _res: Response, next: NextFunction) =>
  next(new AppError(404, "Not found", "NOT_FOUND"))
);

app.use((err: any, req: any, res: any, _next: NextFunction) => {
  const status = err instanceof AppError ? err.status : 500;
  const requestIdValue = req?.requestId;

  logger.error(
    {
      requestId: requestIdValue,
      status,
      code: err?.code || (err instanceof AppError ? err.code : "UNHANDLED"),
      msg: err?.message || "Unhandled error",
      stack: status === 500 ? err?.stack : undefined,
      path: req?.path,
      method: req?.method,
    },
    "request_failed"
  );

  if (res.headersSent) return;

  res.status(status).json({
    ok: false,
    request_id: requestIdValue,
    code: err?.code || (err instanceof AppError ? err.code : "INTERNAL"),
    error: status === 500 ? "Internal error" : err?.message,
  });
});
