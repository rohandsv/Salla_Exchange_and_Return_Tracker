export type ApiErrorShape = { code?: string; message?: string; details?: unknown };

export class ApiError extends Error {
  status: number;
  payload?: ApiErrorShape;
  constructor(message: string, status: number, payload?: ApiErrorShape) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export function toErrorMessage(e: unknown) {
  if (e instanceof ApiError) return e.payload?.message || e.message || `Request failed (${e.status})`;
  if (e instanceof Error) return e.message || "Unknown error";
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Unknown error";
  }
}

function baseUrl() {
  const v = (process.env.REACT_APP_API_BASE_URL || "").trim();
  if (!v) return "";
  return v.replace(/\/+$/, "");
}

function join(path: string) {
  const b = baseUrl();

  // IMPORTANT: prevent relative calls from becoming /app/xyz when the SPA runs under /app/*
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!b) return normalizedPath;
  return `${b}${normalizedPath}`;
}

async function readJsonSafe(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function apiFetch<T>(
  path: string,
  opts: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    headers?: Record<string, string>;
    body?: unknown;
    token?: string | null;
  } = {}
): Promise<T> {
  const method = opts.method || "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.headers || {}),
  };

  let body: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }

  const res = await fetch(join(path), { method, headers, body });

  if (!res.ok) {
    const payload = (await readJsonSafe(res)) as ApiErrorShape | null;
    const msg = payload?.message || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, payload || undefined);
  }

  const out = (await readJsonSafe(res)) as T | null;
  return (out as T) ?? ({} as T);
}
