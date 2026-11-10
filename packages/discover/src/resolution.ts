/**
 * Entity resolution: link a source record to a parcel with an explicit confidence.
 *
 *   ≥ AUTO_MATCH_THRESHOLD   linked automatically
 *   ≥ REVIEW_THRESHOLD       queued for human review (never linked automatically)
 *   below                    no match
 *
 * A near-tie between the two best candidates always goes to review, whatever the score. Fuzzy
 * street matching is only allowed when the house number and ZIP agree exactly, so "12 Oak St" can
 * never match "21 Oak St".
 */
import { jaroWinkler, normalizeAddress, normalizeApn, normalizeName } from './normalize';
import type { NormalizedAddress, SourceRecord } from './types';

export const AUTO_MATCH_THRESHOLD = 0.85;
export const REVIEW_THRESHOLD = 0.6;
export const TIE_MARGIN = 0.05;

export interface ParcelCandidate {
  parcelId: string;
  countyFips: string;
  apn: string | null;
  address: NormalizedAddress | null;
  ownerNames?: readonly string[];
}

export interface CandidateScore {
  parcelId: string;
  confidence: number;
  reasons: string[];
}

export interface ResolutionResult {
  decision: 'matched' | 'review' | 'no_match';
  parcelId: string | null;
  confidence: number;
  reasons: string[];
  candidates: CandidateScore[];
}

function houseNumber(line1: string): string | null {
  const m = /^(\d+[A-Z]?)\s/.exec(line1);
  return m ? m[1]! : null;
}

function streetPart(line1: string): string {
  return line1.replace(/^\d+[A-Z]?\s+/, '');
}

function partyNames(record: SourceRecord): string[] {
  const names = record.instrument?.parties.map((p) => p.name) ?? [];
  const owner = record.attributes['owner_name'];
  if (typeof owner === 'string') names.push(owner);
  return names.map(normalizeName).filter(Boolean);
}

export function scoreCandidate(record: SourceRecord, countyFips: string, c: ParcelCandidate): CandidateScore {
  const reasons: string[] = [];
  if (c.countyFips !== countyFips) return { parcelId: c.parcelId, confidence: 0, reasons: ['different county'] };
  const apn = normalizeApn(record.apn ?? record.instrument?.apn);
  const capn = normalizeApn(c.apn);
  let conf = 0;
  if (apn && capn) {
    if (apn === capn) {
      conf = 0.99;
      reasons.push('exact parcel number');
    } else {
      reasons.push('parcel number differs');
    }
  }
  const addr = record.address ? normalizeAddress(record.address) : null;
  if (conf < 0.99 && addr && c.address) {
    const sameNumber = houseNumber(addr.line1) !== null && houseNumber(addr.line1) === houseNumber(c.address.line1);
    const sameUnit = (addr.unit ?? '') === (c.address.unit ?? '');
    const zipKnown = addr.postalCode !== null && c.address.postalCode !== null;
    const sameZip = zipKnown && addr.postalCode === c.address.postalCode;
    if (addr.line1 === c.address.line1 && sameUnit && sameZip) {
      conf = Math.max(conf, 0.9);
      reasons.push('exact address and ZIP');
    } else if (addr.line1 === c.address.line1 && sameUnit && !zipKnown && addr.city !== null && addr.city === c.address.city) {
      conf = Math.max(conf, 0.75);
      reasons.push('exact street address and city, ZIP missing');
    } else if (sameNumber && sameZip && sameUnit) {
      const sim = jaroWinkler(streetPart(addr.line1), streetPart(c.address.line1));
      if (sim >= 0.92) {
        conf = Math.max(conf, 0.7);
        reasons.push(`similar street name (${sim.toFixed(2)})`);
      }
    } else if (addr.line1 === c.address.line1 && !sameUnit) {
      reasons.push('same building, different unit');
      conf = Math.max(conf, 0.5);
    }
    // A conflicting parcel number caps address-based confidence at review level.
    if (apn && capn && apn !== capn) conf = Math.min(conf, 0.65);
  }
  if (conf > 0 && conf < 0.99 && c.ownerNames && c.ownerNames.length > 0) {
    const mine = partyNames(record);
    const theirs = c.ownerNames.map(normalizeName);
    const best = Math.max(0, ...mine.flatMap((a) => theirs.map((b) => jaroWinkler(a, b))));
    if (best >= 0.92) {
      conf = Math.min(0.95, conf + 0.05);
      reasons.push(`owner name agrees (${best.toFixed(2)})`);
    }
  }
  return { parcelId: c.parcelId, confidence: Math.round(conf * 1000) / 1000, reasons };
}

export function resolveRecord(record: SourceRecord, countyFips: string, candidates: readonly ParcelCandidate[]): ResolutionResult {
  const scored = candidates
    .map((c) => scoreCandidate(record, countyFips, c))
    .filter((s) => s.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence || a.parcelId.localeCompare(b.parcelId));
  const top = scored[0];
  if (!top || top.confidence < REVIEW_THRESHOLD) {
    return { decision: 'no_match', parcelId: null, confidence: top?.confidence ?? 0, reasons: top?.reasons ?? ['no candidate'], candidates: scored };
  }
  const second = scored[1];
  if (second && top.confidence - second.confidence < TIE_MARGIN) {
    return { decision: 'review', parcelId: null, confidence: top.confidence, reasons: [...top.reasons, `ambiguous: ${second.parcelId} scores ${second.confidence}`], candidates: scored };
  }
  if (top.confidence >= AUTO_MATCH_THRESHOLD) {
    return { decision: 'matched', parcelId: top.parcelId, confidence: top.confidence, reasons: top.reasons, candidates: scored };
  }
  return { decision: 'review', parcelId: null, confidence: top.confidence, reasons: top.reasons, candidates: scored };
}
