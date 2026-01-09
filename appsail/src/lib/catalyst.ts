import catalyst from "zcatalyst-sdk-node";

/**
 * Request-scoped Catalyst app init (important for AppSail).
 */
export function getCatalystApp(req: any) {
  return catalyst.initialize(req);
}
