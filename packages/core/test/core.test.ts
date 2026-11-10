import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  ROLES,
  assertCan,
  can,
  createLogger,
  createMemoryRateLimiter,
  fieldErrors,
  generateToken,
  hashPassword,
  hashToken,
  isRole,
  redact,
  rentalFormSchema,
  safeEqual,
  signWebhook,
  slugify,
  toRentalReportInput,
  toWholesaleDealInput,
  validatePasswordStrength,
  verifyPassword,
  verifyWebhook,
  wholesaleFormSchema,
} from '../src/index';
import { buildRentalReport, buildWholesaleDealReport } from '@northstar/underwriting';

describe('passwords', () => {
  it('hashes and verifies', async () => {
    const h = await hashPassword('correct horse battery staple');
    expect(h).toMatch(/^scrypt\$N=16384,r=8,p=1\$[\w-]+\$[\w-]+$/);
    expect(await verifyPassword('correct horse battery staple', h)).toBe(true);
    expect(await verifyPassword('correct horse battery stapl', h)).toBe(false);
  });
  it('produces unique salts', async () => {
    expect(await hashPassword('same password here')).not.toBe(await hashPassword('same password here'));
  });
  it('normalizes unicode so visually identical passwords match', async () => {
    const h = await hashPassword('café-password-1');
    expect(await verifyPassword('café-password-1', h)).toBe(true);
  });
  it('fails closed on missing, malformed, or hostile hashes', async () => {
    expect(await verifyPassword('anything', null)).toBe(false);
    expect(await verifyPassword('anything', 'plaintext')).toBe(false);
    expect(await verifyPassword('anything', 'scrypt$N=1073741824,r=8,p=1$AAAA$AAAA')).toBe(false);
  });
  it('enforces a minimum strength', () => {
    expect(validatePasswordStrength('short')).toMatch(/at least 12/);
    expect(validatePasswordStrength('aaaaaaaaaaaaaaa')).toMatch(/repetitive/);
    expect(validatePasswordStrength('x'.repeat(300))).toMatch(/at most/);
    expect(validatePasswordStrength('a reasonable passphrase')).toBeNull();
  });
});

describe('tokens', () => {
  it('generates 256-bit url-safe tokens and stable hashes', () => {
    const t = generateToken();
    expect(t).toMatch(/^[\w-]{43}$/);
    expect(generateToken()).not.toBe(t);
    expect(hashToken(t).equals(hashToken(t))).toBe(true);
    expect(hashToken(t)).toHaveLength(32);
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('rbac', () => {
  it('owners can do everything', () => {
    for (const p of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) expect(can('owner', p)).toBe(true);
  });
  it('mirrors the database policies', () => {
    // app.can_write
    expect(ROLES.filter((r) => can(r, 'records.write'))).toEqual(['owner', 'admin', 'manager', 'acquisitions', 'analyst']);
    // app.can_delete
    expect(ROLES.filter((r) => can(r, 'records.delete'))).toEqual(['owner', 'admin', 'manager']);
    // audit_select policy
    expect(ROLES.filter((r) => can(r, 'audit.read'))).toEqual(['owner', 'admin']);
    // memberships_* policies
    expect(ROLES.filter((r) => can(r, 'members.manage'))).toEqual(['owner', 'admin']);
    // suppressions: anyone can record an opt-out
    expect(ROLES.every((r) => can(r, 'suppressions.create'))).toBe(true);
  });
  it('denies missing roles and throws a typed error', () => {
    expect(can(null, 'records.read')).toBe(false);
    expect(() => assertCan('viewer', 'records.write')).toThrow('records.write');
    expect(isRole('admin')).toBe(true);
    expect(isRole('root')).toBe(false);
  });
});

describe('logger', () => {
  it('emits JSON lines with redaction and level filtering', () => {
    const lines: string[] = [];
    const log = createLogger({ service: 'test' }, { level: 'info', sink: (l) => lines.push(l), now: () => new Date('2026-01-01T00:00:00Z') });
    log.debug('hidden');
    log.child({ requestId: 'r1' }).info('login', { email: 'a@b.co', password: 'x', nested: { apiKey: 'k' } });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toEqual({
      ts: '2026-01-01T00:00:00.000Z', level: 'info', msg: 'login', service: 'test', requestId: 'r1', email: 'a@b.co', password: '[REDACTED]', nested: { apiKey: '[REDACTED]' },
    });
  });
  it('serializes errors safely', () => {
    expect(redact({ err: new Error('boom') })).toEqual({ err: { name: 'Error', message: 'boom' } });
  });
});

describe('rate limiter', () => {
  it('allows bursts up to capacity, then refills', async () => {
    let t = 0;
    const rl = createMemoryRateLimiter({ capacity: 3, refillPerSecond: 1, now: () => t });
    for (let i = 0; i < 3; i++) expect((await rl.consume('ip')).allowed).toBe(true);
    const denied = await rl.consume('ip');
    expect(denied).toEqual({ allowed: false, remaining: 0, retryAfterMs: 1000 });
    expect((await rl.consume('other')).allowed).toBe(true);
    t = 1000;
    expect((await rl.consume('ip')).allowed).toBe(true);
  });
  it('bounds memory', async () => {
    const rl = createMemoryRateLimiter({ capacity: 1, refillPerSecond: 1, maxKeys: 2, now: () => 0 });
    await rl.consume('a');
    await rl.consume('b');
    await rl.consume('c');
    expect((await rl.consume('a')).allowed).toBe(true); // 'a' was evicted, so it starts full
  });
});

describe('webhooks', () => {
  const body = '{"event":"lead.created"}';
  const ts = '1767225600';
  it('accepts valid signatures, including during secret rotation', () => {
    const sig = signWebhook('old', ts, body);
    expect(verifyWebhook({ rawBody: body, timestamp: ts, signature: sig, secrets: ['new', 'old'], nowSeconds: 1767225600 })).toEqual({ ok: true });
  });
  it('rejects tampering, replay, missing headers, and missing secrets', () => {
    const sig = signWebhook('s', ts, body);
    const base = { rawBody: body, timestamp: ts, signature: sig, secrets: ['s'], nowSeconds: 1767225600 };
    expect(verifyWebhook({ ...base, rawBody: body + ' ' })).toEqual({ ok: false, reason: 'bad_signature' });
    expect(verifyWebhook({ ...base, nowSeconds: 1767225600 + 301 })).toEqual({ ok: false, reason: 'stale' });
    expect(verifyWebhook({ ...base, signature: null })).toEqual({ ok: false, reason: 'missing_headers' });
    expect(verifyWebhook({ ...base, secrets: [] })).toEqual({ ok: false, reason: 'no_secret' });
    expect(verifyWebhook({ ...base, timestamp: 'abc' })).toEqual({ ok: false, reason: 'stale' });
  });
});

describe('slugify', () => {
  it('produces database-valid slugs', () => {
    expect(slugify('Northstar Acquisitions, LLC')).toBe('northstar-acquisitions-llc');
    expect(slugify('Café Équipe')).toBe('cafe-equipe');
    expect(slugify('!!!')).toBe('org');
    expect(slugify('a'.repeat(100))).toHaveLength(63);
  });
});

describe('validation → engine', () => {
  const form = {
    name: 'Maple St',
    arv: { value: '300000', source: 'third_party_estimate', sourceRef: 'AVM' },
    repairs: { value: 40000 },
    assignmentFee: 10000,
    buyer: { annualPropertyTax: 3600, annualInsurance: 1200, loanToValuePct: 90, annualInterestRatePct: 12, pointsPct: 2 },
  };
  it('parses, applies defaults, converts percentages, and runs the engine', () => {
    const parsed = wholesaleFormSchema.parse(form);
    const input = toWholesaleDealInput(parsed);
    expect(input.arvMultiplier).toBe(0.7);
    expect(input.buyer.loanToValue).toBe(0.9);
    expect(input.arv).toEqual({ value: 300000, source: 'third_party_estimate', sourceRef: 'AVM' });
    const report = buildWholesaleDealReport(input);
    expect(report.summary.maoRuleOfThumb).toBe(160000);
    expect(report.assumptionsBySource.third_party_estimate[0]!.sourceRef).toBe('AVM');
  });
  it('maps comps with adjustments and provenance', () => {
    const parsed = wholesaleFormSchema.parse({
      ...form,
      arv: undefined,
      subjectSquareFeet: 1600,
      comps: [{ id: 'A', salePrice: 300000, squareFeet: 1500, netAdjustment: 5000, source: 'verified', saleDate: '2026-09-01', distanceMiles: 0.3, address: '1 A St' }],
    });
    const input = toWholesaleDealInput(parsed);
    expect(input.comps![0]).toEqual({ id: 'A', address: '1 A St', salePrice: { value: 300000, source: 'verified' }, squareFeet: 1500, saleDate: '2026-09-01', distanceMiles: 0.3, adjustments: { net: 5000 } });
  });
  it('rejects incomplete or inconsistent forms with field paths', () => {
    const r1 = wholesaleFormSchema.safeParse({ ...form, arv: undefined });
    expect(r1.success).toBe(false);
    expect(fieldErrors(r1.error!)).toHaveProperty('arv');
    const r2 = wholesaleFormSchema.safeParse({ ...form, buyer: { ...form.buyer, annualInterestRatePct: 0 } });
    expect(fieldErrors(r2.error!)).toHaveProperty(['buyer.annualInterestRatePct']);
    const r3 = wholesaleFormSchema.safeParse({ ...form, arvMultiplierPct: 700 });
    expect(r3.success).toBe(false);
    const r4 = wholesaleFormSchema.safeParse({ ...form, arv: undefined, comps: [{ id: 'A', salePrice: 1, squareFeet: 1 }] });
    expect(fieldErrors(r4.error!)).toHaveProperty('subjectSquareFeet');
  });
  it('maps rental forms including loan and projection', () => {
    const parsed = rentalFormSchema.parse({
      name: 'Duplex',
      purchasePrice: { value: 200000, source: 'verified' },
      monthlyRents: [900, 900],
      vacancyPct: 5,
      annualPropertyTax: 2400,
      annualInsurance: 1200,
      managementPct: 8,
      financing: { type: 'loan', downPaymentPct: 25, annualInterestRatePct: 7, termYears: 30 },
      projection: { years: 5, rentGrowthPct: 3, expenseGrowthPct: 2.5, appreciationPct: 3 },
    });
    const input = toRentalReportInput(parsed);
    expect(input.rental.loan).toMatchObject({ downPaymentRate: 0.25, annualInterestRate: 0.07, termMonths: 360 });
    const report = buildRentalReport(input);
    expect(report.analysis.loanAmount).toBe(150000);
    expect(report.projection?.years).toHaveLength(5);
    const cash = toRentalReportInput(rentalFormSchema.parse({ ...parsed, financing: { type: 'cash' }, projection: undefined }));
    expect(cash.rental.loan).toBeUndefined();
  });
});
