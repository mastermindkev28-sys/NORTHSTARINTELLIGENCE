import { NorthstarError } from "@northstar/core";
import type { FetchLike } from "./types";

/** GET JSON with timeout and error classification suitable for workflow retry policy. Returns null on 404. */
export async function getJson(fetchImpl: FetchLike, provider: string, url: string, headers: Record<string, string>, timeoutMs = 10_000): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(url, { method: "GET", headers: { accept: "application/json", ...headers }, signal: controller.signal });
  } catch (e) {
    throw new NorthstarError("PROVIDER_UNAVAILABLE", `${provider} request failed: ${(e as Error).message}`, { retryable: true, cause: e });
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) throw new NorthstarError("PROVIDER_NOT_CONFIGURED", `${provider} rejected credentials (HTTP ${res.status})`, { retryable: false });
  if (res.status === 429 || res.status >= 500) throw new NorthstarError("PROVIDER_UNAVAILABLE", `${provider} unavailable (HTTP ${res.status})`, { retryable: true });
  if (!res.ok) throw new NorthstarError("PROVIDER_UNAVAILABLE", `${provider} returned HTTP ${res.status}`, { retryable: false, details: { body: (await res.text()).slice(0, 500) } });
  return res.json();
}

export const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
export const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
export const get = (o: unknown, path: string): unknown => path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), o);
