/**
 * Append-only property event model.
 *
 * An event (a sheriff sale, a code violation, a lis pendens) is identified by its source and the
 * source's record id. Every observation that changes what we know produces a new immutable version
 * that supersedes the previous one; nothing is updated in place, so the full history (including
 * postponements and dismissals) is always reconstructible.
 *
 * Source data is never rejected for being surprising. Unusual transitions (a dismissed case
 * reappearing as active) are accepted and flagged as anomalies for human review.
 */
import { EVENT_STATUSES, type EventStatus, type RecordEvent, type SignalType } from './types';

export const TERMINAL_STATUSES: ReadonlySet<EventStatus> = new Set(['resolved', 'dismissed', 'withdrawn', 'cancelled', 'expired', 'completed']);

const EXPECTED: Record<EventStatus, readonly EventStatus[]> = {
  active: ['active', 'scheduled', 'postponed', 'resolved', 'dismissed', 'withdrawn', 'cancelled', 'expired', 'completed'],
  scheduled: ['scheduled', 'postponed', 'completed', 'cancelled', 'withdrawn', 'expired', 'resolved', 'dismissed'],
  postponed: ['postponed', 'scheduled', 'completed', 'cancelled', 'withdrawn', 'expired', 'resolved', 'dismissed'],
  resolved: ['resolved'],
  dismissed: ['dismissed'],
  withdrawn: ['withdrawn'],
  cancelled: ['cancelled'],
  expired: ['expired'],
  completed: ['completed'],
};

export interface EventVersion {
  sourceKey: string;
  sourceRecordId: string;
  version: number;
  eventType: SignalType;
  status: EventStatus;
  eventDate: string | null;
  filedDate: string | null;
  scheduledDate: string | null;
  amount: number | null;
  /** When Northstar first observed this version. */
  discoveredAt: string;
  /** Version number this one supersedes (null for the first). */
  supersedesVersion: number | null;
  /** How this version came about. */
  origin: 'source' | 'expiry_rule';
  anomaly: string | null;
}

export type ObservationOutcome =
  | { kind: 'created'; version: EventVersion }
  | { kind: 'superseded'; version: EventVersion; previous: EventVersion }
  | { kind: 'unchanged'; current: EventVersion };

function same(a: EventVersion, e: RecordEvent): boolean {
  return (
    a.eventType === e.eventType &&
    a.status === e.status &&
    a.eventDate === (e.eventDate ?? null) &&
    a.filedDate === (e.filedDate ?? null) &&
    a.scheduledDate === (e.scheduledDate ?? null) &&
    a.amount === (e.amount ?? null)
  );
}

export function isExpectedTransition(from: EventStatus, to: EventStatus): boolean {
  return EXPECTED[from].includes(to);
}

/**
 * Apply one source observation to an event's history and return what should be appended.
 * `history` must be the versions for one (sourceKey, sourceRecordId), in any order.
 */
export function applyObservation(
  history: readonly EventVersion[],
  ref: { sourceKey: string; sourceRecordId: string },
  observed: RecordEvent,
  observedAt: string,
): ObservationOutcome {
  if (!(EVENT_STATUSES as readonly string[]).includes(observed.status)) {
    throw new Error(`status: unsupported event status ${String(observed.status)}`);
  }
  const current = currentVersion(history);
  const base = {
    sourceKey: ref.sourceKey,
    sourceRecordId: ref.sourceRecordId,
    eventType: observed.eventType,
    status: observed.status,
    eventDate: observed.eventDate ?? null,
    filedDate: observed.filedDate ?? null,
    scheduledDate: observed.scheduledDate ?? null,
    amount: observed.amount ?? null,
    discoveredAt: observedAt,
    origin: 'source' as const,
  };
  if (!current) return { kind: 'created', version: { ...base, version: 1, supersedesVersion: null, anomaly: null } };
  if (same(current, observed)) return { kind: 'unchanged', current };
  let anomaly: string | null = null;
  if (!isExpectedTransition(current.status, observed.status)) anomaly = `unexpected transition ${current.status} → ${observed.status}`;
  else if (current.eventType !== observed.eventType) anomaly = `event type changed ${current.eventType} → ${observed.eventType}`;
  return {
    kind: 'superseded',
    previous: current,
    version: { ...base, version: current.version + 1, supersedesVersion: current.version, anomaly },
  };
}

export function currentVersion(history: readonly EventVersion[]): EventVersion | null {
  let best: EventVersion | null = null;
  for (const v of history) if (!best || v.version > best.version) best = v;
  return best;
}

export interface ExpiryPolicy {
  /** Scheduled/postponed events whose date passed this many days ago with no outcome expire. Default 30. */
  scheduledGraceDays?: number;
  /** Active events with no new observation for this many days expire, per type. Unlisted types never expire. */
  activeMaxAgeDays?: Partial<Record<SignalType, number>>;
}

const DAY = 86_400_000;
const toTime = (d: string) => Date.parse(d.length === 10 ? `${d}T00:00:00Z` : d);

/**
 * Deterministic expiry rule. Returns a new `expired` version when the current version is stale under
 * the policy, otherwise null. Applied by the pipeline after each run for events the source did not
 * re-report.
 */
export function expireIfStale(history: readonly EventVersion[], asOf: string, policy: ExpiryPolicy = {}): EventVersion | null {
  const cur = currentVersion(history);
  if (!cur || TERMINAL_STATUSES.has(cur.status)) return null;
  const now = toTime(asOf);
  const grace = policy.scheduledGraceDays ?? 30;
  let reason: string | null = null;
  if ((cur.status === 'scheduled' || cur.status === 'postponed') && cur.scheduledDate) {
    if (now - toTime(cur.scheduledDate) > grace * DAY) reason = `scheduled date ${cur.scheduledDate} passed more than ${grace} days ago with no outcome`;
  } else if (cur.status === 'active') {
    const maxAge = policy.activeMaxAgeDays?.[cur.eventType];
    if (maxAge !== undefined && now - toTime(cur.discoveredAt) > maxAge * DAY) reason = `no source update for more than ${maxAge} days`;
  }
  if (!reason) return null;
  return { ...cur, version: cur.version + 1, supersedesVersion: cur.version, status: 'expired', discoveredAt: asOf, origin: 'expiry_rule', anomaly: reason };
}
