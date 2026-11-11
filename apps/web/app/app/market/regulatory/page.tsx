import { REGULATORY_FACTORS, computeRegulatoryIndex, jurisdictionStack, type GeoArea } from '@northstar/market';
import { asTenant } from '@/lib/server/session';
import { marketSource, parseAreaKey, todayIso } from '@/lib/server/market';
import { PageHeader } from '@/components/page-header';
import { Badge, DemoBanner, Panel } from '@/components/ui';
import { CategoryCell, FlagList, MarketTabs, ScoreBar, VerificationBadge } from '@/components/market/parts';

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

  return (
    <>
      <PageHeader eyebrow="02 · Market Intelligence" title="Landlord Regulatory Index" description="Individual, cited regulatory factors with effective dates, combined with weights you control. This is not a landlord-friendliness ranking: every factor and its source are shown." />
      <MarketTabs active="regulatory" />
      {selected?.isDemo && <div className="mb-5"><DemoBanner>Demo jurisdiction with illustrative rules. Pilot jurisdictions (Pennsylvania, Illinois, Ohio, Philadelphia, Chicago, Cleveland) use real cited sources.</DemoBanner></div>}

      <form method="get" className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <div className="panel flex flex-wrap items-end gap-4 px-5 py-4">
            <label className="flex flex-col gap-1.5 text-[12px] text-muted">Jurisdiction
              <select name="j" defaultValue={selected?.key} className="h-9 w-64 rounded-md border border-line bg-obsidian px-2 text-[13px] text-titanium">
                <optgroup label="Pilot jurisdictions (cited)">{data.withRows.filter((a) => !a.isDemo).map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}</optgroup>
                <optgroup label="Demo jurisdictions">{data.withRows.filter((a) => a.isDemo).map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}</optgroup>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[12px] text-muted">Law in force on
              <input type="date" name="asOf" defaultValue={asOf} className="h-9 rounded-md border border-line bg-obsidian px-2 text-[13px] text-titanium" />
            </label>
            <button type="submit" className="h-9 rounded-md bg-signal px-3.5 text-sm font-medium text-white hover:bg-signal-deep">Recalculate</button>
            {res && (
              <div className="ml-auto flex items-center gap-4">
                <div className="text-right text-[11.5px] text-muted">Coverage <span className="num text-titanium">{Math.round(res.coverage * 100)}%</span><br />{res.jurisdictions.length} jurisdiction level{res.jurisdictions.length > 1 ? 's' : ''}</div>
                <div className="w-40">{res.index === null ? <div className="text-[12px] text-muted">Index withheld (coverage &lt; 60%)<br /><span className="num">{res.indexProvisional} provisional</span></div> : <ScoreBar score={res.index} size="lg" />}</div>
              </div>
            )}
          </div>

          {res && (Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => (
            <Panel key={g} eyebrow="Factors" title={GROUPS[g]}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-[12.5px]">
                  <thead><tr className="text-left text-[11px] text-muted"><th className="pb-2 font-normal">Factor</th><th className="pb-2 font-normal">Rule in force</th><th className="pb-2 text-right font-normal">Score</th><th className="pb-2 pl-3 font-normal">Source</th><th className="pb-2 font-normal">Effective</th><th className="pb-2 font-normal">Status</th></tr></thead>
                  <tbody>
                    {res.factors.filter((f) => f.group === g).map((f) => (
                      <tr key={f.key} className="border-t border-line align-top">
                        <td className="py-2"><div>{f.label}</div><div className="text-[11px] text-muted">{f.rule}</div></td>
                        <td className="py-2">{f.status === 'missing' ? <span className="text-muted">No cited source yet</span> : f.display}{f.row?.notes && <div className="text-[11px] text-muted">{f.row.notes}</div>}{f.preemptedByState && <div className="text-[11px] text-muted">Local rule preempted by state law</div>}</td>
                        <td className="py-2 text-right">{f.status === 'missing' ? <span className="num text-[11.5px] text-muted/70" title="Imputed at neutral-or-worse">({Math.round(f.score)})</span> : <CategoryCell score={f.score} />}</td>
                        <td className="py-2 pl-3 text-[11.5px] text-muted">{f.row ? <>{f.row.jurisdictionName}<br />{f.row.citation.url ? <a href={f.row.citation.url} target="_blank" rel="noreferrer" className="text-signal hover:underline">{f.row.citation.title}</a> : f.row.citation.title}{f.row.citation.section && <> · {f.row.citation.section}</>}</> : '—'}</td>
                        <td className="num py-2 text-[11.5px] text-muted">{f.row?.effectiveDate ?? '—'}</td>
                        <td className="py-2">{f.row ? <VerificationBadge v={f.row.verification} /> : <Badge>missing</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ))}
        </div>

        <div className="flex flex-col gap-6">
          <Panel eyebrow="What matters to you" title="Factor weights">
            <p className="mb-3 text-[12px] text-muted">Set any factor to 0 to ignore it. Defaults reflect typical operating impact.</p>
            <div className="flex flex-col gap-2">
              {REGULATORY_FACTORS.map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-3 text-[12px]">
                  <span className="text-muted">{f.label}</span>
                  <input type="number" name={`w_${f.key}`} min={0} max={20} step={0.5} defaultValue={weights[f.key] ?? f.defaultWeight} className="num h-7 w-16 rounded border border-line bg-obsidian px-2 text-right text-[12px]" />
                </label>
              ))}
            </div>
            <button type="submit" className="mt-4 h-8 w-full rounded-md border border-line text-[12.5px] hover:border-muted">Apply weights</button>
          </Panel>
          {res && (
            <Panel eyebrow="Pending changes and flags" title="Watch">
              {res.pending.length > 0 && <ul className="mb-3 flex flex-col gap-1 text-[12.5px]">{res.pending.map((p) => <li key={p.factor + p.effectiveDate}><span className="num text-caution">{p.effectiveDate}</span> {p.jurisdictionName}: {p.label} → {p.value}</li>)}</ul>}
              <FlagList flags={res.flags} empty="No regulatory flags." />
            </Panel>
          )}
        </div>
      </form>

      {data.overview.length > 0 && (
        <Panel className="mt-6" eyebrow="Pilot jurisdictions with your weights" title="Side by side">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[12px]">
              <thead><tr className="text-left text-[11px] text-muted"><th className="pb-2 font-normal">Factor</th>{data.overview.map((o) => <th key={o.area.key} className="pb-2 pl-3 font-normal">{o.area.name}</th>)}</tr></thead>
              <tbody>
                <tr className="border-t border-line"><td className="py-2 font-medium">Index</td>{data.overview.map((o) => <td key={o.area.key} className="py-2 pl-3">{o.res.index === null ? <span className="text-muted">Withheld ({Math.round(o.res.coverage * 100)}%)</span> : <CategoryCell score={o.res.index} />}</td>)}</tr>
                {REGULATORY_FACTORS.map((f) => (
                  <tr key={f.key} className="border-t border-line">
                    <td className="py-1.5 text-muted">{f.label}</td>
                    {data.overview.map((o) => {
                      const x = o.res.factors.find((y) => y.key === f.key)!;
                      return <td key={o.area.key} className="py-1.5 pl-3">{x.status === 'missing' ? <span className="text-muted/50">—</span> : x.display}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11.5px] text-muted">Source: docs/LANDLORD_REGULATORY_INDEX.md (research retrieved 2026-11-10). Not legal advice; counsel must review before customer-facing use.</p>
        </Panel>
      )}
    </>
  );
}
