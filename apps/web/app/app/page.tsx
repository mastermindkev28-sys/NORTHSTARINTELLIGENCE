import Link from 'next/link';
import { repo } from '@northstar/db';
import { can } from '@northstar/core';
import { PILOT_JURISDICTIONS } from '@northstar/market';
import { asTenant } from '@/lib/server/session';
import { env } from '@/lib/server/env';
import { areaHref, marketSource, resolveProfile, scoreMany, todayIso } from '@/lib/server/market';
import { MetaItem, PageHeader } from '@/components/page-header';
import { Badge, ButtonLink, EmptyState, KpiCard, Panel, ScoreRing, StatusDot, cx } from '@/components/ui';
import { IconArrowUpRight, IconBriefcase, IconCalc, IconCheck, IconFile, IconGlobe, IconLayers, IconPlus, IconPulse, IconShield, IconTarget, IconUsers } from '@/components/icons';
import { dateTime, money } from '@/lib/format';

export const metadata = { title: 'Command center' };

/** Daily counts over the last `days` days, cumulative, for KPI sparklines. */
function cumulative(dates: (Date | string)[], days = 14): number[] {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const out: number[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const cutoff = end.getTime() - d * 86_400_000;
    out.push(dates.filter((x) => new Date(x).getTime() <= cutoff).length);
  }
  return out;
}

const DIVISIONS = [
  { code: '01', name: 'Acquire', blurb: 'Lead sourcing, distress signals, outreach', href: null, Icon: IconTarget },
  { code: '02', name: 'Market Intelligence', blurb: 'Market Score, regulation, undervaluation', href: '/app/market', Icon: IconGlobe },
  { code: '03', name: 'Underwrite', blurb: 'MAO, rental economics, sensitivity', href: '/app/underwrite', Icon: IconCalc },
  { code: '04', name: 'Due Diligence', blurb: 'Title, inspections, document review', href: null, Icon: IconShield },
  { code: '05', name: 'Transact', blurb: 'Contracts, assignment, closing', href: null, Icon: IconFile },
  { code: '06', name: 'Portfolio', blurb: 'Asset performance and reporting', href: null, Icon: IconBriefcase },
] as const;

export default async function Dashboard() {
  const asOf = todayIso();
  const data = await asTenant(async (tx, s) => {
    const analyses = await repo.listAnalyses(tx, 200);
    const members = await repo.listMembers(tx);
    const recent = await Promise.all(analyses.slice(0, 6).map((a) => repo.getAnalysis(tx, a.id)));
    let markets: Awaited<ReturnType<typeof scoreMany>> = [];
    try {
      const src = marketSource(tx);
      const rp = await resolveProfile(tx, 'balanced');
      const areas = (await src.listAreas({ level: 'metro' })).filter((a) => !PILOT_JURISDICTIONS.some((p) => p.key === a.key) || env.marketDataSource === 'db');
      markets = (await scoreMany(src, areas, rp, asOf)).filter((m) => m.score.overall !== null).slice(0, 5);
    } catch {
      markets = [];
    }
    const user = await repo.getCurrentUser(tx);
    return { analyses, members, recent: recent.filter((r) => r !== null), role: s.role, markets, user };
  });
  const finals = data.analyses.filter((a) => a.status === 'final');
  const since = Date.now() - 30 * 86_400_000;
  const last30 = data.analyses.filter((a) => new Date(a.createdAt).getTime() >= since).length;
  const created = data.analyses.map((a) => a.createdAt);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const first = data.user?.displayName?.split(/\s+/)[0];
  const canSave = can(data.role, 'underwriting.save');

  return (
    <>
      <PageHeader
        eyebrow="00 · Command center"
        title="Operations overview"
        description={<>{greeting}{first ? `, ${first}` : ''}. Live activity across your workspace, market signals, and the state of every division.</>}
        meta={<><MetaItem label="As of">{asOf}</MetaItem><MetaItem label="Analyses">{data.analyses.length}</MetaItem><MetaItem label="Data">{env.propertyProvider === 'mock' ? 'Demo' : env.propertyProvider}</MetaItem></>}
        actions={
          <>
            <ButtonLink href="/app/market" variant="secondary"><IconGlobe size={14} />Explore markets</ButtonLink>
            {canSave && <ButtonLink href="/app/underwrite/new"><IconPlus size={14} />New analysis</ButtonLink>}
          </>
        }
      />

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard accent label="Analyses" value={data.analyses.length} sub="All time" trend={cumulative(created)} icon={<IconLayers size={15} />} tone="signal" />
        <KpiCard label="Last 30 days" value={last30} sub="Analyses created" trend={cumulative(created.filter((d) => new Date(d).getTime() >= since))} icon={<IconPulse size={15} />} tone="positive" />
        <KpiCard label="Finalized" value={finals.length} sub="Locked decision records" trend={cumulative(finals.map((a) => a.createdAt))} icon={<IconCheck size={15} />} tone="positive" />
        <KpiCard label="Team" value={data.members.length} sub="Active members" icon={<IconUsers size={15} />} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel flush code="03" eyebrow="Underwrite" title="Deal pipeline" actions={<Link href="/app/underwrite" className="inline-flex items-center gap-1 text-[12px] text-signal hover:text-signal-bright">View all <IconArrowUpRight size={12} /></Link>}>
          {data.recent.length === 0 ? (
            <EmptyState title="No analyses yet" body="Run your first deal through the underwriting engine to see MAO, buyer margin, and sensitivity in one place." action={<Link href="/app/underwrite/new" className="text-[13px] text-signal hover:underline">Start an analysis →</Link>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[620px] text-[13px]">
                <thead><tr className="text-left"><th>Deal</th><th>Strategy</th><th className="text-right">Headline</th><th>Status</th><th className="text-right">Created</th></tr></thead>
                <tbody>
                  {data.recent.map((a) => {
                    const r = a.report as { summary?: { recommendedMaxOffer: number }; analysis?: { monthlyCashFlow: number } };
                    const rental = a.kind === 'rental';
                    return (
                      <tr key={a.id}>
                        <td>
                          <Link className="group flex items-center gap-3" href={`/app/underwrite/${a.id}`}>
                            <span className={cx('flex size-8 shrink-0 items-center justify-center rounded-lg border', rental ? 'border-violet/30 bg-violet/10 text-violet' : 'border-signal/30 bg-signal/10 text-signal')}>
                              {rental ? <IconBriefcase size={14} /> : <IconTarget size={14} />}
                            </span>
                            <span className="font-medium text-titanium transition-colors group-hover:text-signal-bright">{a.name}</span>
                          </Link>
                        </td>
                        <td className="text-muted">{rental ? 'Rental' : 'Wholesale / flip'}</td>
                        <td className="num text-right">
                          {r.summary ? <><span className="mr-1.5 text-[10px] text-faint">MAO</span><span className="text-arctic">{money(r.summary.recommendedMaxOffer)}</span></> : r.analysis ? <span className={r.analysis.monthlyCashFlow >= 0 ? 'text-positive' : 'text-critical'}>{money(r.analysis.monthlyCashFlow)}<span className="text-faint">/mo</span></span> : '—'}
                        </td>
                        <td><Badge dot tone={a.status === 'final' ? 'positive' : a.status === 'archived' ? 'neutral' : 'signal'}>{a.status === 'final' ? 'Final' : a.status}</Badge></td>
                        <td className="text-right text-[12px] text-muted">{dateTime(a.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel flush code="02" eyebrow="Market pulse" title="Top-ranked metros" actions={<Link href="/app/market" className="inline-flex items-center gap-1 text-[12px] text-signal hover:text-signal-bright">Explorer <IconArrowUpRight size={12} /></Link>}>
          {data.markets.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-muted">Market reference data is not loaded yet.</p>
          ) : (
            <ol className="flex flex-col">
              {data.markets.map(({ score: s }, i) => (
                <li key={s.area.key}>
                  <Link href={areaHref(s.area.key)} className="group flex items-center gap-3.5 px-5 py-2.5 transition-colors hover:bg-signal/[0.045]">
                    <span className="num w-4 text-[11px] text-faint">{i + 1}</span>
                    <ScoreRing score={s.overall} size={38} stroke={3} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-titanium group-hover:text-signal-bright">{s.area.name}</span>
                      <span className="block truncate text-[11px] text-muted">{s.flags.filter((f) => f.severity === 'critical').length ? `${s.flags.filter((f) => f.severity === 'critical').length} critical flag` : 'No critical flags'}{s.area.isDemo ? ' · demo' : ''}</span>
                    </span>
                    <span className="text-faint transition-colors group-hover:text-signal"><IconArrowUpRight size={13} /></span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel eyebrow="Operating system" title="Division map">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DIVISIONS.map((d) => {
              const live = !!d.href;
              const body = (
                <>
                  <div className="flex items-center justify-between">
                    <span className={cx('flex size-9 items-center justify-center rounded-lg border', live ? 'border-signal/35 bg-signal/10 text-signal shadow-[0_0_18px_-6px_rgb(86_137_255/0.8)]' : 'border-line bg-graphite-2/50 text-faint')}><d.Icon size={16} /></span>
                    {live ? <Badge tone="positive" dot>Live</Badge> : <Badge>Planned</Badge>}
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="num text-[10px] text-faint">{d.code}</span>
                    <span className={cx('text-[13.5px] font-medium', live ? 'text-arctic' : 'text-muted')}>{d.name}</span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-snug text-faint">{d.blurb}</p>
                </>
              );
              return live ? (
                <Link key={d.code} href={d.href!} className="surface-inset group p-4 transition-all hover:-translate-y-0.5 hover:border-signal/40 hover:shadow-[0_10px_30px_-14px_rgb(86_137_255/0.6)]">{body}</Link>
              ) : (
                <div key={d.code} className="surface-inset p-4 opacity-75">{body}</div>
              );
            })}
          </div>
        </Panel>
        <Panel eyebrow="System" title="Platform status">
          <dl className="flex flex-col gap-1 text-[13px]">
            {[
              { k: 'Underwriting engine', tone: 'positive' as const, v: <Badge tone="positive">Operational</Badge> },
              { k: 'Property data provider', tone: env.propertyProvider === 'mock' ? ('caution' as const) : ('signal' as const), v: env.propertyProvider === 'mock' ? <Badge tone="caution">Demo data</Badge> : <Badge tone="signal">{env.propertyProvider}</Badge> },
              { k: 'Market data', tone: env.marketDataSource === 'demo' ? ('caution' as const) : ('positive' as const), v: <Badge tone={env.marketDataSource === 'demo' ? 'caution' : 'positive'}>{env.marketDataSource === 'demo' ? 'Demo + cited law' : 'Reference DB'}</Badge> },
              { k: 'Messaging', tone: 'neutral' as const, v: <Badge>Not connected</Badge> },
              { k: 'CRM sync', tone: 'neutral' as const, v: <Badge>Not connected</Badge> },
              { k: 'Tenant isolation', tone: 'positive' as const, v: <Badge tone="positive">RLS enforced</Badge> },
            ].map((row) => (
              <div key={row.k} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-graphite-2/40">
                <dt className="flex items-center gap-2.5 text-muted"><StatusDot tone={row.tone} live={row.tone === 'positive'} />{row.k}</dt>
                <dd>{row.v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </>
  );
}
