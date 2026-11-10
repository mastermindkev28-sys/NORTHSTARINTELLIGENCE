import { describe, expect, it } from 'vitest';
import {
  MarketInputError,
  PILOT_REGULATORY_ROWS,
  REGULATORY_FACTORS,
  computeRegulatoryIndex,
  getFactor,
  type RegulatoryFactorRow,
} from '../src/index';

const AS_OF = '2026-11-10';
const S = { jurisdictionKey: 'state:x', jurisdictionName: 'State X', jurisdictionLevel: 'state' } as const;
const C = { jurisdictionKey: 'city:y', jurisdictionName: 'City Y', jurisdictionLevel: 'city' } as const;
const r = (j: typeof S | typeof C, factor: string, value: RegulatoryFactorRow['value'], extra: Partial<RegulatoryFactorRow> = {}): RegulatoryFactorRow => ({ ...j, factor, value, citation: { title: 't' }, effectiveDate: null, retrievedAt: '2026-11-01T00:00:00Z', verification: 'official', ...extra });

const allState = (): RegulatoryFactorRow[] => [
  r(S, 'nonpayment_notice_days', 3), r(S, 'eviction_timeline_days', 21), r(S, 'pre_filing_diversion_required', false), r(S, 'just_cause_required', false),
  r(S, 'rent_regulation', 'preempted'), r(S, 'rent_increase_notice_days', 30), r(S, 'security_deposit_cap_months', null), r(S, 'deposit_return_days', 45),
  r(S, 'termination_notice_days', 15), r(S, 'entry_notice_hours', 0), r(S, 'rental_registration_required', false), r(S, 'rental_license_required', false),
  r(S, 'periodic_inspection_required', false), r(S, 'lead_certification_required', false),
];

describe('factor scoring rules', () => {
  it('maps endpoints exactly as the published rules state', () => {
    expect(getFactor('nonpayment_notice_days').score(3)).toBe(100);
    expect(getFactor('nonpayment_notice_days').score(30)).toBe(0);
    expect(getFactor('eviction_timeline_days').score(120)).toBe(0);
    expect(getFactor('just_cause_required').score(true)).toBe(25);
    expect(getFactor('rent_regulation').score('local_control')).toBe(0);
    expect(getFactor('rent_regulation').score('none')).toBe(85);
    expect(getFactor('security_deposit_cap_months').score(null)).toBe(100);
    expect(getFactor('security_deposit_cap_months').score(0.5)).toBe(0);
    expect(getFactor('entry_notice_hours').score(48)).toBeCloseTo(30);
    expect(getFactor('security_deposit_cap_months').display(1)).toBe('1 month of rent');
    expect(getFactor('entry_notice_hours').display(0)).toBe('No statutory requirement');
  });
  it('rejects malformed values', () => {
    expect(() => getFactor('nonpayment_notice_days').score('ten')).toThrow(MarketInputError);
    expect(() => getFactor('just_cause_required').score(1)).toThrow(MarketInputError);
    expect(() => getFactor('rent_regulation').score('sometimes')).toThrow(/unknown value/);
    expect(() => getFactor('not_a_factor')).toThrow(/not a known/);
  });
});

describe('computeRegulatoryIndex', () => {
  it('scores a fully flexible jurisdiction at 100 with full coverage and no flags', () => {
    const res = computeRegulatoryIndex(allState(), { asOf: AS_OF, jurisdictionKeys: ['state:x'] });
    expect(res.index).toBe(100);
    expect(res.coverage).toBe(1);
    expect(res.flags).toEqual([]);
  });

  it('local rows override state rows, but state preemption of rent regulation wins', () => {
    const rows = [...allState(), r(C, 'rent_regulation', 'local_control'), r(C, 'just_cause_required', true)];
    const res = computeRegulatoryIndex(rows, { asOf: AS_OF, jurisdictionKeys: ['state:x', 'city:y'] });
    const rent = res.factors.find((f) => f.key === 'rent_regulation')!;
    expect(rent.value).toBe('preempted');
    expect(rent.preemptedByState).toBe(true);
    expect(res.factors.find((f) => f.key === 'just_cause_required')!.value).toBe(true);
    expect(res.flags.map((f) => f.code)).toContain('reg.just_cause');
  });

  it('applies local rent control when the state does not preempt and flags it critical', () => {
    const rows = allState().map((x) => (x.factor === 'rent_regulation' ? { ...x, value: 'none' } : x));
    const res = computeRegulatoryIndex([...rows, r(C, 'rent_regulation', 'local_control')], { asOf: AS_OF, jurisdictionKeys: ['state:x', 'city:y'] });
    expect(res.factors.find((f) => f.key === 'rent_regulation')!.value).toBe('local_control');
    expect(res.flags.find((f) => f.code === 'reg.rent_control')!.severity).toBe('critical');
  });

  it('uses the row in force on asOf and reports future rows as pending changes', () => {
    const rows = [...allState(), r(S, 'just_cause_required', true, { effectiveDate: '2027-02-01' }), r(S, 'eviction_timeline_days', 100, { effectiveDate: '2026-01-01' })];
    const res = computeRegulatoryIndex(rows, { asOf: AS_OF, jurisdictionKeys: ['state:x'] });
    expect(res.factors.find((f) => f.key === 'just_cause_required')!.value).toBe(false);
    expect(res.factors.find((f) => f.key === 'eviction_timeline_days')!.value).toBe(100);
    expect(res.pending).toHaveLength(1);
    expect(res.pending[0]).toMatchObject({ factor: 'just_cause_required', effectiveDate: '2027-02-01' });
    expect(res.flags.map((f) => f.code)).toEqual(expect.arrayContaining(['reg.pending.just_cause_required', 'reg.long_eviction']));
    const later = computeRegulatoryIndex(rows, { asOf: '2027-03-01', jurisdictionKeys: ['state:x'] });
    expect(later.factors.find((f) => f.key === 'just_cause_required')!.value).toBe(true);
    expect(later.index!).toBeLessThan(res.index!);
  });

  it('user weights change the index and are validated', () => {
    const rows = allState().map((x) => (x.factor === 'just_cause_required' ? { ...x, value: true } : x));
    const def = computeRegulatoryIndex(rows, { asOf: AS_OF, jurisdictionKeys: ['state:x'] }).index!;
    const heavy = computeRegulatoryIndex(rows, { asOf: AS_OF, jurisdictionKeys: ['state:x'], weights: { just_cause_required: 20 } }).index!;
    const ignore = computeRegulatoryIndex(rows, { asOf: AS_OF, jurisdictionKeys: ['state:x'], weights: { just_cause_required: 0 } }).index!;
    expect(heavy).toBeLessThan(def);
    expect(ignore).toBe(100);
    expect(() => computeRegulatoryIndex(rows, { asOf: AS_OF, jurisdictionKeys: ['state:x'], weights: { just_cause_required: -1 } })).toThrow(MarketInputError);
  });

  it('missing factors lower coverage, are imputed conservatively, and withhold the index below 60%', () => {
    const few = [r(S, 'nonpayment_notice_days', 3), r(S, 'rent_regulation', 'preempted')];
    const res = computeRegulatoryIndex(few, { asOf: AS_OF, jurisdictionKeys: ['state:x'] });
    expect(res.sufficient).toBe(false);
    expect(res.index).toBeNull();
    expect(res.indexProvisional).toBeLessThan(100);
    for (const f of res.factors.filter((x) => x.status === 'missing')) expect(f.score).toBeLessThanOrEqual(50);
    expect(res.flags.map((f) => f.code)).toContain('reg.insufficient');
  });

  it('flags secondary or unverified rows and rejects unknown factors', () => {
    const rows = allState().map((x) => (x.factor === 'nonpayment_notice_days' ? { ...x, verification: 'secondary' as const } : x));
    expect(computeRegulatoryIndex(rows, { asOf: AS_OF, jurisdictionKeys: ['state:x'] }).flags.map((f) => f.code)).toContain('reg.unverified_factors');
    expect(() => computeRegulatoryIndex([r(S, 'mystery', 1)], { asOf: AS_OF, jurisdictionKeys: ['state:x'] })).toThrow(/not a known/);
  });
});

describe('pilot seed rows (from docs/LANDLORD_REGULATORY_INDEX.md)', () => {
  it('every row references a known factor, has a citation title, and a valid value for its factor', () => {
    for (const row of PILOT_REGULATORY_ROWS) {
      const f = getFactor(row.factor);
      expect(row.citation.title.length).toBeGreaterThan(0);
      expect(Number.isFinite(f.score(row.value))).toBe(true);
    }
    expect(REGULATORY_FACTORS.length).toBeGreaterThanOrEqual(14);
  });

  it('Philadelphia good cause takes effect 2026-11-01: pending before, current after', () => {
    const keys = ['state:42', 'city:4260000'];
    const before = computeRegulatoryIndex(PILOT_REGULATORY_ROWS, { asOf: '2026-10-01', jurisdictionKeys: keys });
    expect(before.factors.find((f) => f.key === 'just_cause_required')!.status).toBe('missing');
    expect(before.pending.map((p) => p.factor)).toContain('just_cause_required');
    const after = computeRegulatoryIndex(PILOT_REGULATORY_ROWS, { asOf: '2026-11-10', jurisdictionKeys: keys });
    expect(after.factors.find((f) => f.key === 'just_cause_required')!.value).toBe(true);
  });

  it('Ohio and Illinois preempt local rent control', () => {
    for (const k of ['state:39', 'state:17']) {
      const res = computeRegulatoryIndex(PILOT_REGULATORY_ROWS, { asOf: AS_OF, jurisdictionKeys: [k] });
      expect(res.factors.find((f) => f.key === 'rent_regulation')!.value).toBe('preempted');
    }
  });
});
