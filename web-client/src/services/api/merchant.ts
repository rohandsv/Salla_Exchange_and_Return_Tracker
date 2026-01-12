import { apiFetch } from "../http";

export type MerchantOAuthStatusRes = {
  connected: boolean;
  store_name?: string;
  store_domain?: string;
};

type MerchantOAuthStatusApiRes = {
  ok: true;
  connected: boolean;
  tenant?: {
    store_name?: string | null;
    store_domain?: string | null;
  };
};

export async function merchantOAuthStatus(portal_public_slug: string): Promise<MerchantOAuthStatusRes> {
  const res = await apiFetch<MerchantOAuthStatusApiRes>(
    `/merchant/oauth/status?portal_public_slug=${encodeURIComponent(portal_public_slug)}`
  );

  return {
    connected: !!res.connected,
    store_name: res.tenant?.store_name ?? undefined,
    store_domain: res.tenant?.store_domain ?? undefined,
  };
}

/**
 * ✅ Start OAuth via browser redirect (GET)
 * Backend route is merchantRoutes.get("/oauth/start", ...)
 */
export function merchantOAuthStartRedirect(portal_public_slug: string) {
  const qs = new URLSearchParams({
    portal_public_slug,
    mode: "redirect", // optional (default is redirect in your backend)
  });
  window.location.assign(`/merchant/oauth/start?${qs.toString()}`);
}
