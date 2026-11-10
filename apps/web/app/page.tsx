import Link from 'next/link';
import { NorthstarWordmark } from '@/components/logo';

const divisions = [
  ['01', 'Acquire', 'Lead intake, qualification, follow-up, and pipeline.'],
  ['02', 'Intelligence', 'Property and market data with source provenance.'],
  ['03', 'Underwrite', 'Deterministic deal analysis with transparent formulas.'],
  ['04', 'Due Diligence', 'Document intelligence and acquisition risk.'],
  ['05', 'Transact', 'Deadlines, milestones, and closing coordination.'],
  ['06', 'Portfolio', 'Asset performance and portfolio cash flow.'],
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <NorthstarWordmark />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-md px-3 py-2 text-muted hover:text-titanium">Sign in</Link>
          <Link href="/signup" className="rounded-md bg-signal px-3.5 py-2 font-medium text-white hover:bg-signal-deep">Create workspace</Link>
        </nav>
      </header>
      <section className="flex flex-1 flex-col justify-center py-20">
        <div className="eyebrow mb-5">Real Estate. Intelligence. Execution.</div>
        <h1 className="max-w-3xl text-[44px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[56px]">
          The intelligence infrastructure for real estate.
        </h1>
        <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-muted">
          One operating environment for acquisition teams: lead intelligence, property research, and underwriting you can audit line by line.
        </p>
        <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {divisions.map(([n, name, body]) => (
            <div key={n} className="bg-graphite p-5">
              <div className="num text-[11px] text-signal">{n}</div>
              <div className="mt-2 text-[15px] font-semibold">Northstar {name}</div>
              <div className="mt-1 text-[13px] text-muted">{body}</div>
            </div>
          ))}
        </div>
      </section>
      <footer className="flex justify-between border-t border-line py-6 text-[12px] text-muted">
        <span>© {new Date().getFullYear()} Northstar Acquisitions LLC</span>
        <span className="font-mono">Working brand name, pending clearance</span>
      </footer>
    </main>
  );
}
