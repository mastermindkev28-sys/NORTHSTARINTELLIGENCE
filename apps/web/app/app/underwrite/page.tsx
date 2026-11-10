import Link from 'next/link';
import { repo } from '@northstar/db';
import { can } from '@northstar/core';
import { asTenant } from '@/lib/server/session';
import { PageHeader } from '@/components/page-header';
import { Badge, EmptyState, Panel } from '@/components/ui';
import { dateTime } from '@/lib/format';

export const metadata = { title: 'Underwrite' };

export default async function UnderwriteIndex() {
  const { rows, role } = await asTenant(async (tx, s) => ({ rows: await repo.listAnalyses(tx, 200), role: s.role }));
  const newBtn = (kind: string, label: string, primary = false) => (
    <Link href={`/app/underwrite/new?kind=${kind}`} className={primary ? 'inline-flex h-9 items-center rounded-md bg-signal px-3.5 text-sm font-medium text-white hover:bg-signal-deep' : 'inline-flex h-9 items-center rounded-md border border-line px-3.5 text-sm text-titanium hover:border-muted'}>{label}</Link>
  );
  return (
    <>
      <PageHeader
        eyebrow="03 · Northstar Underwrite"
        title="Investment analysis"
        description="Wholesale, flip, and rental underwriting on tested deterministic functions. Every saved analysis stores its inputs, engine version, and a fingerprint so it can be reproduced exactly."
        actions={<div className="flex gap-2">{newBtn('rental', 'Rental analysis')}{newBtn('wholesale', 'Wholesale / flip analysis', true)}</div>}
      />
      <Panel>
        {rows.length === 0 ? (
          <EmptyState title="No saved analyses" body={can(role, 'underwriting.save') ? 'Create your first analysis to build a reproducible record of each deal decision.' : 'Analyses saved by your team will appear here.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead><tr className="text-left text-muted"><th className="pb-2 font-normal">Name</th><th className="pb-2 font-normal">Type</th><th className="pb-2 font-normal">Status</th><th className="pb-2 font-normal">Analyst</th><th className="pb-2 font-normal">Fingerprint</th><th className="pb-2 text-right font-normal">Created</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-t border-line">
                    <td className="py-2.5"><Link className="hover:text-signal" href={`/app/underwrite/${a.id}`}>{a.name}</Link></td>
                    <td className="py-2.5 text-muted">{a.kind === 'rental' ? 'Rental' : 'Wholesale / flip'}</td>
                    <td className="py-2.5"><Badge tone={a.status === 'final' ? 'positive' : a.status === 'archived' ? 'neutral' : 'signal'}>{a.status}</Badge></td>
                    <td className="py-2.5 text-muted">{a.createdByName ?? '—'}</td>
                    <td className="num py-2.5 text-[11.5px] text-muted">{a.inputsFingerprint}</td>
                    <td className="py-2.5 text-right text-muted">{dateTime(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
