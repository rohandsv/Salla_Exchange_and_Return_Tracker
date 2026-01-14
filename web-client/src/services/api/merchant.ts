import type { MerchantInboxItem, MerchantKpis, MerchantRules, MerchantSettings } from "../../domain/merchant";
import { httpJson } from "../http/client";
import { mockInbox, mockKpis, mockRules, mockSettings } from "./mocks";

const USE_MOCKS = (process.env.REACT_APP_USE_MOCKS || "true") === "true";

/**
 * IMPORTANT:
 * Your backend (or mock) is NOT serving /merchant/:tenant/kpis.
 * So ALWAYS call the non-tenant endpoints.
 */
const KPIS_URL = "/merchant/kpis";
const RETURNS_URL = "/merchant/returns";
const RULES_URL = "/merchant/rules";
const SETTINGS_URL = "/merchant/settings";

export async function getMerchantKpis(): Promise<MerchantKpis> {
  if (USE_MOCKS) return mockKpis;
  return httpJson<MerchantKpis>(KPIS_URL);
}

export async function getMerchantInbox(): Promise<MerchantInboxItem[]> {
  if (USE_MOCKS) return mockInbox;
  return httpJson<MerchantInboxItem[]>(RETURNS_URL);
}

export async function getMerchantRules(): Promise<MerchantRules> {
  if (USE_MOCKS) return mockRules;
  return httpJson<MerchantRules>(RULES_URL);
}

export async function saveMerchantRules(next: MerchantRules): Promise<{ ok: true }> {
  if (USE_MOCKS) return { ok: true };
  return httpJson<{ ok: true }>(RULES_URL, { method: "POST", body: JSON.stringify(next) });
}

export async function getMerchantSettings(): Promise<MerchantSettings> {
  if (USE_MOCKS) return mockSettings;
  return httpJson<MerchantSettings>(SETTINGS_URL);
}

export async function saveMerchantSettings(next: MerchantSettings): Promise<{ ok: true }> {
  if (USE_MOCKS) return { ok: true };
  return httpJson<{ ok: true }>(SETTINGS_URL, { method: "POST", body: JSON.stringify(next) });
}
