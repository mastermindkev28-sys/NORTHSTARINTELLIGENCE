import { repo } from '@northstar/db';
import { can } from '@northstar/core';
import { asTenant } from '@/lib/server/session';
import { PageHeader } from '@/components/page-header';
import { Badge, EmptyState, Panel } from '@/components/ui';
import { dateTime } from '@/lib/format';

export const metadata = { title: 'Audit log' };

export default async function AuditPage() {
  const { entries, allowed } = await asTenant(async (tx, s) => ({ entries: can(s.role, 'audit.read') ? await repo.listAudit(tx, 200) : [], allowed: can(s.role, 'audit.read') }));
  return (
    <>
      <PageHeader eyebrow="A2 · Administration" title="Audit log" description="Append-only record of consequential actions. Data changes are captured automatically by the database, including which fields changed (never their values)." />
      <Panel>
        {!allowed ? (
          <EmptyState title="Restricted" body="Only owners and administrators can view the audit log." />
        ) : entries.length === 0 ? (
          <EmptyState title="No activity yet" body="Actions in this workspace will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[12.5px]">
              <thead><tr className="text-left text-muted"><th className="pb-2 font-normal">When</th><th className="pb-2 font-normal">Actor</th><th className="pb-2 font-normal">Action</th><th className="pb-2 font-normal">Target</th><th className="pb-2 font-normal">Details</th></tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-line/60 align-top">
                    <td className="whitespace-nowrap py-2 pr-3 text-muted">{dateTime(e.occurredAt)}</td>
                    <td className="py-2 pr-3">{e.actorName ?? <Badge>{e.actorType}</Badge>}</td>
                    <td className="num py-2 pr-3 text-[11.5px]">{e.action}</td>
                    <td className="num py-2 pr-3 text-[11px] text-muted">{e.targetType ? `${e.targetType}:${(e.targetId ?? '').slice(0, 8)}` : '—'}</td>
                    <td className="num py-2 text-[11px] text-muted">{Object.keys(e.metadata).length ? JSON.stringify(e.metadata) : ''}</td>
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
