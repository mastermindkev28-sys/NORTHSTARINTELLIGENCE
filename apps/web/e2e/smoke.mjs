/**
 * End-to-end smoke test: real browser, real server, real Postgres.
 * Usage: BASE_URL=http://localhost:3000 node e2e/smoke.mjs   (server must be running)
 * Covers: auth gate, sign-up, live underwriting, save, report, RLS isolation between two workspaces,
 * audit log, sign-out, and failed login.
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

// Resolved via require so a globally installed Playwright (NODE_PATH) works as well as a local one.
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
  await page.fill('#email', `${who}-${stamp}@example.com`);
  await page.fill('#orgName', `${who} Capital ${stamp}`);
  await page.fill('#password', 'a long enough passphrase');
  await page.click('button[type=submit]');
  await page.waitForURL(`${BASE}/app`);
  return page;
}

try {
  const anon = await browser.newContext();
  const p0 = await anon.newPage();
  const res = await p0.goto(`${BASE}/app/underwrite`);
  assert.equal(new URL(p0.url()).pathname, '/login', 'unauthenticated users are redirected to login');
  assert.ok(res);
  const health = await (await p0.request.get(`${BASE}/api/health`)).json();
  assert.equal(health.db, 'ok');
  step('auth gate and health check');

  const a = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const page = await signUp(a, 'Alpha');
  await page.getByText('Operations overview').waitFor();
  await shot(page, '01-dashboard-empty');
  step('sign-up creates workspace and lands on dashboard');

  // Wholesale analysis with live calculation
  await page.goto(`${BASE}/app/underwrite/new?kind=wholesale`);
  await page.fill('#name', '412 Maple Ave');
  await page.fill('#arv', '300000');
  await page.fill('#repairs', '40000');
  await page.fill('#tax', '3600');
  await page.fill('#ins', '1200');
  await page.getByText('Recommended max offer').first().waitFor();
  const resultText = await page.locator('text=Rule of thumb').locator('..').innerText();
  assert.match(resultText, /\$160,000/, 'rule-of-thumb MAO = 300k × 70% − 40k − 10k');
  await shot(page, '02-wholesale-live');
  step('live wholesale calculation matches the engine ($160,000 rule-of-thumb MAO)');

  await page.click('text=Save analysis');
  await page.waitForURL(/\/app\/underwrite\/[0-9a-f-]{36}$/);
  const reportUrl = page.url();
  await page.getByText('Calculation trace').waitFor();
  await page.getByText('Offer build-up').waitFor();
  assert.match(await page.content(), /User assumption/);
  await shot(page, '03-wholesale-report');
  step('save recomputes on the server and renders the full report');

  await page.click('button:has-text("Finalize")');
  await page.getByText('Finalized analyses are immutable').waitFor();
  step('finalize locks the analysis');

  // Rental
  await page.goto(`${BASE}/app/underwrite/new?kind=rental`);
  await page.fill('#rname', '18 Oak Duplex');
  await page.fill('#price', '200000');
  await page.fill('[aria-label="Unit 1 rent"]', '1800');
  await page.fill('#rtax', '2400');
  await page.fill('#rins', '1200');
  await page.getByText('Monthly cash flow').first().waitFor();
  await shot(page, '04-rental-live');
  await page.click('text=Save analysis');
  await page.waitForURL(/\/app\/underwrite\/[0-9a-f-]{36}$/);
  await page.getByText('10-year projection').waitFor();
  await shot(page, '05-rental-report');
  step('rental analysis with projection saved');

  await page.goto(`${BASE}/app/settings/audit`);
  const audit = await page.content();
  assert.match(audit, /underwriting_analyses\.insert/);
  assert.match(audit, /auth\.login/);
  await shot(page, '06-audit');
  step('audit log records logins and data changes');

  await page.goto(`${BASE}/app`);
  await shot(page, '07-dashboard');

  // Second tenant cannot see the first tenant's analysis, even with the direct URL.
  const b = await browser.newContext();
  const pb = await signUp(b, 'Beta');
  await pb.goto(`${BASE}/app/underwrite`);
  assert.doesNotMatch(await pb.content(), /412 Maple Ave/);
  const direct = await pb.goto(reportUrl);
  assert.equal(direct?.status(), 404, 'other tenant gets 404 for a foreign analysis id');
  step('tenant isolation: second workspace cannot list or open the first workspace’s analysis');

  // Sign out, then failed login
  await page.click('text=Sign out');
  await page.waitForURL(`${BASE}/login`);
  await page.fill('#email', `alpha-${stamp}@example.com`);
  await page.fill('#password', 'wrong password entirely');
  await page.click('button[type=submit]');
  await page.getByText('Email or password is incorrect.').waitFor();
  await page.fill('#password', 'a long enough passphrase');
  await page.click('button[type=submit]');
  await page.waitForURL(`${BASE}/app`);
  step('sign-out, rejected bad password, successful login');

  console.log('\nAll smoke checks passed.');
} catch (e) {
  console.error('\nSMOKE TEST FAILED:', e);
  for (const ctx of browser.contexts()) for (const pg of ctx.pages()) await shot(pg, `failure-${browser.contexts().indexOf(ctx)}-${ctx.pages().indexOf(pg)}`).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
