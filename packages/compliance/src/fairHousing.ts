/**
 * Fair housing language screen for outbound messages and targeting criteria.
 * Based on Fair Housing Act protected classes (race, color, religion, sex, familial status, national origin,
 * disability; 42 U.S.C. § 3604) and HUD advertising guidance. Many states add classes (e.g., source of income,
 * sexual orientation, gender identity, age, marital status). This is a screening aid that escalates to a human —
 * it is not a determination of legality.
 */
export interface FairHousingFinding {
  category: string;
  matched: string;
}

const PATTERNS: { category: string; pattern: RegExp }[] = [
  {
    category: "familial_status",
    pattern:
      /\b(no (kids|children)|adults? only|perfect for (singles|couples|empty nesters)|not suitable for (kids|children))\b/i,
  },
  {
    category: "religion",
    pattern:
      /\b(christian|jewish|muslim|catholic|church[- ]goers?)\s+(neighborhoods?|communit(?:y|ies)|buyers?|family|families|areas?)\b/i,
  },
  {
    category: "race_color_national_origin",
    pattern:
      /\b(white|black|hispanic|latino|asian|african|mexican|immigrants?)\s+(neighborhoods?|areas?|communit(?:y|ies)|buyers?|families|tenants?)\b/i,
  },
  {
    category: "national_origin",
    pattern: /\b(english[- ]speaking only|must speak english|no (immigrants|foreigners))\b/i,
  },
  {
    category: "disability",
    pattern:
      /\b(no wheelchairs?|able[- ]bodied (only|tenants|buyers)|not for (handicapped|disabled))\b/i,
  },
  {
    category: "sex",
    pattern: /\b(men only|women only|male tenants? only|female tenants? only)\b/i,
  },
  {
    category: "steering",
    pattern:
      /\b(exclusive|safe|good|bad|changing|transitional) (neighborhoods?|areas?|communit(?:y|ies)) for\b/i,
  },
  {
    category: "source_of_income",
    pattern: /\b(no section ?8|no vouchers|no (housing )?assistance)\b/i,
  },
];

export function screenFairHousing(text: string): FairHousingFinding[] {
  const findings: FairHousingFinding[] = [];
  for (const { category, pattern } of PATTERNS) {
    const m = text.match(pattern);
    if (m) findings.push({ category, matched: m[0] });
  }
  return findings;
}

/** Attributes that may never be used for lead targeting, scoring, or segmentation. */
export const PROHIBITED_TARGETING_ATTRIBUTES = [
  "race",
  "color",
  "religion",
  "sex",
  "gender",
  "gender_identity",
  "sexual_orientation",
  "familial_status",
  "children",
  "national_origin",
  "ethnicity",
  "language",
  "disability",
  "age",
  "marital_status",
  "source_of_income",
  "surname_origin",
  "neighborhood_demographics",
] as const;

export function findProhibitedTargetingAttributes(criteriaKeys: readonly string[]): string[] {
  const normalized = criteriaKeys.map((k) => k.toLowerCase().replace(/[\s-]+/g, "_"));
  return PROHIBITED_TARGETING_ATTRIBUTES.filter((attr) => normalized.some((k) => k.includes(attr)));
}
