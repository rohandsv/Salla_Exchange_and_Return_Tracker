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

  // dt format: 2026-01-09 10:54:58
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(dt.trim());
  if (!m) return 0;

  const [, y, mo, d, h, mi, s] = m;
  // Use UTC to be deterministic (we only need relative interval checks)
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
    if (!catalystDtAfter(session.expires_at, nowStr)) {
      throw new AppError(401, "Unauthorized", "PORTAL_UNAUTHORIZED");
    }

    // Force string normalization (prevents precision loss if SDK returns number/bigint)
    session.ROWID = String((session as any).ROWID);
    session.tenant_id = String((session as any).tenant_id);

    req.tenantId = session.tenant_id;
    req.portalSession = session;

    // Touch session occasionally (avoid DB write on every request)
    const lastSeenStr = session.last_seen_at ? String(session.last_seen_at) : null;
    if (!lastSeenStr || (Date.now() - new Date(lastSeenStr.replace(" ", "T")).getTime()) > env.PORTAL_SESSION_TOUCH_INTERVAL_SECONDS * 1000) {
      await PortalSessionsRepo.touchLastSeen(req, session.ROWID);
    }

    next();
  } catch (e) {
    next(e);
  }
}
