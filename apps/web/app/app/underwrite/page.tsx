import Link from 'next/link';
import { repo } from '@northstar/db';
import { can } from '@northstar/core';
import { asTenant } from '@/lib/server/session';
import { PageHeader } from '@/components/page-header';
import { Badge, ButtonLink, EmptyState, Panel } from '@/components/ui';
import { IconPlus } from '@/components/icons';
import { dateTime } from '@/lib/format';

export const metadata = { title: 'Underwrite' };

export default async function UnderwriteIndex() {
  const { rows, role } = await asTenant(async (tx, s) => ({ rows: await repo.listAnalyses(tx, 200), role: s.role }));
  const newBtn = (kind: string, label: string, primary = false) => (
    <ButtonLink href={`/app/underwrite/new?kind=${kind}`} variant={primary ? 'primary' : 'secondary'}>{primary && <IconPlus size={14} />}{label}</ButtonLink>
  );
  return (
    <>
      <PageHeader
        eyebrow="03 · Northstar Underwrite"
        title="Investment analysis"
        description="Wholesale, flip, and rental underwriting on tested deterministic functions. Every saved analysis stores its inputs, engine version, and a fingerprint so it can be reproduced exactly."
        actions={<div className="flex gap-2">{newBtn('rental', 'Rental analysis')}{newBtn('wholesale', 'Wholesale / flip analysis', true)}</div>}
      />
      <Panel flush accent>
        {rows.length === 0 ? (
          <EmptyState title="No saved analyses" body={can(role, 'underwriting.save') ? 'Create your first analysis to build a reproducible record of each deal decision.' : 'Analyses saved by your team will appear here.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[720px] text-[13px]">
              <thead><tr className="text-left"><th>Name</th><th>Type</th><th>Status</th><th>Analyst</th><th>Fingerprint</th><th className="text-right">Created</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td><Link className="font-medium hover:text-signal-bright" href={`/app/underwrite/${a.id}`}>{a.name}</Link></td>
                    <td className="text-muted">{a.kind === 'rental' ? 'Rental' : 'Wholesale / flip'}</td>
                    <td><Badge dot tone={a.status === 'final' ? 'positive' : a.status === 'archived' ? 'neutral' : 'signal'}>{a.status}</Badge></td>
                    <td className="text-muted">{a.createdByName ?? '—'}</td>
                    <td className="num text-[11px] text-signal/70">{a.inputsFingerprint}</td>
                    <td className="text-right text-[12px] text-muted">{dateTime(a.createdAt)}</td>
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
