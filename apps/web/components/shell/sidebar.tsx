'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui';
import { NorthstarWordmark } from '@/components/logo';

const nav = [
  { section: 'Platform', items: [{ href: '/app', label: 'Command center', code: '00' }] },
  {
    section: 'Divisions',
    items: [
      { href: null, label: 'Acquire', code: '01' },
      { href: '/app/market', label: 'Market Intelligence', code: '02' },
      { href: '/app/underwrite', label: 'Underwrite', code: '03' },
      { href: null, label: 'Due Diligence', code: '04' },
      { href: null, label: 'Transact', code: '05' },
      { href: null, label: 'Portfolio', code: '06' },
    ],
  },
  {
    section: 'Administration',
    items: [
      { href: '/app/settings/members', label: 'Members & roles', code: 'A1' },
      { href: '/app/settings/audit', label: 'Audit log', code: 'A2' },
    ],
  },
] as const;

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-graphite/40 md:flex">
      <div className="px-5 py-5"><NorthstarWordmark compact /></div>
      <nav className="flex-1 overflow-y-auto px-3 pb-6" aria-label="Primary">
        {nav.map((g) => (
          <div key={g.section} className="mt-4">
            <div className="eyebrow px-2 pb-2">{g.section}</div>
            <ul className="flex flex-col gap-0.5">
              {g.items.map((item) => {
                const active = item.href && (item.href === '/app' ? path === '/app' : path.startsWith(item.href));
                const body = (
                  <>
                    <span className={cx('num w-6 text-[10.5px]', active ? 'text-signal' : 'text-muted/70')}>{item.code}</span>
                    <span className="flex-1">{item.label}</span>
                    {!item.href && <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted/60">Planned</span>}
                  </>
                );
                return (
                  <li key={item.label}>
                    {item.href ? (
                      <Link href={item.href} aria-current={active ? 'page' : undefined} className={cx('flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors', active ? 'bg-graphite-2 text-titanium' : 'text-muted hover:bg-graphite-2/60 hover:text-titanium')}>
                        {body}
                      </Link>
                    ) : (
                      <span className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted/50" aria-disabled="true">{body}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
