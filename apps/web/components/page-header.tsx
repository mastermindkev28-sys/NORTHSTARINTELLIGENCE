import type { ReactNode } from 'react';

/**
 * Screen header. The eyebrow's leading code ("02 · …") is split out and rendered as a Signal Blue
 * index chip so every screen reads as part of one numbered system.
 */
export function PageHeader({ eyebrow, title, description, actions, meta }: { eyebrow: string; title: ReactNode; description?: ReactNode; actions?: ReactNode; meta?: ReactNode }) {
  const m = /^([0-9A-Z]{2})\s*·\s*(.*)$/.exec(eyebrow);
  const code = m?.[1];
  const label = m ? m[2] : eyebrow;
  return (
    <div className="fade-in mb-8 flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0 max-w-3xl">
        <div className="mb-3 flex items-center gap-2.5">
          {code && <span className="num rounded-[5px] border border-signal/35 bg-signal/10 px-1.5 py-0.5 text-[10px] font-medium text-signal-bright shadow-[0_0_14px_-4px_rgb(86_137_255/0.8)]">{code}</span>}
          <span className="eyebrow">{label}</span>
        </div>
        <h1 className="text-gradient text-[30px] font-semibold leading-[1.1] tracking-[-0.025em]">{title}</h1>
        {description && <p className="mt-3 text-[14px] leading-relaxed text-muted">{description}</p>}
        {meta && <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Small "label value" pair for PageHeader meta rows. */
export function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px]">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">{label}</span>
      <span className="num text-titanium/90">{children}</span>
    </span>
  );
}
