import { repo } from '@northstar/db';
import { ROLES, ROLE_LABELS, can } from '@northstar/core';
import { asTenant } from '@/lib/server/session';
import { updateRoleAction } from '@/lib/actions/members';
import { PageHeader } from '@/components/page-header';
import { Badge, Panel } from '@/components/ui';
import { dateTime } from '@/lib/format';

export const metadata = { title: 'Members & roles' };

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: 'Full control, billing, and owner management.',
  admin: 'Manage members, settings, and read the audit log.',
  manager: 'Create, edit, finalize, and delete records.',
  acquisitions: 'Work leads and create analyses.',
  analyst: 'Create and edit analyses.',
  viewer: 'Read-only. Can record opt-outs.',
};

export default async function MembersPage() {
  const { members, session } = await asTenant(async (tx, s) => ({ members: await repo.listMembers(tx), session: s }));
  const manage = can(session.role, 'members.manage');
  return (
    <>
      <PageHeader eyebrow="A1 · Administration" title="Members and roles" description="Permissions are enforced in the database itself, so a role cannot be bypassed by any screen or API." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Panel title={`${members.length} member${members.length === 1 ? '' : 's'}`}>
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-muted"><th className="pb-2 font-normal">Name</th><th className="pb-2 font-normal">Email</th><th className="pb-2 font-normal">Role</th><th className="pb-2 text-right font-normal">Joined</th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId} className="border-t border-line">
                  <td className="py-2.5">{m.displayName}{m.userId === session.userId && <span className="ml-2 text-[11px] text-muted">(you)</span>}</td>
                  <td className="py-2.5 text-muted">{m.email}</td>
                  <td className="py-2.5">
                    {manage && m.userId !== session.userId ? (
                      <form action={updateRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={m.userId} />
                        <select name="role" defaultValue={m.role} aria-label={`Role for ${m.displayName}`} className="h-8 rounded-md border border-line bg-obsidian px-2 text-[12.5px]">
                          {ROLES.filter((r) => r !== 'owner' || can(session.role, 'members.grant_owner')).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                        <button type="submit" className="text-[12px] text-signal hover:underline">Save</button>
                      </form>
                    ) : <Badge>{ROLE_LABELS[m.role]}</Badge>}
                  </td>
                  <td className="py-2.5 text-right text-muted">{dateTime(m.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-[12px] text-muted">Email invitations are next on the roadmap; they require an email delivery provider.</p>
        </Panel>
        <Panel title="Role reference">
          <dl className="flex flex-col gap-3 text-[12.5px]">
            {ROLES.map((r) => <div key={r}><dt className="font-medium">{ROLE_LABELS[r]}</dt><dd className="text-muted">{ROLE_DESCRIPTIONS[r]}</dd></div>)}
          </dl>
        </Panel>
      </div>
    </>
  );
}
