/**
 * Strategy profiles: category weights and within-category variable emphasis per investment strategy.
 *
 * "balanced" is the owner's baseline hypothesis (growth 25, affordability 20, regulatory 20, rental 15,
 * safety 10, environmental 10). Strategy profiles are starting hypotheses too, and every one can be customized.
 * Strategy names match the Discover thread's app.investment_strategy enum.
 */
import { CATEGORY_KEYS, MarketInputError, type CategoryKey } from './types';
import { hasMetric } from './metrics';

export const INVESTMENT_STRATEGIES = [
  'wholesale',
  'fix_and_flip',
  'buy_and_hold',
  'brrrr',
  'creative_finance',
  'section_8',
  'small_multifamily',
  'land',
  'commercial',
] as const;
export type InvestmentStrategy = (typeof INVESTMENT_STRATEGIES)[number];

export type ProfileId = 'balanced' | InvestmentStrategy | `custom:${string}`;

export interface ScoreProfile {
  id: ProfileId;
  label: string;
  description: string;
  /** What this strategy prioritizes, in plain language (shown in the UI). */
  priorities: string[];
  categoryWeights: Record<CategoryKey, number>;
  /** Multipliers on catalog weights within a category, e.g. { median_days_on_market: 3 }. 0 removes a variable. */
  variableEmphasis: Partial<Record<string, number>>;
}

const cw = (growth: number, affordability: number, regulatory: number, rental_economics: number, public_safety: number, environmental_risk: number) =>
  ({ growth, affordability, regulatory, rental_economics, public_safety, environmental_risk }) satisfies Record<CategoryKey, number>;

export const PROFILES: Record<'balanced' | InvestmentStrategy, ScoreProfile> = {
  balanced: { id: 'balanced', label: 'Balanced (baseline)', description: 'Owner baseline hypothesis across all six categories.', priorities: ['Even view across growth, price, regulation, rents, safety and risk'], categoryWeights: cw(25, 20, 20, 15, 10, 10), variableEmphasis: {} },
  wholesale: {
    id: 'wholesale', label: 'Wholesale', description: 'Markets where discounted contracts can be assigned quickly to cash buyers.',
    priorities: ['Acquisition discounts and price cuts', 'Resale liquidity (buyer demand)', 'Verified comp support'],
    categoryWeights: cw(15, 40, 5, 15, 10, 15),
    variableEmphasis: { median_days_on_market: 2.5, price_reduction_share_pct: 2, below_comp_sale_share_pct: 2.5, sale_to_list_ratio: 1.5, employment_growth_1y_pct: 1.5 },
  },
  fix_and_flip: {
    id: 'fix_and_flip', label: 'Fix and flip', description: 'Buy below comps, renovate, resell into a liquid market.',
    priorities: ['Acquisition discounts', 'Comparable resale prices and liquidity', 'Renovation economics and project risk'],
    categoryWeights: cw(20, 35, 5, 5, 15, 20),
    variableEmphasis: { median_days_on_market: 3, below_comp_sale_share_pct: 2.5, hpi_change_5y_pct: 2, price_reduction_share_pct: 1.5, flood_zone_share_pct: 1.5, rent_growth_1y_pct: 0, fmr_to_market_rent_ratio: 0 },
  },
  buy_and_hold: {
    id: 'buy_and_hold', label: 'Buy and hold', description: 'Long-term rentals with durable cash flow.',
    priorities: ['Rent-to-price', 'Tenant demand', 'Operating costs and taxes', 'Rental regulations'],
    categoryWeights: cw(20, 10, 25, 25, 10, 10),
    variableEmphasis: { price_to_rent_ratio: 1.5, rental_vacancy_rate_pct: 1.5, effective_property_tax_rate_pct: 1.5, household_growth_5y_pct: 1.5, median_days_on_market: 0.25, fmr_to_market_rent_ratio: 0 },
  },
  brrrr: {
    id: 'brrrr', label: 'BRRRR', description: 'Buy distressed, rehab, rent, refinance at stabilized value, repeat.',
    priorities: ['Affordable acquisition', 'Renovation upside (below-comp sales)', 'Stabilized rental economics', 'Appraisal support for refinance'],
    categoryWeights: cw(15, 25, 20, 25, 7.5, 7.5),
    variableEmphasis: { below_comp_sale_share_pct: 2.5, price_to_rent_ratio: 2, hpi_change_5y_pct: 1.5, rental_vacancy_rate_pct: 1.25, fmr_to_market_rent_ratio: 0 },
  },
  creative_finance: {
    id: 'creative_finance', label: 'Creative finance', description: 'Seller financing and subject-to acquisitions; recorded mortgages are not verified loan terms.',
    priorities: ['Rental economics to carry the payment', 'Regulatory climate for holding', 'Price cuts (seller flexibility)'],
    categoryWeights: cw(15, 20, 20, 25, 10, 10),
    variableEmphasis: { price_reduction_share_pct: 2, median_days_on_market: 1.5, price_to_rent_ratio: 1.5, fmr_to_market_rent_ratio: 0 },
  },
  section_8: {
    id: 'section_8', label: 'Section 8', description: 'Housing Choice Voucher rentals. HUD FMR is a benchmark; PHA payment standards and approved rents decide actual rent.',
    priorities: ['HUD rent benchmarks vs market', 'Rental demand', 'Operating costs and inspections', 'Local regulations'],
    categoryWeights: cw(10, 15, 25, 30, 10, 10),
    variableEmphasis: { fmr_to_market_rent_ratio: 6, rent_growth_1y_pct: 0.5, effective_property_tax_rate_pct: 1.5, rental_vacancy_rate_pct: 1.5, median_days_on_market: 0 },
  },
  small_multifamily: {
    id: 'small_multifamily', label: 'Small multifamily', description: '2–20 unit residential held for income.',
    priorities: ['Rental economics', 'Household formation', 'Rent regulation and just-cause rules', 'Taxes'],
    categoryWeights: cw(20, 10, 25, 25, 10, 10),
    variableEmphasis: { household_growth_5y_pct: 2, rental_vacancy_rate_pct: 1.5, permits_per_1k_households: 0.5, fmr_to_market_rent_ratio: 0.5 },
  },
  land: {
    id: 'land', label: 'Land', description: 'Raw and infill land for development or resale.',
    priorities: ['Population and household growth', 'Building permit activity', 'Hazard exposure'],
    categoryWeights: cw(45, 20, 5, 0, 5, 25),
    variableEmphasis: { permits_per_1k_households: 3, population_growth_5y_pct: 2, net_migration_per_1k: 2, median_days_on_market: 0.5, flood_zone_share_pct: 2 },
  },
  commercial: {
    id: 'commercial', label: 'Commercial', description: 'Small commercial and mixed-use; depends on employment base more than residential rents.',
    priorities: ['Employment and wage growth', 'Industry diversification', 'Taxes and hazard exposure'],
    categoryWeights: cw(40, 15, 5, 10, 10, 20),
    variableEmphasis: { employment_growth_1y_pct: 2, industry_diversification: 2.5, wage_growth_1y_pct: 1.5, fmr_to_market_rent_ratio: 0 },
  },
};

export function getProfile(id: string): ScoreProfile {
  const p = (PROFILES as Record<string, ScoreProfile>)[id];
  if (!p) throw new MarketInputError('profile', `unknown profile "${id}"`);
  return p;
}

/** Validate and build a custom profile (stored per organization in market_score_profiles). */
export function customProfile(input: {
  id: string;
  label: string;
  base?: keyof typeof PROFILES;
  categoryWeights: Partial<Record<CategoryKey, number>>;
  variableEmphasis?: Partial<Record<string, number>>;
}): ScoreProfile {
  const base = PROFILES[input.base ?? 'balanced'];
  const weights = { ...base.categoryWeights };
  for (const k of Object.keys(input.categoryWeights)) {
    if (!(CATEGORY_KEYS as readonly string[]).includes(k)) throw new MarketInputError('categoryWeights', `unknown category "${k}"`);
    const v = input.categoryWeights[k as CategoryKey]!;
    if (!Number.isFinite(v) || v < 0 || v > 100) throw new MarketInputError(`categoryWeights.${k}`, 'must be between 0 and 100');
    weights[k as CategoryKey] = v;
  }
  if (CATEGORY_KEYS.every((k) => weights[k] === 0)) throw new MarketInputError('categoryWeights', 'at least one category needs a weight above 0');
  const emphasis = { ...base.variableEmphasis, ...(input.variableEmphasis ?? {}) };
  for (const [k, v] of Object.entries(emphasis)) {
    if (!hasMetric(k)) throw new MarketInputError('variableEmphasis', `unknown metric "${k}"`);
    if (v === undefined || !Number.isFinite(v) || v < 0 || v > 10) throw new MarketInputError(`variableEmphasis.${k}`, 'must be between 0 and 10');
  }
  return { id: `custom:${input.id}`, label: input.label, description: `Custom profile based on ${base.label}.`, priorities: base.priorities, categoryWeights: weights, variableEmphasis: emphasis };
}

/** Category weights as shares summing to 1. */
export function normalizedCategoryWeights(p: ScoreProfile): Record<CategoryKey, number> {
  const total = CATEGORY_KEYS.reduce((s, k) => s + p.categoryWeights[k], 0);
  return Object.fromEntries(CATEGORY_KEYS.map((k) => [k, total > 0 ? p.categoryWeights[k] / total : 0])) as Record<CategoryKey, number>;
}
