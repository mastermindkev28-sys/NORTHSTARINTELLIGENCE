import Link from 'next/link';
import { marketRepo } from '@northstar/db';
import { CATEGORY_KEYS, CATEGORY_LABELS, GEO_LEVEL_LABELS, PILOT_JURISDICTIONS, type GeoLevel } from '@northstar/market';
import { asTenant } from '@/lib/server/session';
import { areaHref, marketSource, resolveProfile, scoreMany, todayIso } from '@/lib/server/market';
import { env } from '@/lib/server/env';
import { MetaItem, PageHeader } from '@/components/page-header';
import { Badge, Button, DemoBanner, EmptyState, Meter, Panel, ScoreRing, selectClass } from '@/components/ui';
import { CategoryCell, ConfidenceBadge, FlagCounts, MarketTabs, ProfileOptions, ScoreBar, scoreTone } from '@/components/market/parts';
import { IconArrowRight, IconArrowUpRight, IconCompare, IconSliders } from '@/components/icons';

export const metadata = { title: 'Market Intelligence' };

const LEVELS: GeoLevel[] = ['state', 'metro', 'zip'];
const SHORT: Record<string, string> = { growth: 'Growth', affordability: 'Afford.', regulatory: 'Reg.', rental_economics: 'Rental', public_safety: 'Safety', environmental_risk: 'Env. risk' };

const TINY: Record<string, string> = { growth: 'Grow', affordability: 'Price', regulatory: 'Reg', rental_economics: 'Rent', public_safety: 'Safe', environmental_risk: 'Risk' };

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

  const leaders = results.filter((r) => r.score.overall !== null).slice(0, 3);
  const weights = CATEGORY_KEYS.map((k) => ({ k, w: results[0]?.score.categories.find((c) => c.key === k)?.weight ?? 0 }));
  const maxW = Math.max(...weights.map((x) => x.w), 0.01);

  return (
    <>
      <PageHeader
        eyebrow="02 · Northstar Market Intelligence"
        title="Geographic investment analysis"
        description="Find overlooked markets where assets can be bought at reasonable prices with durable fundamentals. Every score shows its categories, variables, sources, dates and confidence. Material risks are listed beside the score, never averaged into it."
        meta={<><MetaItem label="Valuation date">{asOf}</MetaItem><MetaItem label="Areas">{results.length}</MetaItem><MetaItem label="Withheld">{withheld}</MetaItem><MetaItem label="Method">v0.1</MetaItem></>}
      />
      <MarketTabs active="explore" />
      {anyDemo && <div className="mb-5"><DemoBanner>Fictional demo geographies with illustrative values, not real statistics. Real pilot jurisdictions below use cited law only until official data connectors are live.</DemoBanner></div>}

      <form method="get" className="panel mb-6 flex flex-wrap items-end gap-3 px-4 py-3.5">
        <div className="mr-1 hidden items-center gap-2 self-center pr-3 text-faint lg:flex"><IconSliders size={15} /><span className="eyebrow">Lens</span></div>
        <label className="flex flex-col gap-1.5 text-[11px] text-muted">Level
          <select name="level" defaultValue={level} className={`${selectClass} w-36`}>
            {LEVELS.map((l) => <option key={l} value={l}>{GEO_LEVEL_LABELS[l]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[11px] text-muted">Strategy / profile
          <select name="profile" defaultValue={rp.id} className={`${selectClass} w-48`}><ProfileOptions custom={data.custom} /></select>
        </label>
        <label className="flex flex-col gap-1.5 text-[11px] text-muted">Within
          <select name="parent" defaultValue={sp.parent ?? ''} className={`${selectClass} w-44`}>
            <option value="">All states</option>
            {data.states.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[11px] text-muted">Normalization
          <select name="mode" defaultValue={mode} className={`${selectClass} w-64`}>
            <option value="absolute">Absolute (fixed reference ranges)</option>
            <option value="relative">Relative (percentile in this set)</option>
          </select>
        </label>
        <Button type="submit">Apply</Button>
      </form>

      {leaders.length > 0 && (
        <div className="stagger mb-6 grid gap-4 md:grid-cols-3">
          {leaders.map(({ score: s }, i) => (
            <Link key={s.area.key} href={areaHref(s.area.key, rp.id)} className={`panel group flex flex-col gap-4 p-5 transition-all hover:-translate-y-0.5 ${i === 0 ? 'panel-accent glow-signal' : 'hover:border-line-strong'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="eyebrow mb-1.5 flex items-center gap-2"><span className="text-signal">#{i + 1}</span>{GEO_LEVEL_LABELS[level]}</div>
                  <div className="truncate text-[16px] font-semibold tracking-[-0.01em] text-arctic group-hover:text-signal-bright">{s.area.name}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <ConfidenceBadge label={s.confidenceLabel} />
                    {s.area.isDemo && <Badge tone="caution">Demo</Badge>}
                  </div>
                </div>
                <ScoreRing score={s.overall} size={68} stroke={5} sublabel="score" />
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {s.categories.map((c) => (
                  <div key={c.key} className="flex flex-col items-center gap-1.5" title={`${CATEGORY_LABELS[c.key]}: ${c.score === null ? 'n/a' : Math.round(c.score)}`}>
                    <div className="relative h-10 w-full overflow-hidden rounded-[4px] bg-graphite-3/60">
                      <div className="absolute inset-x-0 bottom-0 rounded-[4px]" style={{ height: `${c.score ?? 0}%`, background: `linear-gradient(180deg, var(--color-${c.score === null ? 'muted' : scoreTone(c.score) === 'neutral' ? 'muted' : scoreTone(c.score)}), transparent)`, opacity: 0.75 }} />
                    </div>
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.06em] text-faint">{TINY[c.key]}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-line/70 pt-3 text-[11.5px]">
                <FlagCounts flags={s.flags} />
                <span className="inline-flex items-center gap-1 text-faint group-hover:text-signal">Open profile <IconArrowUpRight size={12} /></span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel flush accent code="02" title={`${GEO_LEVEL_LABELS[level]} ranking · ${rp.profile.label}`} eyebrow={mode === 'relative' ? 'Percentile within comparison set' : 'Scored against fixed reference ranges'}>
          {results.length === 0 ? (
            <EmptyState title="No areas" body="No geographies match this filter. Load reference data with the market seed script or switch to the demo dataset." />
          ) : (
            <form method="get" action="/app/market/compare">
              <input type="hidden" name="profile" value={rp.id} />
              <div className="overflow-x-auto">
                <table className="data-table min-w-[960px] text-[13px]">
                  <thead>
                    <tr className="text-left">
                      <th className="w-8"><span className="sr-only">Compare</span></th>
                      <th className="w-8">#</th>
                      <th>Area</th>
                      <th>Market Score</th>
                      <th>Confidence</th>
                      {CATEGORY_KEYS.map((k) => <th key={k} className="text-center" title={`${CATEGORY_LABELS[k]} · ${Math.round(results[0]!.score.categories.find((c) => c.key === k)!.weight * 100)}% weight`}>{SHORT[k]} <span className="text-signal/70">{Math.round(results[0]!.score.categories.find((c) => c.key === k)!.weight * 100)}</span></th>)}
                      <th>Risk flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(({ score: s }, i) => (
                      <tr key={s.area.key}>
                        <td><input type="checkbox" name="areas" value={s.area.key} aria-label={`Compare ${s.area.name}`} className="size-3.5 accent-[var(--color-signal)]" /></td>
                        <td className="num text-[11.5px] text-faint">{s.overall === null ? '—' : String(i + 1).padStart(2, '0')}</td>
                        <td>
                          <Link href={areaHref(s.area.key, rp.id)} className="whitespace-nowrap font-medium text-titanium transition-colors hover:text-signal-bright">{s.area.name}</Link>
                          {s.area.isDemo && <span className="ml-2 align-middle"><Badge tone="caution">Demo</Badge></span>}
                        </td>
                        <td>{s.overall === null ? <span className="text-[12px] text-muted">Insufficient data</span> : <ScoreBar score={s.overall} />}</td>
                        <td><ConfidenceBadge label={s.confidenceLabel} /></td>
                        {s.categories.map((c) => <td key={c.key} className="text-center"><CategoryCell score={c.score} /></td>)}
                        <td><FlagCounts flags={s.flags} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mx-5 mt-2 flex items-center justify-between gap-4 border-t border-line pt-3 pb-1">
                <p className="text-[12px] text-muted">Select two to four areas to compare side by side.</p>
                <Button type="submit" variant="secondary" className="h-8 text-[12.5px]"><IconCompare size={13} />Compare selected</Button>
              </div>
            </form>
          )}
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2 2xl:flex 2xl:flex-col">
          <Panel title={rp.profile.label} eyebrow="What this profile prioritizes">
            <p className="mb-3 text-[12.5px] leading-relaxed text-muted">{rp.profile.description}</p>
            <ul className="mb-4 flex flex-col gap-1.5 text-[12.5px]">
              {rp.profile.priorities.map((p) => <li key={p} className="flex gap-2"><span className="text-signal">›</span>{p}</li>)}
            </ul>
            <dl className="flex flex-col gap-2.5 border-t border-line pt-4 text-[12px]">
              {weights.map(({ k, w }) => (
                <div key={k}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <dt className="text-muted">{CATEGORY_LABELS[k]}</dt>
                    <dd className="num text-titanium">{Math.round(w * 100)}%</dd>
                  </div>
                  <Meter value={w} max={maxW} />
                </div>
              ))}
            </dl>
            <Link href="/app/market/profiles" className="mt-4 inline-flex items-center gap-1 text-[12px] text-signal hover:text-signal-bright">Customize weights <IconArrowRight size={12} /></Link>
          </Panel>
          <Panel title="How to read this" eyebrow="Method v0.1">
            <ul className="flex flex-col gap-3 text-[12px] leading-relaxed text-muted">
              <li className="border-l-2 border-signal/50 pl-3"><span className="text-titanium">Missing data never helps.</span> Gaps are filled at neutral-or-worse and lower confidence. Below 60% coverage a score is withheld.</li>
              <li className="border-l-2 border-caution/50 pl-3"><span className="text-titanium">Flags stand alone.</span> Flood, insurance, rent control and similar risks show even when the score is high.</li>
              <li className="border-l-2 border-positive/50 pl-3"><span className="text-titanium">No protected characteristics.</span> Demographic composition and proxies for it are excluded from every score.</li>
              <li className="border-l-2 border-violet/50 pl-3"><span className="text-titanium">Public safety is aggregate.</span> Area rates only, never attributed to a property, never for tenant screening.</li>
            </ul>
            <Link href="/app/market/sources" className="mt-4 inline-flex items-center gap-1 text-[12px] text-signal hover:text-signal-bright">Sources and methodology <IconArrowRight size={12} /></Link>
          </Panel>
        </div>
      </div>

      {data.pilots.length > 0 && (
        <Panel flush className="mt-6" title="Pilot jurisdictions · real, cited law" eyebrow="Metrics pending official data connectors">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[640px] text-[13px]">
              <thead><tr className="text-left"><th>Jurisdiction</th><th>Landlord Regulatory Index</th><th>Factor coverage</th><th>Market Score</th><th>Regulatory flags</th></tr></thead>
              <tbody>
                {data.pilots.map(({ score: s, regulatory: r }) => (
                  <tr key={s.area.key}>
                    <td><Link className="font-medium hover:text-signal-bright" href={areaHref(s.area.key, rp.id)}>{s.area.name}</Link></td>
                    <td>{r.index === null ? <span className="text-[12px] text-muted">Insufficient ({Math.round(r.indexProvisional)} provisional)</span> : <ScoreBar score={r.index} />}</td>
                    <td><div className="flex items-center gap-2.5"><span className="num w-9 text-[12px] text-titanium">{Math.round(r.coverage * 100)}%</span><Meter value={r.coverage * 100} tone={r.coverage >= 0.6 ? 'positive' : 'caution'} className="w-20" /></div></td>
                    <td className="text-[12px] text-muted">Withheld: metrics not yet connected</td>
                    <td><FlagCounts flags={r.flags} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mx-5 mt-2 border-t border-line pt-3 text-[11.5px] text-faint">Factor rows are transcribed from statutes, ordinances and city guides with effective dates. Not legal advice; counsel review is required before customer-facing use.</p>
        </Panel>
      )}
    </>
  );
}
