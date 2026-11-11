import 'server-only';
import { marketRepo, type Tx } from '@northstar/db';
import { evaluateRules, snapshotOf, validateAlertRule, type AlertRule, type MarketSnapshot } from '@northstar/market';
import { marketSource, resolveProfile, scoreOne, todayIso } from './market';

export interface MonitoringResult {
  checked: number;
  newAlerts: number;
  baselines: number;
}

/**
 * Evaluate every watchlist (or one) in the current tenant: score each area now, compare with its last snapshot, store
 * new alerts (idempotent by dedupe key) and the new snapshot.
 *
 * When an area has never been checked, the baseline is the same area scored one year earlier (prior data vintage), so
 * the first run already reports meaningful year-over-year changes instead of silently seeding.
 *
 * Runs on demand from the workspace today. The scheduled version is an Inngest function per organization calling this
 * same code inside withTenant with a system actor (docs/MARKET_INTELLIGENCE_ENGINE.md §Monitoring).
 */
export async function runMonitoring(tx: Tx, watchlistId?: string): Promise<MonitoringResult> {
  const src = marketSource(tx);
  const asOf = todayIso();
  const prior = new Date(Date.parse(asOf) - 365 * 86_400_000).toISOString().slice(0, 10);
  const lists = (await marketRepo.listWatchlists(tx)).filter((w) => !watchlistId || w.id === watchlistId);
  const out: MonitoringResult = { checked: 0, newAlerts: 0, baselines: 0 };
  for (const w of lists) {
    const rp = await resolveProfile(tx, w.profileId ? `custom:${w.profileId}` : w.strategy);
    const rules = (await marketRepo.listAlertRules(tx, w.id)).filter((r) => r.enabled).flatMap((r) => {
      try {
        return [validateAlertRule(r.rule as unknown as AlertRule)];
      } catch {
        return [];
      }
    });
    for (const item of await marketRepo.listWatchlistItems(tx, w.id)) {
      const area = await src.getArea(item.areaKey);
      if (!area) continue;
      const now = await scoreOne(src, area, rp, asOf);
      const curr = snapshotOf(now.score, now.regulatory);
      let prev = item.lastSnapshot as MarketSnapshot | null;
      if (!prev || prev.profileId !== curr.profileId) {
        const then = await scoreOne(src, area, rp, prior);
        prev = snapshotOf(then.score, then.regulatory);
        out.baselines++;
      }
      const alerts = evaluateRules(rules, prev, curr);
      out.newAlerts += await marketRepo.insertAlerts(tx, w.id, alerts);
      await marketRepo.saveItemSnapshot(tx, item.id, curr);
      out.checked++;
    }
  }
  return out;
}
