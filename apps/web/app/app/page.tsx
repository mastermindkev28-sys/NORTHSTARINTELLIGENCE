import Link from 'next/link';
import { repo } from '@northstar/db';
import { can } from '@northstar/core';
import { asTenant } from '@/lib/server/session';
import { env } from '@/lib/server/env';
import { PageHeader } from '@/components/page-header';
import { Badge, EmptyState, Panel, Stat } from '@/components/ui';
import { dateTime, money } from '@/lib/format';

export const metadata = { title: 'Command center' };

export default async function Dashboard() {
  const data = await asTenant(async (tx, s) => {
    const analyses = await repo.listAnalyses(tx, 200);
    const members = await repo.listMembers(tx);
    const recent = await Promise.all(analyses.slice(0, 6).map((a) => repo.getAnalysis(tx, a.id)));
    return { analyses, members, recent: recent.filter((r) => r !== null), role: s.role };
  });
  const finals = data.analyses.filter((a) => a.status === 'final').length;
  const since = Date.now() - 30 * 86_400_000;
  const last30 = data.analyses.filter((a) => new Date(a.createdAt).getTime() >= since).length;

  return (
    <>
      <PageHeader eyebrow="00 · Command center" title="Operations overview" description="Activity across your workspace. Divisions marked Planned are on the roadmap and not yet available." actions={can(data.role, 'underwriting.save') ? <Link href="/app/underwrite/new" className="inline-flex h-9 items-center rounded-md bg-signal px-3.5 text-sm font-medium text-white hover:bg-signal-deep">New analysis</Link> : null} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel><Stat label="Analyses" value={data.analyses.length} sub="All time" /></Panel>
        <Panel><Stat label="Last 30 days" value={last30} sub="Analyses created" /></Panel>
        <Panel><Stat label="Finalized" value={finals} sub="Locked decision records" /></Panel>
        <Panel><Stat label="Team" value={data.members.length} sub="Active members" /></Panel>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <Panel title="Recent analyses" eyebrow="03 · Underwrite" actions={<Link href="/app/underwrite" className="text-[12px] text-signal hover:underline">View all</Link>}>
          {data.recent.length === 0 ? (
            <EmptyState title="No analyses yet" body="Run your first deal through the underwriting engine to see MAO, buyer margin, and sensitivity in one place." action={<Link href="/app/underwrite/new" className="text-[13px] text-signal hover:underline">Start an analysis →</Link>} />
          ) : (
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-muted"><th className="pb-2 font-normal">Name</th><th className="pb-2 font-normal">Type</th><th className="pb-2 text-right font-normal">Headline</th><th className="pb-2 text-right font-normal">Created</th></tr></thead>
              <tbody>
                {data.recent.map((a) => {
                  const r = a.report as { summary?: { recommendedMaxOffer: number }; analysis?: { monthlyCashFlow: number } };
                  return (
                    <tr key={a.id} className="border-t border-line">
                      <td className="py-2.5"><Link className="hover:text-signal" href={`/app/underwrite/${a.id}`}>{a.name}</Link> {a.status === 'final' && <Badge tone="positive">Final</Badge>}</td>
                      <td className="py-2.5 text-muted">{a.kind === 'rental' ? 'Rental' : 'Wholesale / flip'}</td>
                      <td className="num py-2.5 text-right">{r.summary ? <>MAO {money(r.summary.recommendedMaxOffer)}</> : r.analysis ? <>{money(r.analysis.monthlyCashFlow)}/mo</> : '—'}</td>
                      <td className="py-2.5 text-right text-muted">{dateTime(a.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="Platform status" eyebrow="System">
          <dl className="flex flex-col gap-3 text-[13px]">
            <div className="flex justify-between"><dt className="text-muted">Underwriting engine</dt><dd><Badge tone="positive">Operational</Badge></dd></div>
            <div className="flex justify-between"><dt className="text-muted">Property data provider</dt><dd>{env.propertyProvider === 'mock' ? <Badge tone="caution">Demo data</Badge> : <Badge tone="signal">{env.propertyProvider}</Badge>}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Messaging</dt><dd><Badge>Not connected</Badge></dd></div>
            <div className="flex justify-between"><dt className="text-muted">CRM sync</dt><dd><Badge>Not connected</Badge></dd></div>
            <div className="flex justify-between"><dt className="text-muted">Tenant isolation</dt><dd><Badge tone="positive">RLS enforced</Badge></dd></div>
          </dl>
        </Panel>
      </div>
    </>
  );
}
