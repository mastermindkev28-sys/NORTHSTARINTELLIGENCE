/**
 * Inbound message classification for consent changes.
 *
 * Includes the seven words FCC 26-67 requires texters to honor (stop, quit, end, revoke, opt out, cancel,
 * unsubscribe; effective 2026-11-25) plus CTIA variants (STOPALL, OPTOUT). The FCC's consent-revocation rules allow revocation "by any reasonable means", so we also
 * detect natural-language revocations ("stop texting me", "take me off your list"). When in doubt we treat the
 * message as a revocation and escalate — the cost of a false positive is one paused lead; the cost of a false
 * negative is a TCPA violation.
 */
export type InboundIntent = "opt_out" | "opt_in" | "help" | "none";

export interface OptOutClassification {
  intent: InboundIntent;
  /** "keyword" = exact standard keyword; "phrase" = natural-language match. */
  matchType: "keyword" | "phrase" | null;
  matched: string | null;
  /** True when a human should review (ambiguous or hostile message). */
  needsReview: boolean;
}

const STOP_KEYWORDS = new Set([
  "stop",
  "stopall",
  "stop all",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
  "revoke",
  "optout",
  "opt out",
  "opt-out",
  "remove",
]);
const START_KEYWORDS = new Set(["start", "unstop", "yes", "subscribe"]);
const HELP_KEYWORDS = new Set(["help", "info"]);

const REVOCATION_PHRASES: RegExp[] = [
  /\b(stop|quit|cease|quit) (texting|messaging|calling|contacting|sending)\b/i,
  /\b(don'?t|do not|never) (text|call|message|contact|email) (me|us|this number)\b/i,
  /\b(take|remove|delete) (me|my number|this number) (off|from)\b/i,
  /\b(unsubscribe|opt me out|leave me alone|lose (this|my) number)\b/i,
  /\bwrong (number|person)\b/i,
  /\bno (more|further) (texts?|messages?|calls?)\b/i,
  /\bnot interested,? (stop|don'?t)/i,
  /\b(do not call|dnc)\b/i,
  /\breport(ing)? (you|this) (to|for)\b/i,
];

const HOSTILE = /\b(lawyer|attorney|sue|lawsuit|harass\w*|police|fcc|ftc|attorney general)\b/i;

export function classifyInbound(body: string): OptOutClassification {
  const normalized = body
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[.!?,;:"'*]+$/g, "")
    .replace(/\s+/g, " ");
  const hostile = HOSTILE.test(body);
  if (STOP_KEYWORDS.has(normalized))
    return { intent: "opt_out", matchType: "keyword", matched: normalized, needsReview: hostile };
  if (START_KEYWORDS.has(normalized))
    return { intent: "opt_in", matchType: "keyword", matched: normalized, needsReview: false };
  if (HELP_KEYWORDS.has(normalized))
    return { intent: "help", matchType: "keyword", matched: normalized, needsReview: false };
  // Keyword as the first word ("STOP please", "Stop.") counts as a revocation.
  const firstWord = normalized.split(" ")[0] ?? "";
  if (["stop", "unsubscribe", "stopall", "quit", "cancel", "optout"].includes(firstWord)) {
    return { intent: "opt_out", matchType: "keyword", matched: firstWord, needsReview: hostile };
  }
  for (const re of REVOCATION_PHRASES) {
    const m = body.match(re);
    if (m) return { intent: "opt_out", matchType: "phrase", matched: m[0], needsReview: true };
  }
  return { intent: "none", matchType: null, matched: null, needsReview: hostile };
}

export const OPT_OUT_CONFIRMATION = (businessName: string) =>
  `${businessName}: You've been unsubscribed and will receive no further messages. Reply START to resubscribe.`;
