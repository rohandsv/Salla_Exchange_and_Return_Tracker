// appsail/src/index.ts
import "dotenv/config"; // ✅ MUST be first (before app/env imports)

import { app } from "./app";
import { logger } from "./lib/logger";

// AppSail expects this env var
const port = Number(process.env.X_ZOHO_CATALYST_LISTEN_PORT || 9000);

app.listen(port, () => {
  logger.info({ port }, "AppSail server started");
});
