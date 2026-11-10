/**
 * Idempotent ingestion pipeline.
 *
 *   for each page from the connector:
 *     for each record:
 *       content hash = fingerprint(record without retrievedAt)
 *       unchanged hash for (source, id)  → skip
 *       else append a raw record version (append-only)
 *       resolve to a parcel: matched → link · review → queue for a person · no_match → unlinked
 *       if the record carries an event → apply to the event history (append a version if changed)
 *
 * Running the same pull twice produces no new rows. Persistence is behind `DiscoverStore`; the
 * Postgres implementation lives in @northstar/db, and `MemoryDiscoverStore` backs tests and demos.
 */
import { fingerprint } from '@northstar/underwriting';
import type { CountyConnector } from './connectors/types';
import { SourceError } from './connectors/types';
import { applyObservation, type EventVersion } from './events';
import { resolveRecord, type ParcelCandidate, type ResolutionResult } from './resolution';
import type { SourceRecord } from './types';

export interface StoredRecord {
  record: SourceRecord;
  contentHash: string;
  version: number;
}

export interface ReviewItem {
  sourceKey: string;
  sourceRecordId: string;
  result: ResolutionResult;
  queuedAt: string;
}

export interface IngestionRun {
  id: string;
  sourceKey: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'succeeded' | 'failed' | 'partial';
  pages: number;
  fetched: number;
  inserted: number;
  unchanged: number;
  skipped: number;
  matched: number;
  queuedForReview: number;
  unmatched: number;
  eventsAppended: number;
  anomalies: number;
  error: string | null;
  nextCursor: string | null;
}

export interface DiscoverStore {
  latestRecord(sourceKey: string, sourceRecordId: string): Promise<StoredRecord | null>;
  appendRecord(r: StoredRecord): Promise<void>;
  parcelCandidates(countyFips: string, record: SourceRecord): Promise<ParcelCandidate[]>;
  linkRecord(sourceKey: string, sourceRecordId: string, parcelId: string, confidence: number, reasons: string[]): Promise<void>;
  queueReview(item: ReviewItem): Promise<void>;
  eventHistory(sourceKey: string, sourceRecordId: string): Promise<EventVersion[]>;
  appendEventVersion(v: EventVersion): Promise<void>;
  saveRun(run: IngestionRun): Promise<void>;
}

export interface RunOptions {
  connector: CountyConnector;
  store: DiscoverStore;
  runId: string;
  /** Clock injection; the pipeline never reads the system clock directly. */
  now: () => string;
  since?: string;
  cursor?: string;
  pageSize?: number;
  maxPages?: number;
}

/** A record that breaks an ingestion invariant fails the whole run, whatever was already stored. */
class PolicyViolation extends Error {}

export function contentHash(r: SourceRecord): string {
  const { retrievedAt: _ignored, ...rest } = r;
  return fingerprint(rest);
}

export async function runIngestion(opts: RunOptions): Promise<IngestionRun> {
  const { connector, store } = opts;
  const run: IngestionRun = {
    id: opts.runId,
    sourceKey: connector.sourceKey,
    startedAt: opts.now(),
    finishedAt: null,
    status: 'running',
    pages: 0,
    fetched: 0,
    inserted: 0,
    unchanged: 0,
    skipped: 0,
    matched: 0,
    queuedForReview: 0,
    unmatched: 0,
    eventsAppended: 0,
    anomalies: 0,
    error: null,
    nextCursor: opts.cursor ?? null,
  };
  await store.saveRun(run);
  let cursor = opts.cursor;
  const maxPages = opts.maxPages ?? Number.POSITIVE_INFINITY;
  try {
    while (run.pages < maxPages) {
      const page = await connector.fetchPage({ cursor, since: opts.since, pageSize: opts.pageSize });
      run.pages++;
      run.skipped += page.skipped;
      for (const rec of page.records) {
        if (rec.sourceKey !== connector.sourceKey) throw new PolicyViolation(`connector returned a record for ${rec.sourceKey}`);
        if (connector.demo !== (rec.demo === true)) throw new PolicyViolation('demo and live records must not be mixed');
        run.fetched++;
        await ingestRecord(rec, connector.county.countyFips, store, run, opts.now);
      }
      cursor = page.nextCursor ?? undefined;
      run.nextCursor = page.nextCursor;
      if (!page.nextCursor) break;
    }
    run.status = run.nextCursor ? 'partial' : 'succeeded';
  } catch (e) {
    run.status = run.fetched > 0 && !(e instanceof PolicyViolation) ? 'partial' : 'failed';
    run.error = e instanceof SourceError ? `${e.kind}: ${e.message}` : (e as Error).message;
  }
  run.finishedAt = opts.now();
  await store.saveRun(run);
  return run;
}

async function ingestRecord(rec: SourceRecord, countyFips: string, store: DiscoverStore, run: IngestionRun, now: () => string): Promise<void> {
  const hash = contentHash(rec);
  const prev = await store.latestRecord(rec.sourceKey, rec.sourceRecordId);
  if (prev && prev.contentHash === hash) {
    run.unchanged++;
    return;
  }
  await store.appendRecord({ record: rec, contentHash: hash, version: (prev?.version ?? 0) + 1 });
  run.inserted++;

  const result = resolveRecord(rec, countyFips, await store.parcelCandidates(countyFips, rec));
  if (result.decision === 'matched') {
    await store.linkRecord(rec.sourceKey, rec.sourceRecordId, result.parcelId!, result.confidence, result.reasons);
    run.matched++;
  } else if (result.decision === 'review') {
    await store.queueReview({ sourceKey: rec.sourceKey, sourceRecordId: rec.sourceRecordId, result, queuedAt: now() });
    run.queuedForReview++;
  } else {
    run.unmatched++;
  }

  if (rec.event) {
    const outcome = applyObservation(await store.eventHistory(rec.sourceKey, rec.sourceRecordId), rec, rec.event, rec.retrievedAt);
    if (outcome.kind !== 'unchanged') {
      await store.appendEventVersion(outcome.version);
      run.eventsAppended++;
      if (outcome.version.anomaly) run.anomalies++;
    }
  }
}

/** In-memory store for tests and demos. */
export class MemoryDiscoverStore implements DiscoverStore {
  readonly records: StoredRecord[] = [];
  readonly links = new Map<string, { parcelId: string; confidence: number; reasons: string[] }>();
  readonly reviews: ReviewItem[] = [];
  readonly events: EventVersion[] = [];
  readonly runs = new Map<string, IngestionRun>();
  constructor(readonly parcels: ParcelCandidate[] = []) {}
  private k(s: string, id: string) {
    return `${s}\u0000${id}`;
  }
  async latestRecord(s: string, id: string) {
    let best: StoredRecord | null = null;
    for (const r of this.records) if (r.record.sourceKey === s && r.record.sourceRecordId === id && (!best || r.version > best.version)) best = r;
    return best;
  }
  async appendRecord(r: StoredRecord) {
    this.records.push(r);
  }
  async parcelCandidates(countyFips: string) {
    return this.parcels.filter((p) => p.countyFips === countyFips);
  }
  async linkRecord(s: string, id: string, parcelId: string, confidence: number, reasons: string[]) {
    this.links.set(this.k(s, id), { parcelId, confidence, reasons });
  }
  async queueReview(item: ReviewItem) {
    this.reviews.push(item);
  }
  async eventHistory(s: string, id: string) {
    return this.events.filter((e) => e.sourceKey === s && e.sourceRecordId === id);
  }
  async appendEventVersion(v: EventVersion) {
    if (this.events.some((e) => e.sourceKey === v.sourceKey && e.sourceRecordId === v.sourceRecordId && e.version === v.version)) {
      throw new Error('event version already exists (append-only)');
    }
    this.events.push(v);
  }
  async saveRun(run: IngestionRun) {
    this.runs.set(run.id, { ...run });
  }
}
