import Link from 'next/link';
import { NorthstarWordmark } from '@/components/logo';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_520px]">
      <div className="hidden flex-col justify-between border-r border-line bg-graphite/40 p-10 lg:flex">
        <Link href="/"><NorthstarWordmark /></Link>
        <div>
          <div className="eyebrow mb-4">Built for decisions. Engineered for execution.</div>
          <p className="max-w-md text-[22px] font-medium leading-snug">Every number traced to its source. Every assumption labeled. Every change audited.</p>
        </div>
        <div className="font-mono text-[11px] text-muted">Northstar Acquisitions LLC</div>
      </div>
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mb-10 lg:hidden"><NorthstarWordmark /></div>
        <h1 className="text-[24px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-[14px] text-muted">{subtitle}</p>
        <div className="mt-8">{children}</div>
        <div className="mt-8 text-[13px] text-muted">{footer}</div>
      </div>
    </main>
  );
}
