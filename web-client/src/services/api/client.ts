import { httpJson } from "../http/client";

export async function apiGet<T>(path: string): Promise<T> {
  return httpJson<T>(path, { method: "GET" });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return httpJson<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
