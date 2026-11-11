import Link from 'next/link';
import { marketRepo } from '@northstar/db';
import { METRICS, getMetric, type GeoArea } from '@northstar/market';
import { asTenant } from '@/lib/server/session';
import { areaHref, marketSource, parseAreaKey, resolveProfile, scoreMany, todayIso } from '@/lib/server/market';
import { PageHeader } from '@/components/page-header';
import { Badge, DemoBanner, EmptyState, Panel, cx } from '@/components/ui';
import { CategoryCell, ConfidenceBadge, FlagList, MarketTabs, ProfileOptions, ScoreBar, formatMetric } from '@/components/market/parts';

export const metadata = { title: 'Compare markets' };

type SP = Promise<{ areas?: string | string[]; profile?: string; mode?: string }>;

export default async function Compare({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const raw = (Array.isArray(sp.areas) ? sp.areas : (sp.areas ?? '').split(',')).filter(Boolean);
  const keys = [...new Set(raw.map(parseAreaKey).filter((k): k is string => !!k))].slice(0, 4);
  const mode = sp.mode === 'relative' ? 'relative' : 'absolute';
  const asOf = todayIso();

  const data = await asTenant(async (tx) => {
    const src = marketSource(tx);
    const rp = await resolveProfile(tx, sp.profile);
    const areas = (await Promise.all(keys.map((k) => src.getArea(k)))).filter((a): a is GeoArea => !!a);
    const metros = await src.listAreas({ level: 'metro' });
    const results = areas.length ? await scoreMany(src, areas, rp, asOf, mode) : [];
    const ordered = keys.map((k) => results.find((r) => r.score.area.key === k)).filter((r) => !!r);
    return { rp, ordered, metros, custom: await marketRepo.listScoreProfiles(tx) };
  });
  const { rp, ordered } = data;
  const cols = ordered.map((r) => r!.score);
  const best = (vals: (number | null)[]) => {
    const nums = vals.filter((v): v is number => v !== null);
    return nums.length > 1 ? Math.max(...nums) : null;
  };

  return (
    <>
      <PageHeader eyebrow="02 · Market Intelligence" title="Compare markets" description="Side-by-side scores, categories, raw values with sources, and every material risk flag. Best value per row is highlighted." />
      <MarketTabs active="compare" />
      <form method="get" className="panel mb-6 flex flex-wrap items-end gap-3 px-5 py-4">
        {[0, 1, 2, 3].map((i) => (
          <label key={i} className="flex flex-col gap-1.5 text-[12px] text-muted">Area {i + 1}
            <select name="areas" defaultValue={keys[i] ?? ''} className="h-9 w-48 rounded-md border border-line bg-obsidian px-2 text-[13px] text-titanium">
              <option value="">—</option>
              {data.metros.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
              {keys[i] && !data.metros.some((m) => m.key === keys[i]) && <option value={keys[i]}>{cols.find((c) => c.area.key === keys[i])?.area.name ?? keys[i]}</option>}
            </select>
          </label>
        ))}
        <label className="flex flex-col gap-1.5 text-[12px] text-muted">Profile
          <select name="profile" defaultValue={rp.id} className="h-9 rounded-md border border-line bg-obsidian px-2 text-[13px] text-titanium"><ProfileOptions custom={data.custom} /></select>
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] text-muted">Normalization
          <select name="mode" defaultValue={mode} className="h-9 rounded-md border border-line bg-obsidian px-2 text-[13px] text-titanium"><option value="absolute">Absolute</option><option value="relative">Relative</option></select>
        </label>
        <button type="submit" className="h-9 rounded-md bg-signal px-3.5 text-sm font-medium text-white hover:bg-signal-deep">Compare</button>
      </form>

      {cols.length < 2 ? (
        <Panel><EmptyState title="Pick at least two areas" body="Choose areas above, or tick rows in the Explore ranking and press Compare selected." /></Panel>
      ) : (
        <>
          {cols.some((c) => c.isDemo) && <div className="mb-5"><DemoBanner>Includes fictional demo geographies with illustrative values.</DemoBanner></div>}
          <Panel title={`${rp.profile.label} · ${mode === 'relative' ? 'percentiles within this set' : 'fixed reference ranges'}`} eyebrow={`Valuation date ${asOf}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[12.5px]">
                <thead>
                  <tr className="text-left">
                    <th className="w-64 pb-3 font-normal text-muted">Variable</th>
                    {cols.map((c) => <th key={c.area.key} className="pb-3 pl-4 font-medium"><Link href={areaHref(c.area.key, rp.id)} className="hover:text-signal">{c.area.name}</Link>{c.isDemo && <Badge tone="caution" className="ml-2">Demo</Badge>}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-line">
                    <td className="py-3 font-medium">Market Score</td>
                    {cols.map((c) => <td key={c.area.key} className="py-3 pl-4">{c.overall === null ? <span className="text-muted">Insufficient data</span> : <ScoreBar score={c.overall} />}</td>)}
                  </tr>
                  <tr className="border-t border-line">
                    <td className="py-2.5 text-muted">Confidence</td>
                    {cols.map((c) => <td key={c.area.key} className="py-2.5 pl-4"><ConfidenceBadge label={c.confidenceLabel} value={c.confidence} /></td>)}
                  </tr>
                  {cols[0]!.categories.map((cat, ci) => {
                    const vals = cols.map((c) => c.categories[ci]!.score);
                    const b = best(vals);
                    return (
                      <tr key={cat.key} className="border-t border-line bg-graphite-2/30">
                        <td className="py-2.5 font-medium">{cat.label} <span className="num text-[10.5px] text-muted">{Math.round(cat.weight * 100)}%</span></td>
                        {cols.map((c) => <td key={c.area.key} className={cx('py-2.5 pl-4', b !== null && c.categories[ci]!.score === b && 'font-semibold')}><CategoryCell score={c.categories[ci]!.score} /></td>)}
                      </tr>
                    );
                  })}
                  {METRICS.filter((m) => cols.some((c) => c.categories.some((cat) => cat.variables.some((v) => v.metric === m.key && v.value !== null)))).map((m) => {
                    const def = getMetric(m.key);
                    const vs = cols.map((c) => c.categories.flatMap((cat) => cat.variables).find((v) => v.metric === m.key) ?? null);
                    const b = best(vs.map((v) => (v && v.status === 'observed' ? v.score : null)));
                    return (
                      <tr key={m.key} className="border-t border-line">
                        <td className="py-2 pl-3 text-muted" title={def.description}>{def.label}</td>
                        {vs.map((v, i) => (
                          <td key={cols[i]!.area.key} className={cx('py-2 pl-4', v && b !== null && v.status === 'observed' && v.score === b && 'text-positive')}>
                            <span className="num">{v ? formatMetric(v.value, v.unit) : '—'}</span>
                            {v && v.status === 'observed' && <span className="num ml-2 text-[10.5px] text-muted">{Math.round(v.score)}{v.inherited ? ' · inh.' : ''}</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
          <div className="mt-6 grid gap-6" style={{ gridTemplateColumns: `repeat(${Math.min(cols.length, 2)}, minmax(0, 1fr))` }}>
            {cols.map((c) => (
              <Panel key={c.area.key} eyebrow="Material risk flags" title={c.area.name}>
                <FlagList flags={c.flags.filter((f) => f.severity !== 'info')} />
              </Panel>
            ))}
          </div>
        </>
      )}
    </>
  );
}
