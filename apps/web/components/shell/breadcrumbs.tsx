'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui';
import { breadcrumbs } from './nav';

export function Breadcrumbs({ workspace }: { workspace?: string }) {
  const crumbs = breadcrumbs(usePathname());
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[12.5px]">
      {workspace && (
        <>
          <span className="truncate text-muted">{workspace}</span>
          <span className="text-line-strong">/</span>
        </>
      )}
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex min-w-0 items-center gap-2">
          {i > 0 && <span className="text-line-strong">/</span>}
          <Link href={c.href} className={cx('truncate transition-colors', i === crumbs.length - 1 ? 'text-titanium' : 'text-muted hover:text-titanium')}>{c.label}</Link>
        </span>
      ))}
    </nav>
  );
}
