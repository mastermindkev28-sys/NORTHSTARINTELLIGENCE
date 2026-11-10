/**
 * CountyConnector: the contract every public-record source implements.
 *
 * Rules enforced here and in the pipeline:
 *  - Only documented, publicly offered interfaces (official APIs, open-data portals, bulk files, or
 *    licensed feeds). No connector may bypass authentication, CAPTCHAs, rate limits, or published
 *    restrictions; a source whose terms prohibit automated access cannot be constructed.
 *  - Every record carries its source key, source record id, retrieval time, and license tag.
 *  - Fetch is injectable so every connector is testable against stubbed responses.
 */
import type { RecordCategory, SourceLicense, SourceRecord } from '../types';

export type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface CountyRef {
  state: string;
  countyFips: string;
  name: string;
}

export interface FetchPageRequest {
  /** Opaque cursor from the previous page; undefined for the first page. */
  cursor?: string;
  /** Only records changed or recorded on/after this ISO date (incremental sync), when the source supports it. */
  since?: string;
  pageSize?: number;
}

export interface FetchPageResult {
  records: SourceRecord[];
  nextCursor: string | null;
  /** Rows the connector skipped because they could not be mapped (kept for run statistics). */
  skipped: number;
}

export interface CountyConnector {
  readonly sourceKey: string;
  readonly county: CountyRef;
  readonly category: RecordCategory;
  readonly license: SourceLicense;
  readonly demo: boolean;
  fetchPage(req: FetchPageRequest): Promise<FetchPageResult>;
}

export type SourceErrorKind = 'unauthorized' | 'rate_limited' | 'not_found' | 'upstream' | 'invalid_response' | 'network' | 'timeout';

export class SourceError extends Error {
  readonly kind: SourceErrorKind;
  readonly retryable: boolean;
  readonly status: number | undefined;
  constructor(kind: SourceErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'SourceError';
    this.kind = kind;
    this.status = status;
    this.retryable = kind === 'rate_limited' || kind === 'upstream' || kind === 'network' || kind === 'timeout';
  }
}

export function assertAccessPermitted(sourceKey: string, license: SourceLicense): void {
  if (license.automatedAccess === 'prohibited') {
    throw new Error(`${sourceKey}: the source's published terms prohibit automated access; no connector may be built for it.`);
  }
}

export interface HttpOptions {
  fetch?: FetchLike;
  timeoutMs?: number;
  /** Extra headers (e.g. a Socrata app token). Never log these. */
  headers?: Record<string, string>;
  userAgent?: string;
}

const DEFAULT_UA = 'NorthstarDiscover/0.1 (public-records ingestion)';

export async function getJson(url: string, opts: HttpOptions): Promise<unknown> {
  const f = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000);
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await f(url, { headers: { Accept: 'application/json', 'User-Agent': opts.userAgent ?? DEFAULT_UA, ...opts.headers }, signal: ctrl.signal });
  } catch (e) {
    if ((e as { name?: string }).name === 'AbortError') throw new SourceError('timeout', `request timed out: ${redact(url)}`);
    throw new SourceError('network', `network error: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 || res.status === 403) throw new SourceError('unauthorized', `access denied (${res.status})`, res.status);
  if (res.status === 404) throw new SourceError('not_found', `not found: ${redact(url)}`, 404);
  if (res.status === 429) throw new SourceError('rate_limited', 'rate limited by source', 429);
  if (!res.ok) throw new SourceError('upstream', `source returned ${res.status}`, res.status);
  try {
    return await res.json();
  } catch {
    throw new SourceError('invalid_response', 'response was not valid JSON');
  }
}

function redact(url: string): string {
  return url.replace(/([?&](?:\$\$app_token|token|api_key|key)=)[^&]+/gi, '$1***');
}

/** ISO date guard for values interpolated into source queries. */
export function isoDate(field: string, v: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`${field}: must be YYYY-MM-DD`);
  return v;
}

/** Identifier guard for column/table names interpolated into source queries. */
export function identifier(field: string, v: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(v)) throw new Error(`${field}: invalid identifier ${v}`);
  return v;
}

export type Row = Record<string, unknown>;
export type RowMapper = (row: Row, ctx: { sourceKey: string; licenseTag: string; retrievedAt: string }) => SourceRecord | null;

export const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : undefined);
export const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
/** Date-only portion of an ISO-like timestamp or epoch milliseconds (ArcGIS). */
export const day = (v: unknown): string | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v).toISOString().slice(0, 10);
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined;
};
