import Link from 'next/link';
import { NorthstarWordmark } from '@/components/logo';

const PILLARS = [
  { k: 'Traced', v: 'Every number linked to its source and formula' },
  { k: 'Labeled', v: 'Every assumption classified by provenance' },
  { k: 'Audited', v: 'Every change recorded, every tenant isolated' },
];

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_540px]">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-line/80 p-12 lg:flex">
        <div className="pointer-events-none absolute -left-40 top-1/3 size-[640px] rounded-full bg-signal/10 blur-[120px]" />
        <div className="pointer-events-none absolute right-[-260px] top-1/2 size-[720px] -translate-y-1/2 rounded-full border border-line/40" />
        <div className="pointer-events-none absolute right-[-160px] top-1/2 size-[520px] -translate-y-1/2 rounded-full border border-line/50" />
        <div className="pointer-events-none absolute right-[-60px] top-1/2 size-[320px] -translate-y-1/2 rounded-full border border-signal/20 shadow-[0_0_80px_-20px_rgb(86_137_255/0.5)]" />
        <Link href="/" className="relative"><NorthstarWordmark /></Link>
        <div className="relative max-w-xl">
          <div className="eyebrow mb-5 flex items-center gap-2"><span className="h-px w-6 bg-signal" />Built for decisions. Engineered for execution.</div>
          <p className="text-gradient text-[40px] font-semibold leading-[1.08] tracking-[-0.03em]">The intelligence infrastructure for real estate.</p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {PILLARS.map((p) => (
              <div key={p.k} className="panel p-4">
                <div className="num text-[11px] text-signal">{p.k}</div>
                <div className="mt-2 text-[12px] leading-snug text-muted">{p.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
          <span>Northstar Acquisitions LLC</span>
          <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-positive shadow-[0_0_8px_var(--color-positive)]" />Systems operational</span>
        </div>
      </div>
      <div className="flex flex-col justify-center bg-void/40 px-6 py-12 backdrop-blur-sm sm:px-14">
        <div className="mb-10 lg:hidden"><NorthstarWordmark /></div>
        <div className="panel panel-accent p-8">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-arctic">{title}</h1>
          <p className="mt-2 text-[14px] text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
        <div className="mt-6 text-center text-[13px] text-muted">{footer}</div>
      </div>
    </main>
  );
}
