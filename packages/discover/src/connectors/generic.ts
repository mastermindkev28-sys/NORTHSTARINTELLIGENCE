/**
 * Generic connectors for the three open-data platforms used by the pilot counties:
 *   Socrata (SODA 2.x, e.g. Cook County datacatalog)  ·  ArcGIS REST FeatureServer/MapServer query
 *   (e.g. Cuyahoga)  ·  Carto SQL API (e.g. City of Philadelphia).
 * Each is configured with a row mapper; nothing here knows a specific county's schema.
 */
import type { RecordCategory, SourceLicense } from '../types';
import {
  assertAccessPermitted,
  getJson,
  identifier,
  isoDate,
  SourceError,
  type CountyConnector,
  type CountyRef,
  type FetchPageRequest,
  type FetchPageResult,
  type HttpOptions,
  type Row,
  type RowMapper,
} from './types';

interface BaseConfig {
  sourceKey: string;
  county: CountyRef;
  category: RecordCategory;
  license: SourceLicense;
  map: RowMapper;
  /** Column used for stable ordering (pagination) and incremental sync. */
  orderBy: string;
  /** Column compared with `since` for incremental sync; defaults to orderBy. */
  sinceField?: string;
  pageSize?: number;
  http?: HttpOptions;
  /** Clock injection for retrievedAt (tests). */
  now?: () => string;
}

abstract class BaseConnector implements CountyConnector {
  readonly sourceKey: string;
  readonly county: CountyRef;
  readonly category: RecordCategory;
  readonly license: SourceLicense;
  readonly demo = false;
  protected readonly cfg: BaseConfig;
  constructor(cfg: BaseConfig) {
    assertAccessPermitted(cfg.sourceKey, cfg.license);
    identifier('orderBy', cfg.orderBy);
    if (cfg.sinceField) identifier('sinceField', cfg.sinceField);
    this.cfg = cfg;
    this.sourceKey = cfg.sourceKey;
    this.county = cfg.county;
    this.category = cfg.category;
    this.license = cfg.license;
  }
  protected offset(req: FetchPageRequest): number {
    if (req.cursor === undefined) return 0;
    const n = Number(req.cursor);
    if (!Number.isInteger(n) || n < 0) throw new Error(`cursor: invalid cursor ${req.cursor}`);
    return n;
  }
  protected limit(req: FetchPageRequest): number {
    return Math.min(Math.max(1, req.pageSize ?? this.cfg.pageSize ?? 1000), 5000);
  }
  protected mapRows(rows: unknown[], offset: number, limit: number): FetchPageResult {
    const retrievedAt = (this.cfg.now ?? (() => new Date().toISOString()))();
    const ctx = { sourceKey: this.sourceKey, licenseTag: this.license.tag, retrievedAt };
    let skipped = 0;
    const records = [];
    for (const r of rows) {
      const rec = r && typeof r === 'object' ? this.cfg.map(r as Row, ctx) : null;
      if (rec) records.push(rec);
      else skipped++;
    }
    return { records, skipped, nextCursor: rows.length < limit ? null : String(offset + rows.length) };
  }
  abstract fetchPage(req: FetchPageRequest): Promise<FetchPageResult>;
}

// ---------------------------------------------------------------------------------------------
// Socrata
// ---------------------------------------------------------------------------------------------

export interface SocrataConfig extends BaseConfig {
  /** e.g. "datacatalog.cookcountyil.gov" */
  domain: string;
  /** 4x4 dataset id, e.g. "wvhk-k5uv" */
  datasetId: string;
  /** Optional app token, sent as X-App-Token (raises rate limits; never placed in the URL). */
  appToken?: string;
}

export class SocrataConnector extends BaseConnector {
  private readonly s: SocrataConfig;
  constructor(cfg: SocrataConfig) {
    super(cfg);
    if (!/^[a-z0-9.-]+$/i.test(cfg.domain)) throw new Error('domain: invalid');
    if (!/^[a-z0-9]{4}-[a-z0-9]{4}$/.test(cfg.datasetId)) throw new Error('datasetId: must be a Socrata 4x4 id');
    this.s = cfg;
  }
  buildUrl(req: FetchPageRequest): string {
    const offset = this.offset(req);
    const limit = this.limit(req);
    const p = new URLSearchParams();
    p.set('$limit', String(limit));
    p.set('$offset', String(offset));
    p.set('$order', `${this.s.orderBy},:id`);
    if (req.since) p.set('$where', `${this.s.sinceField ?? this.s.orderBy} >= '${isoDate('since', req.since)}T00:00:00'`);
    return `https://${this.s.domain}/resource/${this.s.datasetId}.json?${p.toString()}`;
  }
  async fetchPage(req: FetchPageRequest): Promise<FetchPageResult> {
    const http: HttpOptions = { ...this.s.http, headers: { ...this.s.http?.headers, ...(this.s.appToken ? { 'X-App-Token': this.s.appToken } : {}) } };
    const body = await getJson(this.buildUrl(req), http);
    if (!Array.isArray(body)) throw new SourceError('invalid_response', 'Socrata response is not an array');
    return this.mapRows(body, this.offset(req), this.limit(req));
  }
}

// ---------------------------------------------------------------------------------------------
// ArcGIS REST
// ---------------------------------------------------------------------------------------------

export interface ArcGisConfig extends BaseConfig {
  /** Layer URL ending in /FeatureServer/<n> or /MapServer/<n>. */
  layerUrl: string;
  outFields?: readonly string[];
  /** Static filter combined with the since filter. Must be a constant expression from config. */
  where?: string;
}

export class ArcGisConnector extends BaseConnector {
  private readonly a: ArcGisConfig;
  constructor(cfg: ArcGisConfig) {
    super(cfg);
    if (!/^https:\/\/[^\s?#]+\/(FeatureServer|MapServer)\/\d+$/.test(cfg.layerUrl)) throw new Error('layerUrl: must be an https FeatureServer/MapServer layer URL');
    cfg.outFields?.forEach((f) => identifier('outFields', f));
    this.a = cfg;
  }
  buildUrl(req: FetchPageRequest): string {
    const offset = this.offset(req);
    const limit = this.limit(req);
    const clauses = [this.a.where ?? '1=1'];
    if (req.since) clauses.push(`${this.a.sinceField ?? this.a.orderBy} >= DATE '${isoDate('since', req.since)}'`);
    const p = new URLSearchParams({
      where: clauses.join(' AND '),
      outFields: this.a.outFields?.join(',') ?? '*',
      orderByFields: this.a.orderBy,
      resultOffset: String(offset),
      resultRecordCount: String(limit),
      returnGeometry: 'false',
      f: 'json',
    });
    return `${this.a.layerUrl}/query?${p.toString()}`;
  }
  async fetchPage(req: FetchPageRequest): Promise<FetchPageResult> {
    const body = (await getJson(this.buildUrl(req), this.a.http ?? {})) as { features?: { attributes?: Row }[]; error?: { code?: number; message?: string }; exceededTransferLimit?: boolean };
    if (body && typeof body === 'object' && body.error) throw new SourceError('upstream', `ArcGIS error ${body.error.code ?? ''}: ${body.error.message ?? 'unknown'}`);
    if (!body || !Array.isArray(body.features)) throw new SourceError('invalid_response', 'ArcGIS response has no features array');
    const offset = this.offset(req);
    const limit = this.limit(req);
    const page = this.mapRows(body.features.map((f) => f.attributes ?? null), offset, limit);
    // ArcGIS signals more pages explicitly; trust it over the row count when present.
    if (body.exceededTransferLimit === true) page.nextCursor = String(offset + body.features.length);
    else if (body.exceededTransferLimit === false) page.nextCursor = null;
    return page;
  }
}

// ---------------------------------------------------------------------------------------------
// Carto SQL API
// ---------------------------------------------------------------------------------------------

export interface CartoConfig extends BaseConfig {
  /** e.g. "https://phl.carto.com/api/v2/sql" */
  endpoint: string;
  table: string;
  columns?: readonly string[];
}

export class CartoConnector extends BaseConnector {
  private readonly c: CartoConfig;
  constructor(cfg: CartoConfig) {
    super(cfg);
    if (!/^https:\/\/[^\s?#]+\/api\/v2\/sql$/.test(cfg.endpoint)) throw new Error('endpoint: must be an https Carto /api/v2/sql URL');
    identifier('table', cfg.table);
    cfg.columns?.forEach((c) => identifier('columns', c));
    this.c = cfg;
  }
  buildSql(req: FetchPageRequest): string {
    const cols = this.c.columns?.join(', ') ?? '*';
    const where = req.since ? ` WHERE ${this.c.sinceField ?? this.c.orderBy} >= '${isoDate('since', req.since)}'` : '';
    return `SELECT ${cols} FROM ${this.c.table}${where} ORDER BY ${this.c.orderBy}, cartodb_id LIMIT ${this.limit(req)} OFFSET ${this.offset(req)}`;
  }
  buildUrl(req: FetchPageRequest): string {
    return `${this.c.endpoint}?${new URLSearchParams({ q: this.buildSql(req) }).toString()}`;
  }
  async fetchPage(req: FetchPageRequest): Promise<FetchPageResult> {
    const body = (await getJson(this.buildUrl(req), this.c.http ?? {})) as { rows?: unknown[]; error?: unknown };
    if (body && typeof body === 'object' && body.error) throw new SourceError('upstream', `Carto error: ${JSON.stringify(body.error).slice(0, 200)}`);
    if (!body || !Array.isArray(body.rows)) throw new SourceError('invalid_response', 'Carto response has no rows array');
    return this.mapRows(body.rows, this.offset(req), this.limit(req));
  }
}
