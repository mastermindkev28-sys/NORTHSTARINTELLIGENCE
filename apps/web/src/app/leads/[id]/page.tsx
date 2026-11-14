import Link from "next/link";
import { notFound } from "next/navigation";
import type { Sourced } from "@northstar/core";
import { getWorkspace, DEMO_ORG } from "@/lib/workspace";
import { OriginBadge, PageHeader, Panel, Pill, Table, decisionTone, tierTone, verdictTone } from "@/components/ui";
import { pct, time, title, usd } from "@/lib/format";

export const dynamic = "force-dynamic";

function FactRow({ label, fact, format = (v) => String(v) }: { label: string; fact: Sourced<unknown> | null | undefined; format?: (v: unknown) => string }) {
  return (
    <tr>
      <td className="px-3 py-2 text-muted">{label}</td>
      <td className="num px-3 py-2 text-arctic">{fact ? format(fact.value) : <span className="text-muted">Unknown</span>}</td>
      <td className="px-3 py-2">{fact && <OriginBadge origin={fact.origin} confidence={fact.confidence} />}</td>
      <td className="px-3 py-2 text-xs text-muted">{fact?.source ? `${fact.source.system} · ${time(fact.source.retrievedAt)}` : ""}{fact?.source?.reference ? <div className="mt-0.5 italic">“{fact.source.reference}”</div> : null}</td>
    </tr>
  );
}

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getWorkspace();
  const lead = await ws.repo.getLead(DEMO_ORG, id);
  if (!lead) notFound();
  const messages = await ws.repo.listMessages(DEMO_ORG, id);
  const tasks = (await ws.repo.listTasks(DEMO_ORG)).filter((t) => t.leadId === id);
  const uw = lead.underwriting;
  const f = lead.facts;
  const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-US") : String(v));

  return (
    <>
      <Link href="/leads" className="text-xs text-muted hover:text-signal">← Lead intelligence</Link>
      <PageHeader eyebrow={lead.property ? `${lead.property.city}, ${lead.property.state} ${lead.property.zip5}` : "No property address"} title={lead.property?.line1 ?? lead.fullName ?? "Lead"}>
        <div className="flex items-center gap-2">
          <span className="num text-2xl text-arctic">{lead.score}</span>
          <Pill tone={tierTone(lead.tier)}>{lead.tier}</Pill>
          <Pill>{title(lead.status)}</Pill>
        </div>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Panel title="Property & seller facts">
            <Table head={["Field", "Value", "Origin", "Source"]}>
              <FactRow label="Living area (sq ft)" fact={f.livingAreaSqft} format={n} />
              <FactRow label="Bedrooms / baths" fact={f.bedrooms ? { ...f.bedrooms, value: `${f.bedrooms.value} / ${f.bathrooms?.value ?? "?"}` } : null} />
              <FactRow label="Year built" fact={f.yearBuilt} />
              <FactRow label="Annual property tax" fact={f.annualTaxAmount} format={(v) => usd(v as number)} />
              <FactRow label="Asking price" fact={lead.askingPrice} format={(v) => usd(v as number)} />
              <FactRow label="Timeline" fact={lead.timeline} format={(v) => title(String(v))} />
              <FactRow label="Condition" fact={lead.condition} format={(v) => title(String(v))} />
              <FactRow label="Occupancy" fact={lead.occupancy} format={(v) => title(String(v))} />
              <FactRow label="Motivation" fact={lead.motivationSummary} />
            </Table>
            {lead.missingFields.length > 0 && <p className="mt-3 text-xs text-muted">Still needed for qualification: {lead.missingFields.map(title).join(", ")}</p>}
          </Panel>

          <Panel title="Initial underwriting" action={uw && <span className="text-[11px] text-muted">Methodology {uw.methodologyVersion}</span>}>
            {!uw ? <p className="text-sm text-muted">Not yet underwritten.</p> : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["ARV", usd(uw.arv.value), uw.arv.comps ? `${uw.arv.comps.included.length} comps · ${uw.arv.comps.grade}` : title(uw.arv.origin)],
                    ["Rehab", usd(uw.rehab.value), uw.rehab.estimate?.isPlaceholderRate ? "placeholder rates" : title(uw.rehab.origin)],
                    ["MAO (70% rule)", usd(uw.maoRuleOfThumb), "after assignment fee"],
                    ["MAO (cost-based)", usd(uw.maoCostBased), "end-buyer cost stack"],
                  ].map(([k, v, h]) => (
                    <div key={k} className="rounded-md border border-line bg-obsidian/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-muted">{k}</div>
                      <div className="num mt-1 text-lg text-arctic">{v}</div>
                      <div className="text-[11px] text-muted">{h}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-signal/30 bg-signal/5 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.12em] text-muted">Recommended max offer</div>
                  <div className="num text-xl text-signal">{usd(uw.recommendedMaxOffer)}</div>
                  <Pill tone={decisionTone(uw.decision)}>{title(uw.decision)}</Pill>
                  {lead.approvedOfferCeiling != null && <Pill tone="positive">Ceiling approved by a manager</Pill>}
                  <div className="w-full text-xs text-titanium/80">{uw.decisionReasons.join(" ")}</div>
                </div>
                {uw.warnings.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-caution">{uw.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}

                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-medium text-signal">Calculation trace ({uw.trace.length} steps) — every figure is reproducible</summary>
                  <Table head={["Step", "Formula", "Result"]}>
                    {uw.trace.map((s, i) => (
                      <tr key={`${s.key}-${i}`}>
                        <td className="px-3 py-1.5 text-titanium/90">{s.label}</td>
                        <td className="px-3 py-1.5 text-xs text-muted">{s.formula}</td>
                        <td className="num px-3 py-1.5 text-right">{s.result === null ? "—" : s.unit === "ratio" ? pct(s.result, 2) : s.unit === "usd" || s.unit === "usd_per_sqft" ? usd(s.result, s.unit === "usd_per_sqft") : s.result.toLocaleString("en-US")}</td>
                      </tr>
                    ))}
                  </Table>
                </details>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-signal">Assumptions & provenance</summary>
                  <Table head={["Assumption", "Value", "Origin"]}>
                    {uw.assumptions.map((a) => (
                      <tr key={a.key}><td className="px-3 py-1.5 text-titanium/90">{a.label}</td><td className="num px-3 py-1.5">{typeof a.value === "number" ? (a.value < 1 && a.value > 0 ? pct(a.value) : a.value.toLocaleString("en-US")) : a.value ?? "—"}</td><td className="px-3 py-1.5"><OriginBadge origin={a.origin} /></td></tr>
                    ))}
                  </Table>
                </details>
                {uw.arv.comps && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-signal">Comparable sales ({uw.arv.comps.included.length} used, {uw.arv.comps.excluded.length} excluded)</summary>
                    <Table head={["Comp", "Adj. price", "$/sq ft", "Months ago", "Weight"]}>
                      {uw.arv.comps.included.map((c) => (
                        <tr key={c.id}><td className="px-3 py-1.5 text-muted">{lead.comps.find((x) => x.id === c.id)?.address ?? c.id}</td><td className="num px-3 py-1.5">{usd(c.adjustedPrice)}</td><td className="num px-3 py-1.5">{usd(c.pricePerSqft)}</td><td className="num px-3 py-1.5">{c.monthsAgo.toFixed(1)}</td><td className="num px-3 py-1.5">{pct(c.weight)}</td></tr>
                      ))}
                    </Table>
                    {uw.arv.comps.excluded.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-muted">{uw.arv.comps.excluded.map((e) => <li key={e.id}>Excluded {e.id}: {e.reason}</li>)}</ul>}
                  </details>
                )}
                <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">{uw.limitations.join(" ")}</p>
              </>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-4">
          <Panel title="Conversation">
            <ol className="space-y-3">
              {messages.map((m) => (
                <li key={m.id} className={m.direction === "inbound" ? "pr-6" : "pl-6"}>
                  <div className={`rounded-md px-3 py-2 text-sm ${m.direction === "inbound" ? "bg-graphite-2 text-arctic" : "border border-line bg-obsidian/50 text-titanium"}`}>{m.body}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted">
                    <span>{m.direction === "inbound" ? "Seller" : "Northstar agent"} · {time(m.at)}</span>
                    {m.complianceVerdict && <Pill tone={verdictTone(m.complianceVerdict)}>{title(m.complianceVerdict)}</Pill>}
                    {m.complianceVerdict !== "allow" && m.complianceReasons.map((r) => <span key={r} className="num">{r}</span>)}
                  </div>
                </li>
              ))}
              {messages.length === 0 && <li className="text-sm text-muted">No messages.</li>}
            </ol>
          </Panel>
          <Panel title="Lead score factors">
            <ul className="space-y-1.5 text-sm">
              {lead.scoreFactors.map((s, i) => (
                <li key={i} className="flex justify-between gap-3"><span className="text-titanium/90">{s.explanation}</span><span className={`num ${s.points >= 0 ? "text-positive" : "text-critical"}`}>{s.points > 0 ? "+" : ""}{s.points}</span></li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted">Scoring uses property, transaction, and engagement signals only — never protected characteristics.</p>
          </Panel>
          {tasks.length > 0 && (
            <Panel title="Tasks">
              <ul className="space-y-2 text-sm">{tasks.map((t) => <li key={t.id}><div className="text-arctic">{t.title}</div><div className="text-xs text-muted">{t.detail}</div></li>)}</ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
