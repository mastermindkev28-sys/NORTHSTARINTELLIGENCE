import { REGULATORY_FACTORS, computeRegulatoryIndex, jurisdictionStack, type GeoArea } from '@northstar/market';
import { asTenant } from '@/lib/server/session';
import { marketSource, parseAreaKey, todayIso } from '@/lib/server/market';
import { MetaItem, PageHeader } from '@/components/page-header';
import { Badge, Button, DemoBanner, Meter, Panel, ScoreRing, inputBase, selectClass } from '@/components/ui';
import { CategoryCell, FlagList, MarketTabs, VerificationBadge, scoreTone } from '@/components/market/parts';

export const metadata = { title: 'Landlord Regulatory Index' };

const GROUPS = { eviction: 'Eviction', rent: 'Rent regulation', deposit: 'Security deposits', notice: 'Notice and entry', compliance: 'Licensing and compliance' } as const;

export default async function RegulatoryIndex({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const asOf = sp.asOf && /^\d{4}-\d{2}-\d{2}$/.test(sp.asOf) ? sp.asOf : todayIso();
  const weights: Record<string, number> = {};
  for (const f of REGULATORY_FACTORS) {
    const v = Number(sp[`w_${f.key}`]);
    if (sp[`w_${f.key}`] !== undefined && sp[`w_${f.key}`] !== '' && Number.isFinite(v) && v >= 0 && v <= 20) weights[f.key] = v;
  }

  const data = await asTenant(async (tx) => {
    const src = marketSource(tx);
    const all = [...(await src.listAreas({ level: 'state' })), ...(await src.listAreas({ level: 'city' })), ...(await src.listAreas({ level: 'metro' }))];
    const withRows: GeoArea[] = [];
    for (const a of all) if ((await src.getRegulatoryRows([a.key])).length) withRows.push(a);
    const selectedKey = parseAreaKey(sp.j ?? '') ?? withRows.find((a) => a.key === 'city:4260000')?.key ?? withRows[0]?.key;
    const selected = withRows.find((a) => a.key === selectedKey) ?? (selectedKey ? await src.getArea(selectedKey) : null);
    if (!selected) return { withRows, selected: null, res: null, overview: [] };
    const keys = await jurisdictionStack(src, selected);
    const res = computeRegulatoryIndex(await src.getRegulatoryRows(keys), { asOf, jurisdictionKeys: keys, weights });
    const overview = await Promise.all(withRows.filter((a) => !a.isDemo).map(async (a) => {
      const k = await jurisdictionStack(src, a);
      return { area: a, res: computeRegulatoryIndex(await src.getRegulatoryRows(k), { asOf, jurisdictionKeys: k, weights }) };
    }));
    return { withRows, selected, res, overview };
  });
  const { selected, res } = data;
  const groupKeys = Object.keys(GROUPS) as (keyof typeof GROUPS)[];
  const groupScore = (g: keyof typeof GROUPS) => {
    const fs = res?.factors.filter((f) => f.group === g && f.status !== 'missing') ?? [];
    return fs.length ? fs.reduce((a, f) => a + f.score, 0) / fs.length : null;
  };

  return (
    <>
      <PageHeader eyebrow="02 · Market Intelligence" title="Landlord Regulatory Index" description="Individual, cited regulatory factors with effective dates, combined with weights you control. This is not a landlord-friendliness ranking: every factor and its source are shown." meta={<><MetaItem label="Law in force on">{asOf}</MetaItem><MetaItem label="Factors">{REGULATORY_FACTORS.length}</MetaItem><MetaItem label="Cited jurisdictions">{data.withRows.filter((a) => !a.isDemo).length}</MetaItem></>} />
      <MarketTabs active="regulatory" />
      {selected?.isDemo && <div className="mb-5"><DemoBanner>Demo jurisdiction with illustrative rules. Pilot jurisdictions (Pennsylvania, Illinois, Ohio, Philadelphia, Chicago, Cleveland) use real cited sources.</DemoBanner></div>}

      <form method="get" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="panel panel-accent glow-signal fade-in overflow-hidden">
            <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="flex flex-col gap-5 p-5">
                <div>
                  <div className="eyebrow mb-1 flex items-center gap-2"><span className="text-signal">LRI</span><span className="h-px w-3 bg-line-strong" />Jurisdiction stack</div>
                  <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-arctic">{selected?.name ?? 'Select a jurisdiction'}</h2>
                  {res && <p className="mt-1 text-[12px] text-muted">{res.jurisdictions.length} jurisdiction level{res.jurisdictions.length > 1 ? 's' : ''} combined · state law preempts local where applicable</p>}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1.5 text-[11px] text-muted">Jurisdiction
                    <select name="j" defaultValue={selected?.key} className={`${selectClass} w-64`}>
                      <optgroup label="Pilot jurisdictions (cited)">{data.withRows.filter((a) => !a.isDemo).map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}</optgroup>
                      <optgroup label="Demo jurisdictions">{data.withRows.filter((a) => a.isDemo).map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}</optgroup>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-[11px] text-muted">Law in force on
                    <input type="date" name="asOf" defaultValue={asOf} className={`${inputBase} w-40`} />
                  </label>
                  <Button type="submit">Recalculate</Button>
                </div>
                {res && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {groupKeys.map((g) => {
                      const v = groupScore(g);
                      return (
                        <div key={g} className="surface-inset p-3">
                          <div className="min-h-[24px] font-mono text-[9px] uppercase leading-tight tracking-[0.08em] text-faint">{GROUPS[g]}</div>
                          <div className="mt-2 flex items-center justify-between gap-2"><CategoryCell score={v} /></div>
                          <Meter value={v ?? 0} tone={scoreTone(v) === 'neutral' ? 'neutral' : scoreTone(v)} className="mt-2.5" ticks={false} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {res && (
                <div className="flex flex-col items-center justify-center gap-4 border-t border-line/70 bg-[radial-gradient(circle_at_50%_40%,rgb(86_137_255/0.12),transparent_70%)] p-6 md:border-l md:border-t-0">
                  <ScoreRing score={res.index} size={136} stroke={8} sublabel={res.index === null ? 'withheld' : 'index'} />
                  {res.index === null && <div className="text-center text-[11.5px] text-muted">Index withheld (coverage &lt; 60%)<br /><span className="num">{res.indexProvisional} provisional</span></div>}
                  <div className="w-full">
                    <div className="mb-1.5 flex justify-between font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint"><span>Coverage</span><span className="text-titanium">{Math.round(res.coverage * 100)}%</span></div>
                    <Meter value={res.coverage * 100} tone={res.coverage >= 0.6 ? 'positive' : 'caution'} />
                  </div>
                </div>
              )}
            </div>
          </section>

          {res && groupKeys.map((g, gi) => (
            <Panel key={g} flush code={String(gi + 1).padStart(2, '0')} eyebrow="Factors" title={GROUPS[g]} actions={<CategoryCell score={groupScore(g)} />}>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[780px] text-[12.5px]">
                  <thead><tr className="text-left"><th>Factor</th><th>Rule in force</th><th className="text-right">Score</th><th>Source</th><th>Effective</th><th>Status</th></tr></thead>
                  <tbody>
                    {res.factors.filter((f) => f.group === g).map((f) => (
                      <tr key={f.key} className="align-top">
                        <td className="max-w-[220px]"><div className="font-medium text-titanium">{f.label}</div><div className="mt-0.5 text-[11px] text-faint">{f.rule}</div></td>
                        <td className="max-w-[260px]">{f.status === 'missing' ? <span className="text-faint">No cited source yet</span> : <span className="text-titanium/90">{f.display}</span>}{f.row?.notes && <div className="mt-0.5 text-[11px] text-faint">{f.row.notes}</div>}{f.preemptedByState && <div className="mt-1"><Badge tone="caution">Preempted by state</Badge></div>}</td>
                        <td className="text-right">{f.status === 'missing' ? <span className="num text-[11.5px] text-faint" title="Imputed at neutral-or-worse">({Math.round(f.score)})</span> : <CategoryCell score={f.score} />}</td>
                        <td className="max-w-[240px] text-[11.5px] text-muted">{f.row ? <>{f.row.jurisdictionName}<br />{f.row.citation.url ? <a href={f.row.citation.url} target="_blank" rel="noreferrer" className="text-signal hover:text-signal-bright hover:underline">{f.row.citation.title}</a> : f.row.citation.title}{f.row.citation.section && <> · {f.row.citation.section}</>}</> : '—'}</td>
                        <td className="num whitespace-nowrap text-[11.5px] text-muted">{f.row?.effectiveDate ?? '—'}</td>
                        <td>{f.row ? <VerificationBadge v={f.row.verification} /> : <Badge>missing</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ))}
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
          <Panel eyebrow="What matters to you" title="Factor weights">
            <p className="mb-4 text-[12px] leading-relaxed text-muted">Set any factor to 0 to ignore it. Defaults reflect typical operating impact.</p>
            <div className="flex flex-col gap-2.5">
              {REGULATORY_FACTORS.map((f) => {
                const w = weights[f.key] ?? f.defaultWeight;
                return (
                  <label key={f.key} className="flex flex-col gap-1.5 text-[12px]">
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-muted">{f.label}</span>
                      <input type="number" name={`w_${f.key}`} min={0} max={20} step={0.5} defaultValue={w} className="num h-7 w-16 rounded-md border border-line bg-void/60 px-2 text-right text-[12px] text-titanium focus:border-signal/80 focus:outline-none" />
                    </span>
                    <Meter value={w} max={20} ticks={false} className="h-1" />
                  </label>
                );
              })}
            </div>
            <Button type="submit" variant="secondary" className="mt-5 w-full">Apply weights</Button>
          </Panel>
          {res && (
            <Panel eyebrow="Pending changes and flags" title="Watch">
              {res.pending.length > 0 && <ul className="mb-4 flex flex-col gap-2 text-[12.5px]">{res.pending.map((p) => <li key={p.factor + p.effectiveDate} className="surface-inset px-3 py-2"><span className="num text-caution">{p.effectiveDate}</span> <span className="text-muted">{p.jurisdictionName}:</span> {p.label} → {p.value}</li>)}</ul>}
              <FlagList flags={res.flags} empty="No regulatory flags." />
            </Panel>
          )}
        </div>
      </form>

      {data.overview.length > 0 && (
        <Panel flush className="mt-6" eyebrow="Pilot jurisdictions with your weights" title="Side by side">
          <div className="overflow-x-auto">
            <table className="data-table compact min-w-[900px] text-[12px]">
              <thead><tr className="text-left"><th>Factor</th>{data.overview.map((o) => <th key={o.area.key}>{o.area.name}</th>)}</tr></thead>
              <tbody>
                <tr className="bg-signal/[0.04]"><td className="font-medium text-titanium">Index</td>{data.overview.map((o) => <td key={o.area.key}>{o.res.index === null ? <span className="text-muted">Withheld ({Math.round(o.res.coverage * 100)}%)</span> : <CategoryCell score={o.res.index} />}</td>)}</tr>
                {REGULATORY_FACTORS.map((f) => (
                  <tr key={f.key}>
                    <td className="text-muted">{f.label}</td>
                    {data.overview.map((o) => {
                      const x = o.res.factors.find((y) => y.key === f.key)!;
                      return <td key={o.area.key}>{x.status === 'missing' ? <span className="text-faint">—</span> : x.display}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mx-5 mt-2 border-t border-line pt-3 text-[11.5px] text-faint">Source: docs/LANDLORD_REGULATORY_INDEX.md (research retrieved 2026-11-10). Not legal advice; counsel must review before customer-facing use.</p>
        </Panel>
      )}
    </>
  );
}
