import { app } from "./app";
import { logger } from "./lib/logger";

const portStr = process.env.X_ZOHO_CATALYST_LISTEN_PORT?.trim();
if (!portStr) throw new Error("X_ZOHO_CATALYST_LISTEN_PORT not provided by AppSail");

const port = Number.parseInt(portStr, 10);
if (!Number.isFinite(port) || port <= 0) throw new Error(`Invalid port: "${portStr}"`);

app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "🚀 AppSail service listening");
});
