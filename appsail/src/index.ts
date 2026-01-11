// appsail/src/index.ts
import "dotenv/config";
import { app } from "./app";
import { logger } from "./lib/logger";

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "unhandledRejection");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException");
  process.exit(1);
});

const portStr =
  process.env.X_ZOHO_CATALYST_LISTEN_PORT ||
  process.env.PORT ||
  "3001";

const port = Number(portStr);

if (!Number.isFinite(port) || port <= 0) {
  throw new Error(`Invalid listen port: "${portStr}"`);
}

app.listen(port, "0.0.0.0", () => {
  logger.info(
    { port, nodeEnv: process.env.NODE_ENV, tz: process.env.TZ, appBaseUrl: process.env.APP_BASE_URL },
    "🚀 AppSail service listening"
  );
});
