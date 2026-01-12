import { apiFetch } from "../http";

export type PortalStartReq = {
  portal_public_slug: string;
  order_number: string;
  channel: "phone" | "email";
  contact: string;
};

export type PortalStartRes = { request_id: string };

export function portalStart(p: PortalStartReq) {
  return apiFetch<PortalStartRes>("/portal/start", { method: "POST", body: p });
}

export type PortalVerifyReq = {
  portal_public_slug: string;
  order_number: string;
  otp: string;
};

export type PortalVerifyRes = {
  session_token: string;
  expires_at: string;
};

export function portalVerify(p: PortalVerifyReq) {
  return apiFetch<PortalVerifyRes>("/portal/verify", { method: "POST", body: p });
}

export type PortalReturnsRes = {
  items: Array<{
    return_request_id: string;
    status: string;
    created_at: string;
    mode?: string;
    tracking_number?: string;
  }>;
};

export function portalReturns(portal_public_slug: string, token: string) {
  return apiFetch<PortalReturnsRes>(
    `/portal/returns?portal_public_slug=${encodeURIComponent(portal_public_slug)}`,
    { token }
  );
}

// (Optional) if you use this somewhere
export type PortalMeRes = { portal_public_slug: string; merchant_connected: boolean };
export function portalMe(portal_public_slug: string) {
  return apiFetch<PortalMeRes>(`/portal/me?portal_public_slug=${encodeURIComponent(portal_public_slug)}`);
}
