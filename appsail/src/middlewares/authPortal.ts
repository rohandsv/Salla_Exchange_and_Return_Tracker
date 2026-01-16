// appsail/src/middlewares/authPortal.ts
import { env } from "../env";
import { AppError } from "../lib/errors";
import { hashToken } from "../lib/crypto";
import { toCatalystDateTime, catalystDtAfter } from "../lib/datetime";
import { PortalSessionsRepo } from "../repositories/portalSessions.repo";

/**
 * Parse Catalyst DateTime: "YYYY-MM-DD HH:MM:SS"
 * Convert to epoch ms safely without relying on Date(string) quirks.
 */
function catalystDateTimeToMs(dt?: string | null): number {
  if (!dt) return 0;

  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(dt).trim());
  if (!m) return 0;

  const [, y, mo, d, h, mi, s] = m;

  // Use UTC to be deterministic (only relative interval checks)
  return Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s)
  );
}

export async function authPortal(req: any, _res: any, next: any) {
  try {
    const hdr = req.headers.authorization || "";
    const token =
      typeof hdr === "string" && hdr.startsWith("Bearer ")
        ? hdr.slice(7).trim()
        : "";

    if (!token) throw new AppError(401, "Unauthorized", "PORTAL_UNAUTHORIZED");

    const tokenHash = hashToken(token);
    const session = await PortalSessionsRepo.findByTokenHash(req, tokenHash);
    if (!session) throw new AppError(401, "Unauthorized", "PORTAL_UNAUTHORIZED");

    const nowStr = toCatalystDateTime(new Date());

    // expiry check (string-safe helper already in lib/datetime)
    if (!catalystDtAfter(session.expires_at, nowStr)) {
      throw new AppError(401, "Unauthorized", "PORTAL_UNAUTHORIZED");
    }

    // Normalize as strings (prevents bigint/number issues)
    session.ROWID = String((session as any).ROWID);
    session.tenant_id = String((session as any).tenant_id);

    req.tenantId = session.tenant_id;
    req.portalSession = session;

    // Touch occasionally (avoid DB write on every request)
    const lastSeenStr = session.last_seen_at ? String(session.last_seen_at) : null;

    const lastSeenMs = catalystDateTimeToMs(lastSeenStr);
    const intervalSec = Number(env.PORTAL_SESSION_TOUCH_INTERVAL_SECONDS);
    const intervalMs = Number.isFinite(intervalSec) && intervalSec > 0 ? intervalSec * 1000 : 300_000; // 5 min default

    // If lastSeen missing/unparseable OR older than interval -> touch
    if (!lastSeenMs || Date.now() - lastSeenMs > intervalMs) {
      await PortalSessionsRepo.touchLastSeen(req, session.ROWID);
    }

    next();
  } catch (e) {
    next(e);
  }
}
