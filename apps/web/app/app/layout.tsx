import { ROLE_LABELS } from '@northstar/core';
import { repo } from '@northstar/db';
import { Sidebar } from '@/components/shell/sidebar';
import { Breadcrumbs } from '@/components/shell/breadcrumbs';
import { CommandPalette } from '@/components/shell/command-palette';
import { IconLogout } from '@/components/icons';
import { asTenant } from '@/lib/server/session';
import { env } from '@/lib/server/env';
import { logoutAction, switchOrgAction } from '@/lib/actions/auth';
import { selectClass } from '@/components/ui';

function initials(name: string | undefined | null) {
  return (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, orgs, session } = await asTenant(async (tx, s) => ({
    user: await repo.getCurrentUser(tx),
    orgs: await repo.listMyOrganizations(tx),
    session: s,
  }));
  const current = orgs.find((o) => o.id === session.orgId);
  const demo = env.propertyProvider === 'mock' || env.marketDataSource === 'demo';
  return (
    <div className="flex min-h-dvh">
      <Sidebar dataMode={demo ? 'demo' : 'live'} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line/70 bg-void/70 px-6 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-4">
            {orgs.length > 1 ? (
              <form action={switchOrgAction} className="flex items-center gap-2">
                <label htmlFor="org" className="sr-only">Workspace</label>
                <select id="org" name="orgId" defaultValue={session.orgId} className={`${selectClass} h-8 w-auto text-[12.5px]`}>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <button className="h-8 rounded-md border border-line px-2 text-[12px] text-muted hover:text-titanium" type="submit">Switch</button>
              </form>
            ) : null}
            <Breadcrumbs workspace={orgs.length > 1 ? undefined : current?.name} />
          </div>
          <div className="flex items-center gap-3">
            <CommandPalette />
            <span className="hidden h-5 w-px bg-line lg:block" />
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#5689ff,#9b8cff)] text-[11px] font-semibold text-white shadow-[0_0_0_2px_var(--color-void),0_0_0_3px_rgb(86_137_255/0.4)]" aria-hidden>
                {initials(user?.displayName)}
              </div>
              <div className="hidden text-left leading-tight sm:block">
                <div className="text-[12.5px] text-titanium">{user?.displayName}</div>
                <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint">{ROLE_LABELS[session.role]}</div>
              </div>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-titanium">
                <IconLogout size={13} />Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
