import { PortalSession } from "../../domain/portal";
import { safeJsonParse } from "../utils/safeJson";

const KEY = "salla_returns_portal_session_v1";

export function readPortalSession(): PortalSession | null {
  return safeJsonParse<PortalSession>(localStorage.getItem(KEY));
}

export function writePortalSession(s: PortalSession) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearPortalSession() {
  localStorage.removeItem(KEY);
}
