import Link from 'next/link';
import { can } from '@northstar/core';
import { marketRepo } from '@northstar/db';
import { CATEGORY_KEYS, CATEGORY_LABELS, INVESTMENT_STRATEGIES, METRICS, PROFILES, ruleLabel, type AlertRule, type MarketSnapshot } from '@northstar/market';
import { asTenant } from '@/lib/server/session';
import { areaHref, marketSource } from '@/lib/server/market';
import { acknowledgeAlertAction, addAlertRuleAction, addToWatchlistAction, createWatchlistAction, deleteAlertRuleAction, deleteWatchlistAction, removeWatchlistItemAction, runMonitoringAction, toggleAlertRuleAction } from '@/lib/actions/market';
import { PageHeader } from '@/components/page-header';
import { Badge, Button, EmptyState, Input, Panel, Select, cx } from '@/components/ui';
import { CategoryCell, MarketTabs, ScoreBar } from '@/components/market/parts';
import { dateTime } from '@/lib/format';

export const metadata = { title: 'Market monitoring' };

const SEV_TONE = { critical: 'critical', caution: 'caution', info: 'neutral' } as const;

export default async function Watchlists({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const sp = await searchParams;
  const data = await asTenant(async (tx, s) => {
    const lists = await marketRepo.listWatchlists(tx);
    const active = lists.find((l) => l.id === sp.w) ?? lists[0] ?? null;
    const items = active ? await marketRepo.listWatchlistItems(tx, active.id) : [];
    const rules = active ? await marketRepo.listAlertRules(tx, active.id) : [];
    const alerts = await marketRepo.listAlerts(tx, { limit: 60 });
    const metros = await marketSource(tx).listAreas({ level: 'metro' });
    const cities = await marketSource(tx).listAreas({ level: 'city' });
    return { lists, active, items, rules, alerts, areas: [...metros, ...cities], role: s.role };
  });
  const write = can(data.role, 'records.write');
  const del = can(data.role, 'records.delete');
  const { active } = data;

  return (
    <>
      <PageHeader eyebrow="02 · Market Intelligence" title="Monitoring and alerts" description="Watch markets for score changes, new risk flags, regulatory changes, metric thresholds and falling data confidence. Every alert carries its evidence: variable, old and new value, source and date." />
      <MarketTabs active="watchlists" />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="flex flex-col gap-4">
          <Panel eyebrow="Watchlists" title={`${data.lists.length} list${data.lists.length === 1 ? '' : 's'}`}>
            <ul className="-mx-2 flex flex-col gap-0.5">
              {data.lists.map((l) => (
                <li key={l.id}>
                  <Link href={`/app/market/watchlists?w=${l.id}`} className={cx('flex items-center justify-between rounded-md px-2 py-1.5 text-[13px]', active?.id === l.id ? 'bg-graphite-2 text-titanium' : 'text-muted hover:text-titanium')}>
                    <span className="truncate">{l.name}</span>
                    <span className="flex items-center gap-1">
                      <span className="num text-[11px] text-muted">{l.itemCount}</span>
                      {l.openAlerts > 0 && <Badge tone="caution">{l.openAlerts}</Badge>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {write && (
              <form action={createWatchlistAction} className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
                <Input name="name" placeholder="New watchlist name" required maxLength={120} aria-label="Watchlist name" />
                <Select name="strategy" defaultValue="" aria-label="Strategy">
                  <option value="">Balanced profile</option>
                  {INVESTMENT_STRATEGIES.map((s) => <option key={s} value={s}>{PROFILES[s].label}</option>)}
                </Select>
                <Button type="submit" variant="secondary">Create watchlist</Button>
              </form>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          {!active ? (
            <Panel><EmptyState title="No watchlists yet" body="Create a watchlist, add markets from the Explore view or an area profile, then run monitoring. Default rules alert on score moves of 5+ points, new caution or critical flags, regulatory changes and confidence drops." /></Panel>
          ) : (
            <>
              <Panel
                eyebrow={`Profile: ${active.strategy ? PROFILES[active.strategy as keyof typeof PROFILES]?.label ?? active.strategy : 'Balanced'}`}
                title={active.name}
                actions={
                  <div className="flex items-center gap-2">
                    {write && <form action={runMonitoringAction}><input type="hidden" name="watchlistId" value={active.id} /><Button type="submit">Run monitoring now</Button></form>}
                    {del && <form action={deleteWatchlistAction}><input type="hidden" name="id" value={active.id} /><Button type="submit" variant="ghost">Delete</Button></form>}
                  </div>
                }
              >
                {data.items.length === 0 ? (
                  <p className="text-[13px] text-muted">No areas yet. Add one below or use Monitor on any area profile.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-[13px]">
                      <thead><tr className="text-left text-[11.5px] text-muted"><th className="pb-2 font-normal">Area</th><th className="pb-2 font-normal">Last score</th>{CATEGORY_KEYS.map((k) => <th key={k} className="pb-2 text-right font-normal" title={CATEGORY_LABELS[k]}>{k.split('_')[0]!.slice(0, 6)}</th>)}<th className="pb-2 pl-4 font-normal">Last checked</th><th /></tr></thead>
                      <tbody>
                        {data.items.map((it) => {
                          const snap = it.lastSnapshot as MarketSnapshot | null;
                          return (
                            <tr key={it.id} className="border-t border-line">
                              <td className="py-2.5"><Link href={areaHref(it.areaKey)} className="hover:text-signal">{it.areaName}</Link></td>
                              <td className="py-2.5">{snap ? (snap.overall === null ? <span className="text-[12px] text-muted">Insufficient</span> : <ScoreBar score={snap.overall} size="sm" />) : <span className="text-[12px] text-muted">Not checked</span>}</td>
                              {CATEGORY_KEYS.map((k) => <td key={k} className="py-2.5 text-right">{snap ? <CategoryCell score={snap.categories[k] ?? null} /> : <span className="text-muted/50">·</span>}</td>)}
                              <td className="py-2.5 pl-4 text-[12px] text-muted">{it.lastCheckedAt ? dateTime(it.lastCheckedAt) : '—'}</td>
                              <td className="py-2.5 text-right">{write && <form action={removeWatchlistItemAction}><input type="hidden" name="id" value={it.id} /><button type="submit" className="text-[11.5px] text-muted hover:text-critical">Remove</button></form>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {write && (
                  <form action={addToWatchlistAction} className="mt-4 flex gap-2 border-t border-line pt-4">
                    <input type="hidden" name="watchlistId" value={active.id} />
                    <Select name="areaKey" aria-label="Area to add" className="max-w-xs">
                      {data.areas.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
                    </Select>
                    <Button type="submit" variant="secondary">Add area</Button>
                  </form>
                )}
              </Panel>

              <Panel eyebrow="Alert rules" title={`${data.rules.filter((r) => r.enabled).length} active`}>
                <ul className="flex flex-col divide-y divide-line">
                  {data.rules.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                      <span className={r.enabled ? '' : 'text-muted line-through'}>{ruleLabel(r.rule as unknown as AlertRule)}</span>
                      {write && (
                        <span className="flex gap-3">
                          <form action={toggleAlertRuleAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="enabled" value={String(!r.enabled)} /><button className="text-[11.5px] text-muted hover:text-titanium" type="submit">{r.enabled ? 'Pause' : 'Enable'}</button></form>
                          <form action={deleteAlertRuleAction}><input type="hidden" name="id" value={r.id} /><button className="text-[11.5px] text-muted hover:text-critical" type="submit">Delete</button></form>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {write && (
                  <form action={addAlertRuleAction} className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-[180px_1fr_1fr_90px_auto]">
                    <input type="hidden" name="watchlistId" value={active.id} />
                    <Select name="kind" aria-label="Rule type" defaultValue="metric_threshold">
                      <option value="score_change">Score moves ≥ N pts</option>
                      <option value="category_change">Category moves ≥ N pts</option>
                      <option value="metric_threshold">Metric crosses value</option>
                      <option value="new_risk_flag">New risk flag</option>
                      <option value="regulatory_change">Regulatory change</option>
                      <option value="confidence_drop">Confidence drops ≥ N pts</option>
                    </Select>
                    <Select name="metric" aria-label="Metric (for threshold)">
                      {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </Select>
                    <div className="flex gap-2">
                      <Select name="op" aria-label="Direction"><option value="above">above</option><option value="below">below</option></Select>
                      <Select name="category" aria-label="Category">{CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}</Select>
                    </div>
                    <div className="flex gap-2">
                      <Input name="value" type="number" step="any" placeholder="value" aria-label="Threshold value" />
                      <Input name="minPoints" type="number" step="any" placeholder="N" defaultValue={5} aria-label="Points" />
                    </div>
                    <Button type="submit" variant="secondary">Add rule</Button>
                  </form>
                )}
              </Panel>
            </>
          )}

          <Panel eyebrow="All watchlists" title="Alerts">
            {data.alerts.length === 0 ? (
              <p className="text-[13px] text-muted">No alerts yet. Run monitoring to evaluate your watchlists. The first run compares each area with the prior data vintage.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {data.alerts.map((a) => {
                  const ev = a.evidence as { variable?: string; oldValue?: unknown; newValue?: unknown; source?: string; asOf?: string; previousAsOf?: string };
                  return (
                    <li key={a.id} className={cx('flex gap-3 py-3', a.acknowledgedAt && 'opacity-55')}>
                      <Badge tone={SEV_TONE[a.severity]} className="mt-0.5 shrink-0">{a.severity}</Badge>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium">{a.title} <span className="font-normal text-muted">· <Link href={areaHref(a.areaKey)} className="hover:text-signal">{a.areaName}</Link></span></div>
                        <div className="text-[12px] text-muted">{a.detail}</div>
                        <div className="num mt-1 text-[11px] text-muted/80">
                          {ev.variable} {ev.oldValue !== undefined && ev.oldValue !== null ? `${String(ev.oldValue)} → ` : ''}{String(ev.newValue ?? '')}{ev.source ? ` · ${ev.source}` : ''} · as of {ev.asOf}{ev.previousAsOf ? ` vs ${ev.previousAsOf}` : ''}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-[11px] text-muted">
                        {dateTime(a.createdAt)}
                        {!a.acknowledgedAt && write && <form action={acknowledgeAlertAction} className="mt-1"><input type="hidden" name="id" value={a.id} /><button type="submit" className="text-signal hover:underline">Acknowledge</button></form>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
