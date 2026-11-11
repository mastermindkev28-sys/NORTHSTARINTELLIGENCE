import Link from 'next/link';
import { marketRepo } from '@northstar/db';
import { CATEGORY_KEYS, CATEGORY_LABELS, GEO_LEVEL_LABELS, PILOT_JURISDICTIONS, type GeoLevel } from '@northstar/market';
import { asTenant } from '@/lib/server/session';
import { areaHref, marketSource, resolveProfile, scoreMany, todayIso } from '@/lib/server/market';
import { env } from '@/lib/server/env';
import { PageHeader } from '@/components/page-header';
import { Badge, DemoBanner, EmptyState, Panel } from '@/components/ui';
import { CategoryCell, ConfidenceBadge, FlagCounts, MarketTabs, ProfileOptions, ScoreBar } from '@/components/market/parts';

export const metadata = { title: 'Market Intelligence' };

const LEVELS: GeoLevel[] = ['state', 'metro', 'zip'];
const SHORT: Record<string, string> = { growth: 'Growth', affordability: 'Afford.', regulatory: 'Reg.', rental_economics: 'Rental', public_safety: 'Safety', environmental_risk: 'Env. risk' };

type SP = Promise<{ level?: string; profile?: string; mode?: string; parent?: string }>;

export default async function MarketExplorer({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const level = (LEVELS as string[]).includes(sp.level ?? '') ? (sp.level as GeoLevel) : 'metro';
  const mode = sp.mode === 'relative' ? 'relative' : 'absolute';
  const asOf = todayIso();

  const data = await asTenant(async (tx) => {
    const src = marketSource(tx);
    const rp = await resolveProfile(tx, sp.profile);
    const custom = await marketRepo.listScoreProfiles(tx);
    const states = (await src.listAreas({ level: 'state' })).filter((a) => a.isDemo || env.marketDataSource === 'db');
    let areas = (await src.listAreas({ level })).filter((a) => !PILOT_JURISDICTIONS.some((p) => p.key === a.key) || env.marketDataSource === 'db');
    if (sp.parent) {
      const parentKey = sp.parent;
      const metros = level === 'zip' ? new Set((await src.listAreas({ level: 'metro', parentKey })).map((m) => m.key)) : null;
      areas = areas.filter((a) => a.parentKey === parentKey || (metros?.has(a.parentKey ?? '') ?? false));
    }
    const results = await scoreMany(src, areas, rp, asOf, mode);
    const pilots = env.marketDataSource === 'demo' ? await scoreMany(src, PILOT_JURISDICTIONS.filter((p) => p.level === 'city'), rp, asOf) : [];
    return { rp, custom, states, results, pilots };
  });

  const { rp, results } = data;
  const anyDemo = results.some((r) => r.score.isDemo);
  const withheld = results.filter((r) => r.score.overall === null).length;

  return (
    <>
      <PageHeader
        eyebrow="02 · Northstar Market Intelligence"
        title="Geographic investment analysis"
        description="Find overlooked markets where assets can be bought at reasonable prices with durable fundamentals. Every score shows its categories, variables, sources, dates and confidence. Material risks are listed beside the score, never averaged into it."
      />
      <MarketTabs active="explore" />
      {anyDemo && <div className="mb-5"><DemoBanner>Fictional demo geographies with illustrative values, not real statistics. Real pilot jurisdictions below use cited law only until official data connectors are live.</DemoBanner></div>}

      <form method="get" className="panel mb-6 flex flex-wrap items-end gap-4 px-5 py-4">
        <label className="flex flex-col gap-1.5 text-[12px] text-muted">Level
          <select name="level" defaultValue={level} className="h-9 rounded-md border border-line bg-obsidian px-2 text-[13px] text-titanium">
            {LEVELS.map((l) => <option key={l} value={l}>{GEO_LEVEL_LABELS[l]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] text-muted">Strategy / profile
          <select name="profile" defaultValue={rp.id} className="h-9 rounded-md border border-line bg-obsidian px-2 text-[13px] text-titanium"><ProfileOptions custom={data.custom} /></select>
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] text-muted">Within
          <select name="parent" defaultValue={sp.parent ?? ''} className="h-9 rounded-md border border-line bg-obsidian px-2 text-[13px] text-titanium">
            <option value="">All states</option>
            {data.states.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] text-muted">Normalization
          <select name="mode" defaultValue={mode} className="h-9 rounded-md border border-line bg-obsidian px-2 text-[13px] text-titanium">
            <option value="absolute">Absolute (fixed reference ranges)</option>
            <option value="relative">Relative (percentile in this set)</option>
          </select>
        </label>
        <button type="submit" className="h-9 rounded-md bg-signal px-3.5 text-sm font-medium text-white hover:bg-signal-deep">Apply</button>
        <div className="ml-auto text-right text-[11.5px] text-muted">
          <div>Valuation date <span className="num text-titanium">{asOf}</span></div>
          <div>{results.length} areas · {withheld} withheld for insufficient data</div>
        </div>
      </form>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Panel title={`${GEO_LEVEL_LABELS[level]} ranking · ${rp.profile.label}`} eyebrow={mode === 'relative' ? 'Percentile within comparison set' : 'Scored against fixed reference ranges'}>
          {results.length === 0 ? (
            <EmptyState title="No areas" body="No geographies match this filter. Load reference data with the market seed script or switch to the demo dataset." />
          ) : (
            <form method="get" action="/app/market/compare">
              <input type="hidden" name="profile" value={rp.id} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-[13px]">
                  <thead>
                    <tr className="text-left text-[11.5px] text-muted">
                      <th className="w-8 pb-2 font-normal"><span className="sr-only">Compare</span></th>
                      <th className="w-8 pb-2 font-normal">#</th>
                      <th className="pb-2 font-normal">Area</th>
                      <th className="pb-2 font-normal">Market Score</th>
                      <th className="pb-2 font-normal">Confidence</th>
                      {CATEGORY_KEYS.map((k) => <th key={k} className="pb-2 text-right font-normal" title={`${CATEGORY_LABELS[k]} · ${Math.round(results[0]!.score.categories.find((c) => c.key === k)!.weight * 100)}% weight`}>{SHORT[k]} <span className="num text-[10px] text-muted/60">{Math.round(results[0]!.score.categories.find((c) => c.key === k)!.weight * 100)}</span></th>)}
                      <th className="pb-2 pl-4 font-normal">Risk flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(({ score: s }, i) => (
                      <tr key={s.area.key} className="border-t border-line hover:bg-graphite-2/40">
                        <td className="py-2.5"><input type="checkbox" name="areas" value={s.area.key} aria-label={`Compare ${s.area.name}`} className="accent-[var(--color-signal)]" /></td>
                        <td className="num py-2.5 text-[12px] text-muted">{s.overall === null ? '—' : i + 1}</td>
                        <td className="py-2.5">
                          <Link href={areaHref(s.area.key, rp.id)} className="font-medium hover:text-signal">{s.area.name}</Link>
                          {s.area.isDemo && <span className="ml-2 align-middle"><Badge tone="caution">Demo</Badge></span>}
                        </td>
                        <td className="py-2.5">{s.overall === null ? <span className="text-[12px] text-muted">Insufficient data</span> : <ScoreBar score={s.overall} />}</td>
                        <td className="py-2.5"><ConfidenceBadge label={s.confidenceLabel} /></td>
                        {s.categories.map((c) => <td key={c.key} className="py-2.5 text-right"><CategoryCell score={c.score} /></td>)}
                        <td className="py-2.5 pl-4"><FlagCounts flags={s.flags} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between gap-4 border-t border-line pt-4">
                <p className="text-[12px] text-muted">Select two to four areas to compare side by side.</p>
                <button type="submit" className="h-8 rounded-md border border-line px-3 text-[12.5px] text-titanium hover:border-muted">Compare selected</button>
              </div>
            </form>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title={rp.profile.label} eyebrow="What this profile prioritizes">
            <p className="mb-3 text-[12.5px] text-muted">{rp.profile.description}</p>
            <ul className="mb-4 flex flex-col gap-1.5 text-[12.5px]">
              {rp.profile.priorities.map((p) => <li key={p} className="flex gap-2"><span className="text-signal">›</span>{p}</li>)}
            </ul>
            <dl className="flex flex-col gap-1.5 border-t border-line pt-3 text-[12px]">
              {CATEGORY_KEYS.map((k) => {
                const w = results[0]?.score.categories.find((c) => c.key === k)?.weight ?? 0;
                return (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <dt className="text-muted">{CATEGORY_LABELS[k]}</dt>
                    <dd className="num">{Math.round(w * 100)}%</dd>
                  </div>
                );
              })}
            </dl>
            <Link href="/app/market/profiles" className="mt-4 inline-block text-[12px] text-signal hover:underline">Customize weights →</Link>
          </Panel>
          <Panel title="How to read this" eyebrow="Method v0.1">
            <ul className="flex flex-col gap-2 text-[12px] leading-relaxed text-muted">
              <li><span className="text-titanium">Missing data never helps.</span> Gaps are filled at neutral-or-worse and lower confidence. Below 60% coverage a score is withheld.</li>
              <li><span className="text-titanium">Flags stand alone.</span> Flood, insurance, rent control and similar risks show even when the score is high.</li>
              <li><span className="text-titanium">No protected characteristics.</span> Demographic composition and proxies for it are excluded from every score.</li>
              <li><span className="text-titanium">Public safety is aggregate.</span> Area rates only, never attributed to a property, never for tenant screening.</li>
            </ul>
            <Link href="/app/market/sources" className="mt-3 inline-block text-[12px] text-signal hover:underline">Sources and methodology →</Link>
          </Panel>
        </div>
      </div>

      {data.pilots.length > 0 && (
        <Panel className="mt-6" title="Pilot jurisdictions · real, cited law" eyebrow="Metrics pending official data connectors">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead><tr className="text-left text-[11.5px] text-muted"><th className="pb-2 font-normal">Jurisdiction</th><th className="pb-2 font-normal">Landlord Regulatory Index</th><th className="pb-2 font-normal">Factor coverage</th><th className="pb-2 font-normal">Market Score</th><th className="pb-2 font-normal">Regulatory flags</th></tr></thead>
              <tbody>
                {data.pilots.map(({ score: s, regulatory: r }) => (
                  <tr key={s.area.key} className="border-t border-line">
                    <td className="py-2.5"><Link className="font-medium hover:text-signal" href={areaHref(s.area.key, rp.id)}>{s.area.name}</Link></td>
                    <td className="py-2.5">{r.index === null ? <span className="text-[12px] text-muted">Insufficient ({Math.round(r.indexProvisional)} provisional)</span> : <ScoreBar score={r.index} />}</td>
                    <td className="num py-2.5 text-[12px] text-muted">{Math.round(r.coverage * 100)}%</td>
                    <td className="py-2.5 text-[12px] text-muted">Withheld: metrics not yet connected</td>
                    <td className="py-2.5"><FlagCounts flags={r.flags} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11.5px] text-muted">Factor rows are transcribed from statutes, ordinances and city guides with effective dates. Not legal advice; counsel review is required before customer-facing use.</p>
        </Panel>
      )}
    </>
  );
}
