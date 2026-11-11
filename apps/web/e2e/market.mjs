/**
 * End-to-end test of the Market Intelligence workspace: real browser, real server, real Postgres.
 * Usage: BASE_URL=http://localhost:3000 node e2e/market.mjs   (server must be running)
 * Covers: explorer ranking and profiles, area profile with risk flags and cited law, compare, Landlord Regulatory
 * Index weighting, undervaluation evidence, custom profiles, watchlist monitoring with alerts, tenant isolation.
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const SHOTS = process.env.SCREENSHOT_DIR;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const stamp = Date.now().toString(36);
const browser = await chromium.launch();
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const step = (m) => console.log(`✓ ${m}`);

async function signUp(ctx, who) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/signup`);
  await page.fill('#displayName', `${who} Analyst`);
  await page.fill('#email', `mkt-${who}-${stamp}@example.com`);
  await page.fill('#orgName', `${who} Markets ${stamp}`);
  await page.fill('#password', 'a long enough passphrase');
  await page.click('button[type=submit]');
  await page.waitForURL(`${BASE}/app`);
  return page;
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const page = await signUp(ctx, 'Alpha');

  // Explorer
  await page.click('text=Market Intelligence');
  await page.waitForURL(`${BASE}/app/market`);
  await page.getByText('Geographic investment analysis').waitFor();
  assert.ok(await page.getByText('Fictional demo geographies').isVisible(), 'demo data is labeled');
  const rows = page.locator('table tbody tr');
  assert.ok((await rows.count()) >= 8, 'metro ranking lists the demo metros');
  const firstArea = await rows.first().locator('td').nth(2).innerText();
  assert.match(firstArea, /Lakeview Falls/, 'balanced profile ranks the overlooked, well-regulated growth market first');
  assert.ok(await page.getByText('Pilot jurisdictions · real, cited law').isVisible());
  await shot(page, 'm01-explorer-balanced');
  step('explorer ranks metros with category scores, confidence, flags and a demo label');

  await page.selectOption('select[name=profile]', 'fix_and_flip');
  await page.selectOption('select[name=level]', 'zip');
  await page.click('form >> text=Apply');
  await page.waitForURL(/profile=fix_and_flip/);
  assert.ok((await rows.count()) >= 30, 'ZIP level lists demo ZIPs');
  await shot(page, 'm02-explorer-zip-flip');
  step('strategy and level switch re-scores the comparison set');

  // Area profile
  await page.goto(`${BASE}/app/market/area/${encodeURIComponent('metro:demo-m41')}`);
  await page.getByText('Material risk flags').waitFor();
  assert.ok(await page.getByText('Inexpensive but exposed').first().isVisible(), 'cheap-but-exposed flag shows at the top');
  assert.ok(await page.getByText('Significant flood hazard exposure').first().isVisible());
  assert.ok(await page.getByText('Not attributed to any property').isVisible(), 'public safety disclaimer present');
  await shot(page, 'm03-area-redstone');
  step('area profile shows score, category detail, sources and unhidden risk flags');

  await page.goto(`${BASE}/app/market/area/${encodeURIComponent('city:4260000')}`);
  await page.getByText('Insufficient data').first().waitFor();
  assert.ok(await page.getByText('Philadelphia Bill No. 250330-AA').first().isVisible(), 'cited good-cause ordinance appears');
  await shot(page, 'm04-area-philadelphia');
  step('real pilot city: score withheld (no metrics yet), cited law shown');

  // Compare
  await page.goto(`${BASE}/app/market/compare?areas=metro:demo-m21,metro:demo-m31,metro:demo-m41&profile=buy_and_hold`);
  await page.getByText('Market Score').first().waitFor();
  assert.equal(await page.locator('thead th').count(), 4);
  await shot(page, 'm05-compare');
  step('compare shows side-by-side values and flags');

  // Regulatory index
  await page.goto(`${BASE}/app/market/regulatory?j=city:4260000`);
  await page.getByText('Factor weights').waitFor();
  assert.ok(await page.getByText('68 P.S. § 250.501(b)').first().isVisible());
  await page.fill('input[name=w_just_cause_required]', '0');
  await page.click('text=Apply weights');
  await page.waitForURL(/w_just_cause_required=0/);
  await shot(page, 'm06-regulatory');
  step('Landlord Regulatory Index shows cited factors and accepts user weights');

  // Undervaluation
  await page.goto(`${BASE}/app/market/property`);
  await page.getByText('Five separate signals', { exact: true }).waitFor();
  assert.ok(await page.getByText('Potentially below market: supported by adjusted comparable sales').isVisible());
  assert.ok(await page.getByText('C5 (not arm\'s-length)').isVisible(), 'non-arm\'s-length comp excluded with reason');
  await shot(page, 'm07-undervaluation');
  for (const id of ['C3', 'C4']) await page.getByRole('row').filter({ has: page.locator(`input[aria-label="${id} address"]`) }).getByText('Remove').click();
  await page.getByText('Indicators only').first().waitFor();
  step('undervaluation needs ≥ 3 eligible comps; AVM and area data alone only give indicators');

  // Custom profile
  await page.goto(`${BASE}/app/market/profiles`);
  await page.fill('input[name=name]', 'Cash flow first');
  await page.selectOption('select[name=base]', 'buy_and_hold');
  await page.fill('input[name=w_rental_economics]', '45');
  await page.fill('input[name=w_public_safety]', '5');
  await page.click('text=Save profile');
  await page.waitForURL(/profile=custom%3A|profile=custom:/);
  await page.locator('h2', { hasText: 'Cash flow first' }).first().waitFor();
  step('custom profile saves and re-ranks the explorer');

  // Monitoring
  await page.goto(`${BASE}/app/market/watchlists`);
  await page.fill('input[name=name]', 'Midwest growth');
  await page.selectOption('select[name=strategy]', 'buy_and_hold');
  await page.click('text=Create watchlist');
  await page.waitForURL(/watchlists\?w=/);
  const watchedRows = page.locator('tbody tr').filter({ has: page.locator('td a[href*="/app/market/area/"]') });
  const areaKeys = ['metro:demo-m31', 'metro:demo-m12', 'city:4260000'];
  for (const [i, k] of areaKeys.entries()) {
    await page.selectOption('select[name=areaKey]', k);
    await page.click('text=Add area');
    // Wait for the server action to land and re-render before adding the next area; networkidle alone
    // can resolve before the action's navigation starts, which silently drops an area on slow runners.
    await page.waitForFunction(
      (n) => [...document.querySelectorAll('tbody tr')].filter((r) => r.querySelector('td a[href*="/app/market/area/"]')).length >= n,
      i + 1,
    );
  }
  assert.equal(await watchedRows.count(), areaKeys.length, 'all three areas were added to the watchlist');
  await page.click('text=Run monitoring now');
  await page.waitForLoadState('networkidle');
  await page.getByText('Acknowledge').first().waitFor();
  const alerts = await page.locator('text=Acknowledge').count();
  assert.ok(alerts >= 2, `monitoring produced alerts vs prior vintage (got ${alerts})`);
  await shot(page, 'm08-monitoring');
  await page.click('text=Run monitoring now');
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('text=Acknowledge').count(), alerts, 're-running monitoring does not duplicate alerts');
  step(`monitoring evaluates rules against the prior vintage and is idempotent (${alerts} alerts)`);

  // Tenant isolation
  const other = await browser.newContext();
  const p2 = await signUp(other, 'Beta');
  await p2.goto(`${BASE}/app/market/watchlists`);
  await p2.getByText('No watchlists yet').waitFor();
  assert.equal(await p2.getByText('Midwest growth').count(), 0);
  await p2.goto(`${BASE}/app/market/profiles`);
  assert.equal(await p2.getByText('Cash flow first').count(), 0);
  step('another organization sees none of these watchlists, alerts or profiles');

  console.log('\nMarket Intelligence e2e passed');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
