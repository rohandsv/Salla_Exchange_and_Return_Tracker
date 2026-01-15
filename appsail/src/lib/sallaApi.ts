import { env } from "../env";

export type SallaFetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
};

export class SallaApiError extends Error {
  public status: number;
  public responseText?: string;

  constructor(message: string, status: number, responseText?: string) {
    super(message);
    this.name = "SallaApiError";
    this.status = status;
    this.responseText = responseText;
  }
}

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export async function sallaFetchJson<T>(
  accessToken: string,
  path: string,
  opts: SallaFetchOptions = {}
): Promise<T> {
  if (!env.SALLA_API_BASE_URL) {
    throw new Error("SALLA_API_BASE_URL is not set");
  }

  const url = joinUrl(env.SALLA_API_BASE_URL, path);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    ...(opts.headers ?? {}),
  };

  let body: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body,
    signal: opts.signal,
  });

  const text = await res.text().catch(() => "");

  if (!res.ok) {
    throw new SallaApiError(`Salla API error ${res.status} for ${path}`, res.status, text);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SallaApiError(`Invalid JSON from Salla for ${path}`, res.status, text);
  }
}
