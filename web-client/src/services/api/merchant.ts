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

type MerchantOAuthStartApiRes = {
  ok: true;
  url: string;
  state_expires_at?: string;
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

export async function merchantOAuthStart(portal_public_slug: string): Promise<MerchantOAuthStartApiRes> {
  return apiFetch<MerchantOAuthStartApiRes>(
    `/merchant/oauth/start?portal_public_slug=${encodeURIComponent(portal_public_slug)}&mode=json`
  );
}

export async function merchantOAuthStartRedirect(portal_public_slug: string) {
  const res = await merchantOAuthStart(portal_public_slug);
  if (!res?.url) throw new Error("Start did not return a URL");
  window.location.assign(res.url);
}
