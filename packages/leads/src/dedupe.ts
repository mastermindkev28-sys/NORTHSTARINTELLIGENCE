import { jaroWinkler } from "./similarity";

/** Minimal shape of an existing lead used for duplicate detection. */
export interface LeadIdentity {
  id: string;
  source?: string;
  externalId?: string | null;
  phonesE164: string[];
  email?: string | null;
  addressKey?: string | null;
  zip5?: string | null;
  fullName?: string | null;
}

export interface DuplicateCandidate {
  leadId: string;
  score: number;
  reasons: string[];
}

export type DuplicateVerdict = "duplicate" | "possible_duplicate" | "unique";

export interface DuplicateResult {
  verdict: DuplicateVerdict;
  /** Best match first. */
  candidates: DuplicateCandidate[];
}

export const DUPLICATE_THRESHOLD = 0.9;
export const POSSIBLE_DUPLICATE_THRESHOLD = 0.6;

/**
 * Multi-signal duplicate detection. Signals combine with a noisy-OR so independent weak signals
 * strengthen each other without any single fuzzy signal forcing a merge:
 *   score = 1 − Π(1 − sᵢ)
 * Exact external ID (same source) or same property address + same phone are treated as certain.
 */
export function scoreDuplicate(incoming: LeadIdentity, existing: LeadIdentity): DuplicateCandidate {
  const signals: { weight: number; reason: string }[] = [];
  if (
    incoming.externalId &&
    existing.externalId &&
    incoming.source &&
    incoming.source === existing.source &&
    incoming.externalId === existing.externalId
  ) {
    signals.push({ weight: 1, reason: "Same source record ID" });
  }
  const sharedPhone = incoming.phonesE164.find((p) => existing.phonesE164.includes(p));
  const sameAddress = !!incoming.addressKey && incoming.addressKey === existing.addressKey;
  if (sharedPhone) signals.push({ weight: 0.75, reason: `Shared phone ${maskPhone(sharedPhone)}` });
  if (sameAddress) signals.push({ weight: 0.7, reason: "Same normalized property address" });
  if (sharedPhone && sameAddress)
    signals.push({ weight: 1, reason: "Same phone and property address" });
  if (incoming.email && existing.email && incoming.email === existing.email)
    signals.push({ weight: 0.7, reason: "Same email" });
  if (incoming.fullName && existing.fullName) {
    const sim = jaroWinkler(incoming.fullName.toLowerCase(), existing.fullName.toLowerCase());
    const sameZip = !!incoming.zip5 && incoming.zip5 === existing.zip5;
    if (sim >= 0.93 && sameZip)
      signals.push({ weight: 0.45, reason: `Similar name (${sim.toFixed(2)}) in same ZIP` });
    else if (sim >= 0.97)
      signals.push({ weight: 0.15, reason: `Near-identical name (${sim.toFixed(2)})` });
  }
  const score = 1 - signals.reduce((p, s) => p * (1 - s.weight), 1);
  return {
    leadId: existing.id,
    score: Math.round(score * 1000) / 1000,
    reasons: signals.map((s) => s.reason),
  };
}

export function findDuplicates(
  incoming: LeadIdentity,
  existing: readonly LeadIdentity[],
): DuplicateResult {
  const candidates = existing
    .filter((e) => e.id !== incoming.id)
    .map((e) => scoreDuplicate(incoming, e))
    .filter((c) => c.score >= POSSIBLE_DUPLICATE_THRESHOLD)
    .sort((a, b) => b.score - a.score);
  const top = candidates[0]?.score ?? 0;
  const verdict: DuplicateVerdict =
    top >= DUPLICATE_THRESHOLD
      ? "duplicate"
      : top >= POSSIBLE_DUPLICATE_THRESHOLD
        ? "possible_duplicate"
        : "unique";
  return { verdict, candidates };
}

function maskPhone(e164: string): string {
  return `•••${e164.slice(-4)}`;
}
