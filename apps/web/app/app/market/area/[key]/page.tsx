import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can } from '@northstar/core';
import { marketRepo } from '@northstar/db';
import { GEO_LEVEL_LABELS, getMetric, hasMetric, measuredAtLabel, summarizeTrend } from '@northstar/market';
import { asTenant } from '@/lib/server/session';
import { areaHref, marketSource, parseAreaKey, resolveProfile, scoreMany, scoreOne, todayIso } from '@/lib/server/market';
import { addToWatchlistAction } from '@/lib/actions/market';
import { PageHeader } from '@/components/page-header';
import { Badge, DemoBanner, Panel, Stat } from '@/components/ui';
import { CategoryCell, ConfidenceBadge, FlagCounts, FlagList, ProfileOptions, ScoreBar, Sparkline, VerificationBadge, formatMetric } from '@/components/market/parts';

export const metadata = { title: 'Market profile' };

export default async function AreaProfile({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ profile?: string }> }) {
  const key = parseAreaKey((await params).key);
  if (!key) notFound();
  const sp = await searchParams;
  const asOf = todayIso();

  const data = await asTenant(async (tx, s) => {
    const src = marketSource(tx);
    const area = await src.getArea(key);
    if (!area) return null;
    const rp = await resolveProfile(tx, sp.profile);
    const main = await scoreOne(src, area, rp, asOf);
    const parent = area.parentKey ? await src.getArea(area.parentKey) : null;
    const children = await src.listAreas({ parentKey: area.key });
    const childScores = children.length ? await scoreMany(src, children, rp, asOf) : [];
    return { area, rp, main, parent, childScores, custom: await marketRepo.listScoreProfiles(tx), watchlists: await marketRepo.listWatchlists(tx), role: s.role };
  });
  if (!data) notFound();
  const { area, rp, main, parent } = data;
  const s = main.score;
  const reg = main.regulatory;
  const material = s.flags.filter((f) => f.category !== 'data_quality');
  const quality = s.flags.filter((f) => f.category === 'data_quality');

  const metricsWithHistory = [...new Set(main.observations.map((o) => o.metric))].filter(hasMetric).map((m) => summarizeTrend(m, main.observations)).filter((t) => t.points.length >= 2 && (t.hasProjection || (t.change !== null && t.change !== 0)));

  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-[12px] text-muted">
        <Link href="/app/market" className="hover:text-titanium">Market Intelligence</Link>
        {parent && <><span>/</span><Link href={areaHref(parent.key, rp.id)} className="hover:text-titanium">{parent.name}</Link></>}
      </div>
      <PageHeader
        eyebrow={`${GEO_LEVEL_LABELS[area.level]} profile${area.isDemo ? ' · demo' : ''}`}
        title={area.name}
        description={`Scored ${asOf} with the ${rp.profile.label} profile · methodology ${s.methodologyVersion}`}
        actions={
          <form method="get" className="flex items-end gap-2">
            <select name="profile" defaultValue={rp.id} aria-label="Profile" className="h-9 rounded-md border border-line bg-obsidian px-2 text-[13px]"><ProfileOptions custom={data.custom} /></select>
            <button type="submit" className="h-9 rounded-md border border-line px-3 text-[13px] hover:border-muted">Rescore</button>
          </form>
        }
      />
      {s.isDemo && <div className="mb-5"><DemoBanner>Fictional geography with illustrative values. Not real statistics.</DemoBanner></div>}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Panel eyebrow="Northstar Market Score" title={rp.profile.label}>
          {s.overall === null ? (
            <div>
              <div className="num text-[40px] leading-none text-muted">—</div>
              <p className="mt-3 text-[13px] text-titanium">Insufficient data</p>
              <p className="mt-1 text-[12px] text-muted">Only {Math.round(s.coverage * 100)}% of weighted inputs have data. A score is withheld below 60% rather than guessed. Provisional value {s.overallProvisional} (gaps at neutral-or-worse).</p>
            </div>
          ) : <ScoreBar score={s.overall} size="lg" />}
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
            <Stat label="Confidence" value={<ConfidenceBadge label={s.confidenceLabel} value={s.confidence} />} />
            <Stat label="Data coverage" value={`${Math.round(s.coverage * 100)}%`} />
          </div>
          <dl className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-[12.5px]">
            {s.categories.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3">
                <dt className="text-muted">{c.label} <span className="num text-[10.5px] text-muted/60">{Math.round(c.weight * 100)}%</span></dt>
                <dd><ScoreBar score={c.score} provisional={c.scoreProvisional} size="sm" /></dd>
              </div>
            ))}
          </dl>
          {can(data.role, 'records.write') && data.watchlists.length > 0 && (
            <form action={addToWatchlistAction} className="mt-5 flex gap-2 border-t border-line pt-4">
              <input type="hidden" name="areaKey" value={area.key} />
              <select name="watchlistId" aria-label="Watchlist" className="h-8 min-w-0 flex-1 rounded-md border border-line bg-obsidian px-2 text-[12.5px]">
                {data.watchlists.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <button type="submit" className="h-8 rounded-md bg-signal px-3 text-[12.5px] font-medium text-white hover:bg-signal-deep">Monitor</button>
            </form>
          )}
          {can(data.role, 'records.write') && data.watchlists.length === 0 && (
            <Link href="/app/market/watchlists" className="mt-5 block border-t border-line pt-4 text-[12.5px] text-signal hover:underline">Create a watchlist to monitor this area →</Link>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel eyebrow="Shown regardless of score" title="Material risk flags" actions={<FlagCounts flags={material} />}>
            <FlagList flags={material} />
          </Panel>
          {quality.length > 0 && (
            <Panel eyebrow="Confidence notes" title="Data quality">
              <FlagList flags={quality} />
            </Panel>
          )}
        </div>
      </div>

      <h2 className="mb-3 mt-10 text-[15px] font-semibold">Category detail</h2>
      <div className="grid gap-6 xl:grid-cols-2">
        {s.categories.map((c) => (
          <Panel
            key={c.key}
            eyebrow={`${Math.round(c.weight * 100)}% of score · coverage ${Math.round(c.coverage * 100)}% · confidence ${Math.round(c.confidence * 100)}%`}
            title={c.label}
            actions={c.sufficient ? <ScoreBar score={c.score} /> : <Badge>Insufficient data</Badge>}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-[12.5px]">
                <thead><tr className="text-left text-[11px] text-muted"><th className="pb-2 font-normal">Variable</th><th className="pb-2 pl-3 text-right font-normal">Value</th><th className="w-14 pb-2 pl-3 text-right font-normal">Score</th><th className="w-10 pb-2 pl-3 text-right font-normal">Wt</th><th className="pb-2 pl-3 font-normal">Period · source · level</th></tr></thead>
                <tbody>
                  {c.variables.map((v) => (
                    <tr key={v.metric} className="border-t border-line align-top">
                      <td className="py-2" title={getMetric(v.metric).description}>{v.label}</td>
                      <td className="num whitespace-nowrap py-2 pl-3 text-right">{formatMetric(v.value, v.unit)}</td>
                      <td className="py-2 pl-3 text-right">{v.status === 'missing' ? <span className="num text-[11.5px] text-muted/70" title="Missing: imputed at neutral-or-worse">({Math.round(v.score)})</span> : <CategoryCell score={v.score} />}</td>
                      <td className="num py-2 pl-3 text-right text-muted">{v.weight.toFixed(1)}</td>
                      <td className="py-2 pl-3 text-[11.5px] text-muted">
                        {v.status === 'missing' ? <span className="text-caution">No data · lowers confidence</span> : (
                          <>
                            <span className="text-titanium/80">{v.period}</span> · {v.source?.url ? <a href={v.source.url} target="_blank" rel="noreferrer" className="hover:text-signal">{v.source.name}</a> : v.source?.name} · {measuredAtLabel(v)}
                            {v.stale && <Badge tone="caution" className="ml-1">stale</Badge>}
                            {v.reportingCoverage !== null && v.reportingCoverage < 0.9 && <span className="ml-1 text-caution">coverage {Math.round(v.reportingCoverage * 100)}%</span>}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {c.key === 'public_safety' && <p className="mt-3 text-[11.5px] text-muted">Aggregate area rates for investment-location research. Not attributed to any property and not for tenant screening or housing decisions.</p>}
            {c.key === 'environmental_risk' && <p className="mt-3 text-[11.5px] text-muted">Generalized hazard indicators. Not a substitute for an insurance quote, flood determination or inspection.</p>}
          </Panel>
        ))}
      </div>

      <Panel className="mt-6" eyebrow={`Landlord Regulatory Index · coverage ${Math.round(reg.coverage * 100)}%`} title={reg.index === null ? 'Regulatory index withheld (insufficient cited factors)' : `Regulatory index ${reg.index}`} actions={<Link href={`/app/market/regulatory?j=${encodeURIComponent(reg.jurisdictions[reg.jurisdictions.length - 1] ?? '')}`} className="text-[12px] text-signal hover:underline">Adjust factor weights →</Link>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-[12.5px]">
            <thead><tr className="text-left text-[11px] text-muted"><th className="pb-2 font-normal">Factor</th><th className="pb-2 font-normal">Rule in force</th><th className="pb-2 text-right font-normal">Score</th><th className="pb-2 pl-3 font-normal">Jurisdiction · citation</th><th className="pb-2 font-normal">Effective</th><th className="pb-2 font-normal">Status</th></tr></thead>
            <tbody>
              {reg.factors.map((f) => (
                <tr key={f.key} className="border-t border-line align-top">
                  <td className="py-2" title={f.rule}>{f.label}</td>
                  <td className="py-2">{f.status === 'missing' ? <span className="text-muted">No cited source yet</span> : f.display}{f.preemptedByState && <span className="ml-1 text-[11px] text-muted">(local rule preempted)</span>}</td>
                  <td className="py-2 text-right">{f.status === 'missing' ? <span className="num text-[11.5px] text-muted/70">({Math.round(f.score)})</span> : <CategoryCell score={f.score} />}</td>
                  <td className="py-2 pl-3 text-[11.5px] text-muted">{f.row ? <>{f.row.jurisdictionName} · {f.row.citation.url ? <a className="hover:text-signal" href={f.row.citation.url} target="_blank" rel="noreferrer">{f.row.citation.title}</a> : f.row.citation.title}{f.row.citation.section ? `, ${f.row.citation.section}` : ''}</> : '—'}</td>
                  <td className="num py-2 text-[11.5px] text-muted">{f.row?.effectiveDate ?? '—'}</td>
                  <td className="py-2">{f.row ? <VerificationBadge v={f.row.verification} /> : <Badge>missing</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {reg.pending.length > 0 && (
          <div className="mt-4 rounded-md border border-caution/30 bg-caution/5 p-3 text-[12.5px]">
            <div className="mb-1 font-medium text-caution">Scheduled changes</div>
            <ul className="flex flex-col gap-1">{reg.pending.map((p) => <li key={`${p.factor}${p.effectiveDate}`}>{p.jurisdictionName}: {p.label} → {p.value}, effective <span className="num">{p.effectiveDate}</span></li>)}</ul>
          </div>
        )}
        <p className="mt-3 text-[11.5px] text-muted">Not legal advice. Factors are individually cited; scores follow the published rule shown on hover.</p>
      </Panel>

      {metricsWithHistory.length > 0 && (
        <Panel className="mt-6" eyebrow="Historical data and projections are kept separate" title="Trends">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead><tr className="text-left text-[11px] text-muted"><th className="pb-2 font-normal">Variable</th><th className="pb-2 font-normal">History</th><th className="pb-2 text-right font-normal">Latest</th><th className="pb-2 text-right font-normal">Change</th><th className="pb-2 pl-4 font-normal">Projection (not scored)</th></tr></thead>
              <tbody>
                {metricsWithHistory.map((t) => {
                  const def = getMetric(t.metric);
                  const proj = t.points.filter((p) => p.isProjection);
                  return (
                    <tr key={t.metric} className="border-t border-line">
                      <td className="py-2">{def.label}</td>
                      <td className="py-2"><Sparkline points={t.points} /></td>
                      <td className="num py-2 text-right">{formatMetric(t.latest, def.unit)} <span className="text-[10.5px] text-muted">{t.latestPeriod}</span></td>
                      <td className={`num py-2 text-right ${t.direction === 'rising' ? 'text-titanium' : 'text-muted'}`}>{t.change === null ? '—' : `${t.change > 0 ? '+' : ''}${formatMetric(t.change, def.unit)}`}</td>
                      <td className="py-2 pl-4 text-[11.5px] text-muted">{proj.length ? proj.map((p) => `${formatMetric(p.value, def.unit)} (${p.period})`).join(', ') : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {data.childScores.length > 0 && (
        <Panel className="mt-6" eyebrow={`${data.childScores.length} areas`} title={`Inside ${area.name}`}>
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-[11.5px] text-muted"><th className="pb-2 font-normal">Area</th><th className="pb-2 font-normal">Score</th><th className="pb-2 font-normal">Confidence</th><th className="pb-2 font-normal">Flags</th></tr></thead>
            <tbody>
              {data.childScores.map(({ score: c }) => (
                <tr key={c.area.key} className="border-t border-line">
                  <td className="py-2"><Link href={areaHref(c.area.key, rp.id)} className="hover:text-signal">{c.area.name}</Link></td>
                  <td className="py-2">{c.overall === null ? <span className="text-[12px] text-muted">Insufficient data</span> : <ScoreBar score={c.overall} />}</td>
                  <td className="py-2"><ConfidenceBadge label={c.confidenceLabel} /></td>
                  <td className="py-2"><FlagCounts flags={c.flags} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}
