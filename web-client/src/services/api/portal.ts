import { PortalOrder } from "../../domain/portal";
import { httpJson } from "../http/client";
import { mockPortalOrder } from "./mocks";

const USE_MOCKS = (process.env.REACT_APP_USE_MOCKS || "true") === "true";

export async function portalStart(_portalSlug: string): Promise<{ ok: true }> {
  if (USE_MOCKS) return { ok: true };
  return httpJson<{ ok: true }>(`/portal/start`);
}

export async function requestOtp(_portalSlug: string, _orderNumber: string, _email: string) {
  if (USE_MOCKS) return { ok: true };
  return httpJson<{ ok: true }>(`/portal/otp/request`, {
    method: "POST",
    body: JSON.stringify({ order_number: _orderNumber, email: _email }),
  });
}

export async function verifyOtp(_portalSlug: string, code: string) {
  if (USE_MOCKS) return { ok: true };
  return httpJson<{ ok: true }>(`/portal/otp/verify`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function getOrder(_portalSlug: string): Promise<PortalOrder> {
  if (USE_MOCKS) return mockPortalOrder;
  return httpJson<PortalOrder>(`/portal/order`);
}

export async function createReturn(
  _portalSlug: string,
  payload: { orderNumber: string; itemIds: string[]; reason: string; resolution: "REFUND" | "STORE_CREDIT" | "EXCHANGE" }
) {
  if (USE_MOCKS) return { ok: true, rma: "RMA-99281" };
  return httpJson<{ ok: true; rma: string }>(`/portal/returns`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
