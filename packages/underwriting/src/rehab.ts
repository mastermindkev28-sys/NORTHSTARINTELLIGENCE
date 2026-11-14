import { CalculationInputError, Trace, requireNonNegative, requireRate } from "./trace.js";

export type RehabScope = "cosmetic" | "moderate" | "full" | "gut";

/**
 * Default $/sqft by scope. THESE ARE PLACEHOLDER ASSUMPTIONS, not market data.
 * Organizations must calibrate them to their market and contractors (stored per organization).
 */
export const DEFAULT_REHAB_COST_PER_SQFT: Readonly<Record<RehabScope, number>> = {
  cosmetic: 15,
  moderate: 35,
  full: 60,
  gut: 90,
};

export interface RehabLineItem {
  category: string;
  quantity: number;
  unitCost: number;
  note?: string;
}

export interface RehabInputs {
  livingAreaSqft: number;
  scope?: RehabScope;
  costPerSqftByScope?: Partial<Record<RehabScope, number>>;
  /** If present, line items replace the $/sqft method. */
  lineItems?: RehabLineItem[];
  /** Contingency as a decimal of the base estimate. */
  contingencyRate?: number;
}

export interface RehabEstimate {
  method: "line_items" | "per_sqft";
  base: number;
  contingency: number;
  total: number;
  lines: { category: string; amount: number }[];
  isPlaceholderRate: boolean;
}

export function estimateRehab(i: RehabInputs, trace = new Trace()): RehabEstimate {
  const contingencyRate = i.contingencyRate ?? 0.1;
  requireRate("contingencyRate", contingencyRate, { max: 0.5 });
  let base: number;
  let lines: { category: string; amount: number }[];
  let method: RehabEstimate["method"];
  let isPlaceholderRate = false;

  if (i.lineItems && i.lineItems.length > 0) {
    method = "line_items";
    lines = i.lineItems.map((li) => {
      requireNonNegative(`${li.category} quantity`, li.quantity);
      requireNonNegative(`${li.category} unitCost`, li.unitCost);
      return { category: li.category, amount: li.quantity * li.unitCost };
    });
    base = lines.reduce((s, l) => s + l.amount, 0);
    trace.record({ key: "rehab_base", label: "Rehab base (line items)", formula: "Σ quantity × unit cost", inputs: { lineItems: lines.length }, result: base, unit: "usd" });
  } else {
    if (!i.scope) throw new CalculationInputError("Provide either lineItems or a rehab scope");
    requireNonNegative("livingAreaSqft", i.livingAreaSqft);
    method = "per_sqft";
    const custom = i.costPerSqftByScope?.[i.scope];
    isPlaceholderRate = custom === undefined;
    const rate = custom ?? DEFAULT_REHAB_COST_PER_SQFT[i.scope];
    base = rate * i.livingAreaSqft;
    lines = [{ category: `${i.scope} rehab @ $${rate}/sqft`, amount: base }];
    trace.record({ key: "rehab_base", label: "Rehab base ($/sqft)", formula: "scope $/sqft × living area", inputs: { scope: i.scope, rate, sqft: i.livingAreaSqft }, result: base, unit: "usd" });
  }
  const contingency = base * contingencyRate;
  const total = trace.record({ key: "rehab_total", label: "Rehab estimate incl. contingency", formula: "base × (1 + contingency rate)", inputs: { base, contingencyRate }, result: base + contingency, unit: "usd" });
  return { method, base, contingency, total, lines, isPlaceholderRate };
}
