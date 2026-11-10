import { ROLE_LABELS } from '@northstar/core';
import { repo } from '@northstar/db';
import { Sidebar } from '@/components/shell/sidebar';
import { asTenant } from '@/lib/server/session';
import { logoutAction, switchOrgAction } from '@/lib/actions/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, orgs, session } = await asTenant(async (tx, s) => ({
    user: await repo.getCurrentUser(tx),
    orgs: await repo.listMyOrganizations(tx),
    session: s,
  }));
  const current = orgs.find((o) => o.id === session.orgId);
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-line bg-obsidian/90 px-6 backdrop-blur">
          <form action={switchOrgAction} className="flex items-center gap-2">
            <label htmlFor="org" className="eyebrow">Workspace</label>
            {orgs.length > 1 ? (
              <>
                <select id="org" name="orgId" defaultValue={session.orgId} className="h-8 rounded-md border border-line bg-graphite px-2 text-[13px]">
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <button className="h-8 rounded-md border border-line px-2 text-[12px] text-muted hover:text-titanium" type="submit">Switch</button>
              </>
            ) : (
              <span id="org" className="text-[13px] font-medium">{current?.name}</span>
            )}
          </form>
          <div className="flex items-center gap-4">
            <div className="text-right leading-tight">
              <div className="text-[13px]">{user?.displayName}</div>
              <div className="font-mono text-[10.5px] uppercase tracking-wider text-muted">{ROLE_LABELS[session.role]}</div>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="rounded-md border border-line px-2.5 py-1.5 text-[12px] text-muted hover:text-titanium">Sign out</button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
