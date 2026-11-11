'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cx } from '@/components/ui';
import { IconArrowRight, IconSearch } from '@/components/icons';
import { COMMANDS } from './nav';

/** ⌘K / Ctrl+K command palette for jumping anywhere in the platform. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setI(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return COMMANDS;
    return COMMANDS.filter((c) => `${c.label} ${c.group} ${c.keywords ?? ''}`.toLowerCase().includes(t));
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group hidden h-8 w-[300px] items-center gap-2 rounded-lg border border-line bg-void/50 px-2.5 text-[12.5px] text-faint shadow-[inset_0_1px_2px_rgb(0_0_0/0.3)] transition-colors hover:border-line-strong hover:text-muted lg:flex"
      >
        <IconSearch size={14} />
        <span className="flex-1 text-left">Search or jump to…</span>
        <span className="kbd">⌘K</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-void/70 px-4 pt-[14vh] backdrop-blur-sm" onMouseDown={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Command palette">
          <div className="panel glow-signal fade-in w-full max-w-[560px] overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <span className="text-signal"><IconSearch size={16} /></span>
              <input
                ref={input}
                value={q}
                onChange={(e) => { setQ(e.target.value); setI(0); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(results.length - 1, x + 1)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
                  if (e.key === 'Enter' && results[i]) go(results[i].href);
                }}
                placeholder="Search screens, markets, actions…"
                className="h-12 flex-1 bg-transparent text-[14px] text-titanium placeholder:text-faint focus:outline-none"
                aria-label="Search"
              />
              <span className="kbd">ESC</span>
            </div>
            <ul className="max-h-[360px] overflow-y-auto p-2" role="listbox">
              {results.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-muted">No matches</li>}
              {results.map((c, j) => (
                <li key={c.href} role="option" aria-selected={j === i}>
                  <button type="button" onMouseEnter={() => setI(j)} onClick={() => go(c.href)} className={cx('flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13px]', j === i ? 'bg-signal/12 text-arctic' : 'text-titanium/90')}>
                    <span className="w-36 shrink-0 font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint">{c.group}</span>
                    <span className="flex-1">{c.label}</span>
                    {j === i && <span className="text-signal"><IconArrowRight size={14} /></span>}
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-4 border-t border-line px-4 py-2 font-mono text-[10px] text-faint">
              <span><span className="kbd">↑</span> <span className="kbd">↓</span> navigate</span>
              <span><span className="kbd">↵</span> open</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
