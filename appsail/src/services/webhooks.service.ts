import { AppError } from "../lib/errors";
import { toCatalystDateTime } from "../lib/datetime";
import { SallaOauthTokensRepo } from "../repositories/sallaOauthTokens.repo";
import { TenantsRepo } from "../repositories/tenants.repo";

export type SallaWebhookEvent = {
  event?: string;
  type?: string;
  action?: string;
  store_id?: string | number;
  data?: any;
  [k: string]: any;
};

function assertRowIdDigits(id: any) {
  const v = String(id ?? "").trim();
  if (!/^\d+$/.test(v)) throw new AppError(400, "Invalid tenant ROWID", "TENANT_ID_INVALID");
  return v;
}

function normalizeEventType(evt: SallaWebhookEvent): string {
  return String(evt.type ?? evt.event ?? evt.action ?? "").trim().toLowerCase();
}

function isUninstallEvent(t: string) {
  if (!t) return false;
  return t.includes("uninstall");
}

export async function handleSallaWebhook(req: any, tenantId: string, event: SallaWebhookEvent) {
  const tid = assertRowIdDigits(tenantId);
  const t = normalizeEventType(event);

  if (isUninstallEvent(t)) {
    const nowStr = toCatalystDateTime(new Date());
    await SallaOauthTokensRepo.revoke(req, tid, nowStr);
    await TenantsRepo.updateSallaConnectionFields(req, tid, { status: "uninstalled" });
    return { ok: true, handled: "uninstall" };
  }

  return { ok: true, handled: "ignored", type: t || null };
}
