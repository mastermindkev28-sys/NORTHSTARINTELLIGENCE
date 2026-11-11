'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertCan } from '@northstar/core';
import { marketRepo } from '@northstar/db';
import { CATEGORY_KEYS, DEFAULT_ALERT_RULES, INVESTMENT_STRATEGIES, METRICS, customProfile, validateAlertRule, type AlertRule, type CategoryKey } from '@northstar/market';
import { asTenant } from '../server/session';
import { log } from '../server/db';
import { marketSource } from '../server/market';
import { runMonitoring } from '../server/monitoring';

const uuid = z.string().uuid();
const areaKey = z.string().regex(/^(state|metro|city|zip|neighborhood):[A-Za-z0-9_-]{1,40}$/);
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

function fail(e: unknown, op: string): never {
  log.error(`market.${op}_failed`, { err: e, ref: randomUUID() });
  throw e;
}

export async function createWatchlistAction(form: FormData): Promise<void> {
  const name = z.string().min(1).max(120).safeParse(str(form, 'name'));
  const strategyRaw = str(form, 'strategy');
  const strategy = (INVESTMENT_STRATEGIES as readonly string[]).includes(strategyRaw) ? strategyRaw : null;
  if (!name.success) return;
  let id: string;
  try {
    id = await asTenant(async (tx, s) => {
      assertCan(s.role, 'records.write');
      const wid = await marketRepo.createWatchlist(tx, { name: name.data, strategy });
      for (const r of DEFAULT_ALERT_RULES) await marketRepo.createAlertRule(tx, wid, r as { kind: string } & Record<string, unknown>);
      return wid;
    });
  } catch (e) {
    if ((e as { code?: string }).code === '23505') return; // duplicate name
    fail(e, 'create_watchlist');
  }
  revalidatePath('/app/market/watchlists');
  redirect(`/app/market/watchlists?w=${id}`);
}

export async function deleteWatchlistAction(form: FormData): Promise<void> {
  const id = uuid.safeParse(str(form, 'id'));
  if (!id.success) return;
  await asTenant(async (tx, s) => {
    assertCan(s.role, 'records.delete');
    await marketRepo.deleteWatchlist(tx, id.data);
  });
  revalidatePath('/app/market/watchlists');
  redirect('/app/market/watchlists');
}

export async function addToWatchlistAction(form: FormData): Promise<void> {
  const wid = uuid.safeParse(str(form, 'watchlistId'));
  const key = areaKey.safeParse(str(form, 'areaKey'));
  if (!wid.success || !key.success) return;
  await asTenant(async (tx, s) => {
    assertCan(s.role, 'records.write');
    const area = await marketSource(tx).getArea(key.data);
    if (!area) return;
    await marketRepo.addWatchlistItem(tx, { watchlistId: wid.data, areaKey: area.key, areaName: area.name });
  });
  revalidatePath('/app/market/watchlists');
  redirect(`/app/market/watchlists?w=${wid.data}`);
}

export async function removeWatchlistItemAction(form: FormData): Promise<void> {
  const id = uuid.safeParse(str(form, 'id'));
  if (!id.success) return;
  await asTenant(async (tx, s) => {
    assertCan(s.role, 'records.write');
    await marketRepo.removeWatchlistItem(tx, id.data);
  });
  revalidatePath('/app/market/watchlists');
}

export async function addAlertRuleAction(form: FormData): Promise<void> {
  const wid = uuid.safeParse(str(form, 'watchlistId'));
  if (!wid.success) return;
  const kind = str(form, 'kind');
  const n = (k: string) => Number(str(form, k));
  let rule: AlertRule;
  try {
    switch (kind) {
      case 'score_change': rule = validateAlertRule({ kind, minPoints: n('minPoints') }); break;
      case 'category_change': rule = validateAlertRule({ kind, category: str(form, 'category') as CategoryKey, minPoints: n('minPoints') }); break;
      case 'new_risk_flag': rule = validateAlertRule({ kind, minSeverity: (str(form, 'minSeverity') || 'caution') as 'info' | 'caution' | 'critical' }); break;
      case 'metric_threshold': rule = validateAlertRule({ kind, metric: str(form, 'metric'), op: str(form, 'op') === 'below' ? 'below' : 'above', value: n('value') }); break;
      case 'regulatory_change': rule = validateAlertRule({ kind }); break;
      case 'confidence_drop': rule = validateAlertRule({ kind, minDrop: n('minPoints') / 100 }); break;
      default: return;
    }
  } catch {
    return;
  }
  await asTenant(async (tx, s) => {
    assertCan(s.role, 'records.write');
    await marketRepo.createAlertRule(tx, wid.data, rule as { kind: string } & Record<string, unknown>);
  });
  revalidatePath('/app/market/watchlists');
}

export async function toggleAlertRuleAction(form: FormData): Promise<void> {
  const id = uuid.safeParse(str(form, 'id'));
  if (!id.success) return;
  await asTenant(async (tx, s) => {
    assertCan(s.role, 'records.write');
    await marketRepo.setAlertRuleEnabled(tx, id.data, str(form, 'enabled') === 'true');
  });
  revalidatePath('/app/market/watchlists');
}

export async function deleteAlertRuleAction(form: FormData): Promise<void> {
  const id = uuid.safeParse(str(form, 'id'));
  if (!id.success) return;
  await asTenant(async (tx, s) => {
    assertCan(s.role, 'records.write');
    await marketRepo.deleteAlertRule(tx, id.data);
  });
  revalidatePath('/app/market/watchlists');
}

export async function runMonitoringAction(form: FormData): Promise<void> {
  const wid = uuid.safeParse(str(form, 'watchlistId'));
  await asTenant(async (tx, s) => {
    assertCan(s.role, 'records.write');
    await runMonitoring(tx, wid.success ? wid.data : undefined);
  });
  revalidatePath('/app/market/watchlists');
}

export async function acknowledgeAlertAction(form: FormData): Promise<void> {
  const id = uuid.safeParse(str(form, 'id'));
  if (!id.success) return;
  await asTenant(async (tx, s) => {
    assertCan(s.role, 'records.write');
    await marketRepo.acknowledgeAlert(tx, id.data);
  });
  revalidatePath('/app/market/watchlists');
}

export async function createProfileAction(form: FormData): Promise<void> {
  const name = z.string().min(1).max(120).safeParse(str(form, 'name'));
  if (!name.success) return;
  const baseRaw = str(form, 'base');
  const base = (['balanced', ...INVESTMENT_STRATEGIES] as string[]).includes(baseRaw) ? baseRaw : 'balanced';
  const categoryWeights: Record<string, number> = {};
  for (const k of CATEGORY_KEYS) {
    const v = Number(str(form, `w_${k}`));
    if (str(form, `w_${k}`) !== '' && Number.isFinite(v)) categoryWeights[k] = v;
  }
  const variableEmphasis: Record<string, number> = {};
  for (const m of METRICS) {
    const raw = str(form, `e_${m.key}`);
    if (raw !== '' && Number(raw) !== 1 && Number.isFinite(Number(raw))) variableEmphasis[m.key] = Number(raw);
  }
  try {
    customProfile({ id: 'validate', label: name.data, base: base as 'balanced', categoryWeights, variableEmphasis });
  } catch {
    redirect('/app/market/profiles?error=weights');
  }
  let id: string;
  try {
    id = await asTenant(async (tx, s) => {
      assertCan(s.role, 'records.write');
      return marketRepo.createScoreProfile(tx, { name: name.data, baseProfile: base, categoryWeights, variableEmphasis });
    });
  } catch (e) {
    if ((e as { code?: string }).code === '23505') redirect('/app/market/profiles?error=name');
    fail(e, 'create_profile');
  }
  revalidatePath('/app/market');
  redirect(`/app/market?profile=custom:${id}`);
}

export async function deleteProfileAction(form: FormData): Promise<void> {
  const id = uuid.safeParse(str(form, 'id'));
  if (!id.success) return;
  await asTenant(async (tx, s) => {
    assertCan(s.role, 'records.delete');
    await marketRepo.deleteScoreProfile(tx, id.data);
  });
  revalidatePath('/app/market/profiles');
}
