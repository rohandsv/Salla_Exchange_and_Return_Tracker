import { HttpError } from "./errors";
import { tryMock } from "./mockServer";

const USE_MOCKS = (process.env.REACT_APP_USE_MOCKS || "true") === "true";
const MOCK_FALLBACK_ON_NETWORK_FAIL = true;

function isAbsoluteUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

function normalizeUrl(path: string): string {
  if (!path) return "/";

  // keep absolute URLs
  if (isAbsoluteUrl(path)) return path;

  // force leading slash so it never becomes relative to /merchant/:tenant/overview
  return path.startsWith("/") ? path : `/${path}`;
}

export async function httpJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = normalizeUrl(path);

  // 1) Use mocks fully if enabled
  if (USE_MOCKS) {
    const mocked = await tryMock(url, init);
    if (mocked) return (await mocked.json()) as T;
  }

  // 2) Otherwise hit the network (and fallback to mocks on network failure)
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });

    if (!res.ok) {
      let body: unknown = undefined;
      try {
        const ct = res.headers.get("content-type") || "";
        body = ct.includes("application/json") ? await res.json() : await res.text();
      } catch {
        body = undefined;
      }

      // Optional fallback for 404/500 if you want:
      if (MOCK_FALLBACK_ON_NETWORK_FAIL) {
        const mocked = await tryMock(url, init);
        if (mocked) return (await mocked.json()) as T;
      }

      throw new HttpError({
        message: `Request failed: ${res.status} ${res.statusText}`,
        status: res.status,
        url,
        body,
      });
    }

    if (res.status === 204) return undefined as T;

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const text = await res.text();
      return text as unknown as T;
    }

    return (await res.json()) as T;
  } catch (e) {
    // Network error (ECONNREFUSED, etc.)
    if (MOCK_FALLBACK_ON_NETWORK_FAIL) {
      const mocked = await tryMock(url, init);
      if (mocked) return (await mocked.json()) as T;
    }
    throw e;
  }
}
