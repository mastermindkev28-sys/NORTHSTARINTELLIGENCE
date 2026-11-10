/**
 * Investment strategies shared across the platform. The order and spelling match the Postgres enum
 * `app.investment_strategy` (migration 0003) and the Market Intelligence package; change all three together.
 */
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

export const STRATEGY_LABELS: Record<InvestmentStrategy, string> = {
  wholesale: 'Wholesale',
  fix_and_flip: 'Fix and flip',
  buy_and_hold: 'Buy and hold',
  brrrr: 'BRRRR',
  creative_finance: 'Creative finance',
  section_8: 'Section 8',
  small_multifamily: 'Small multifamily',
  land: 'Land',
  commercial: 'Commercial',
};

export function isInvestmentStrategy(v: unknown): v is InvestmentStrategy {
  return typeof v === 'string' && (INVESTMENT_STRATEGIES as readonly string[]).includes(v);
}
