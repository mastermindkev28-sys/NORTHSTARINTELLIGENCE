'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx, StatusDot } from '@/components/ui';
import { NorthstarWordmark } from '@/components/logo';
import { IconBriefcase, IconCalc, IconCommand, IconFile, IconGlobe, IconLock, IconLog, IconShield, IconTarget, IconUsers } from '@/components/icons';
import { NAV, type NavIcon } from './nav';

const ICONS: Record<NavIcon, (p: { size?: number }) => React.ReactNode> = {
  command: IconCommand, target: IconTarget, globe: IconGlobe, calc: IconCalc, shield: IconShield, file: IconFile, briefcase: IconBriefcase, users: IconUsers, log: IconLog,
};

export function Sidebar({ dataMode }: { dataMode: 'demo' | 'live' }) {
  const path = usePathname();
  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-line/80 bg-[linear-gradient(180deg,rgb(19_26_37/0.92),rgb(10_14_21/0.96))] md:block">
      <div className="sticky top-0 flex h-dvh flex-col">
      <div className="flex h-14 items-center border-b border-line/60 px-5">
        <Link href="/app" aria-label="Northstar home"><NorthstarWordmark compact /></Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-6 pt-2" aria-label="Primary">
        {NAV.map((g) => (
          <div key={g.section} className="mt-5">
            <div className="flex items-center gap-2 px-2.5 pb-2">
              <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.18em] text-faint">{g.section}</span>
              <span className="h-px flex-1 bg-gradient-to-r from-line/80 to-transparent" />
            </div>
            <ul className="flex flex-col gap-px">
              {g.items.map((item) => {
                const active = !!item.href && (item.href === '/app' ? path === '/app' : path.startsWith(item.href));
                const Icon = ICONS[item.icon];
                if (!item.href) {
                  return (
                    <li key={item.label}>
                      <span className="group flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] text-faint" aria-disabled="true" title="On the roadmap">
                        <span className="opacity-60"><Icon size={15} /></span>
                        <span className="flex-1">{item.label}</span>
                        <span className="num text-[9.5px] text-faint/70">{item.code}</span>
                        <IconLock size={11} />
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cx(
                        'group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-all duration-150',
                        active ? 'bg-[linear-gradient(90deg,rgb(86_137_255/0.16),rgb(86_137_255/0.03))] text-arctic shadow-[inset_0_0_0_1px_rgb(86_137_255/0.18)]' : 'text-muted hover:bg-graphite-2/60 hover:text-titanium',
                      )}
                    >
                      {active && <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-signal shadow-[0_0_12px_rgb(86_137_255)]" />}
                      <span className={cx('transition-colors', active ? 'text-signal' : 'text-faint group-hover:text-muted')}><Icon size={15} /></span>
                      <span className="flex-1">{item.label}</span>
                      <span className={cx('num text-[9.5px]', active ? 'text-signal/80' : 'text-faint/70')}>{item.code}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line/60 p-3">
        <div className="surface-inset flex flex-col gap-2 p-3">
          <div className="flex items-center gap-2 text-[11.5px] text-titanium">
            <StatusDot tone="positive" live />
            <span>All systems operational</span>
          </div>
          <div className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint">
            <span>Engine v1 · RLS on</span>
            <span className={dataMode === 'demo' ? 'text-caution' : 'text-positive'}>{dataMode === 'demo' ? 'Demo data' : 'Live data'}</span>
          </div>
        </div>
      </div>
      </div>
    </aside>
  );
}
