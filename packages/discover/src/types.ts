/**
 * Shared Discover types. Records are generic (no vendor schema is mirrored): an instrument model for
 * recorded documents and an event model for anything with a lifecycle (sales, filings, violations).
 */

/** How a source may be used. Recorded per source in the county registry and carried on every record. */
export interface SourceLicense {
  /** Short tag stored on every record, e.g. "phl-open-data", "cook-unstated". */
  tag: string;
  /** Human-readable terms name, e.g. "City of Philadelphia License". */
  name: string;
  url?: string;
  /** Whether automated retrieval is permitted under the published terms. */
  automatedAccess: 'permitted' | 'not_stated' | 'prohibited';
  /** Whether derived data may be shown to customers. */
  commercialDisplay: 'permitted' | 'not_stated' | 'prohibited';
  /** Whether attribution is required when displayed. */
  attributionRequired: boolean;
  /** Free-text restrictions recorded by the reviewer. */
  notes?: string;
  /** Date the terms were last reviewed by a person (YYYY-MM-DD). */
  reviewedOn?: string;
}

export type RecordCategory =
  | 'assessor'
  | 'recorder'
  | 'tax'
  | 'foreclosure'
  | 'code_enforcement'
  | 'vacancy'
  | 'court'
  | 'probate'
  | 'permit';

/**
 * Property-level signal types. Deliberately limited to facts about a property or its public records.
 * There are no types describing a person's circumstances (health, finances, family events, age,
 * or any protected characteristic), and no "distress" or "desperation" labels.
 */
export const SIGNAL_TYPES = [
  'tax_delinquency',
  'tax_sale_listed',
  'lis_pendens',
  'foreclosure_filing',
  'sheriff_sale_scheduled',
  'code_violation',
  'unsafe_building',
  'vacancy_indicator',
  'probate_filing',
  'absentee_owner',
  'long_ownership',
  'recent_sale',
  'permit_activity',
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export function isSignalType(v: unknown): v is SignalType {
  return typeof v === 'string' && (SIGNAL_TYPES as readonly string[]).includes(v);
}

export const EVENT_STATUSES = ['active', 'scheduled', 'postponed', 'resolved', 'dismissed', 'withdrawn', 'cancelled', 'expired', 'completed'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export interface InstrumentParty {
  role: 'grantor' | 'grantee' | 'mortgagor' | 'mortgagee' | 'assignor' | 'assignee' | 'plaintiff' | 'defendant' | 'owner' | 'other';
  name: string;
}

/** A recorded document (deed, mortgage, assignment, satisfaction, lien, lis pendens). */
export interface Instrument {
  instrumentType: string;
  instrumentNumber?: string;
  book?: string;
  page?: string;
  recordedDate?: string;
  instrumentDate?: string;
  parties: InstrumentParty[];
  /** Stated consideration. For mortgages this is the original recorded amount, never a current balance. */
  consideration?: number;
  apn?: string;
}

/** A normalized record emitted by a connector, before entity resolution. */
export interface SourceRecord {
  sourceKey: string;
  sourceRecordId: string;
  category: RecordCategory;
  retrievedAt: string;
  licenseTag: string;
  /** Parcel identifier as published by the source (normalized later). */
  apn?: string;
  address?: RawAddress;
  instrument?: Instrument;
  event?: RecordEvent;
  /** Additional attributes kept verbatim for audit. Never used for scoring unless mapped explicitly. */
  attributes: Record<string, string | number | boolean | null>;
  /** True for synthetic demo data. Demo records must never be mixed with live data in a customer view. */
  demo?: boolean;
}

export interface RecordEvent {
  eventType: SignalType;
  status: EventStatus;
  /** When the thing happened according to the source (filing, sale date, violation date). */
  eventDate?: string;
  filedDate?: string;
  /** Scheduled date for future events (sheriff sale). */
  scheduledDate?: string;
  amount?: number;
}

export interface RawAddress {
  line1?: string;
  unit?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface NormalizedAddress {
  line1: string;
  unit: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  /** Stable key for matching: "<number> <street> <suffix>|<unit>|<zip5>". */
  key: string;
}
