export type ApiError = {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
};

export class HttpError extends Error {
  status: number;
  url: string;
  body?: unknown;

  constructor(args: { message: string; status: number; url: string; body?: unknown }) {
    super(args.message);
    this.name = "HttpError";
    this.status = args.status;
    this.url = args.url;
    this.body = args.body;
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/**
 * Your pages expect: const err = normalizeError(e); err.message
 * So this MUST return an object with `message`.
 */
export function normalizeError(err: unknown): ApiError {
  if (!err) return { message: "Something went wrong." };

  if (typeof err === "string") return { message: err };

  if (err instanceof HttpError) {
    // if server returned JSON { message: "..." }
    if (err.body && typeof err.body === "object" && "message" in (err.body as any)) {
      const msg = (err.body as any).message;
      if (typeof msg === "string" && msg.trim()) {
        return { message: msg, status: err.status, details: err.body };
      }
    }
    return { message: err.message || `Request failed (${err.status})`, status: err.status, details: err.body };
  }

  if (err instanceof Error) return { message: err.message || "Something went wrong." };

  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: "Something went wrong." };
  }
}
