import type { ReactNode } from "react";
import type { ValueOrigin } from "@northstar/core";

export function Panel({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-lg border border-line bg-graphite ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: string; tone?: "default" | "signal" | "positive" | "caution" | "critical" }) {
  const color = { default: "text-arctic", signal: "text-signal", positive: "text-positive", caution: "text-caution", critical: "text-critical" }[tone];
  return (
    <div className="rounded-lg border border-line bg-graphite px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className={`num mt-1.5 text-2xl font-medium ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

const ORIGIN_STYLE: Record<ValueOrigin, { label: string; cls: string }> = {
  verified: { label: "Verified", cls: "border-positive/40 text-positive" },
  user_assumption: { label: "Assumption", cls: "border-titanium/30 text-titanium" },
  third_party_estimate: { label: "Third-party", cls: "border-signal/40 text-signal" },
  ai_generated: { label: "AI · review", cls: "border-caution/50 text-caution" },
  calculated: { label: "Calculated", cls: "border-muted/40 text-muted" },
};

export function OriginBadge({ origin, confidence }: { origin: ValueOrigin; confidence?: number }) {
  const s = ORIGIN_STYLE[origin];
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${s.cls}`} title={`Origin: ${s.label}${confidence !== undefined ? ` · confidence ${(confidence * 100).toFixed(0)}%` : ""}`}>
      {s.label}
      {confidence !== undefined && <span className="num opacity-70">{Math.round(confidence * 100)}</span>}
    </span>
  );
}

export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "signal" | "positive" | "caution" | "critical" }) {
  const cls = {
    default: "bg-graphite-2 text-titanium",
    signal: "bg-signal/15 text-signal",
    positive: "bg-positive/15 text-positive",
    caution: "bg-caution/15 text-caution",
    critical: "bg-critical/15 text-critical",
  }[tone];
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

export const tierTone = (tier: string) => (tier === "hot" ? "critical" : tier === "warm" ? "caution" : tier === "nurture" ? "signal" : "default") as "critical" | "caution" | "signal" | "default";
export const verdictTone = (v: string | null) => (v === "allow" ? "positive" : v === "defer" ? "caution" : v === "block" ? "critical" : v === "require_review" ? "caution" : "default") as "positive" | "caution" | "critical" | "default";
export const decisionTone = (d: string | undefined) => (d === "pursue" ? "positive" : d === "negotiate" ? "caution" : d === "pass" ? "critical" : "default") as "positive" | "caution" | "critical" | "default";

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-signal">{eyebrow}</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-arctic">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-[0.1em] text-muted">
            {head.map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70">{children}</tbody>
      </table>
    </div>
  );
}
