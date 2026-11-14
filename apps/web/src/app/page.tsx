import Link from "next/link";
import { getWorkspace, DEMO_ORG } from "@/lib/workspace";
import {
  PageHeader,
  Panel,
  Pill,
  Stat,
  Table,
  decisionTone,
  tierTone,
  verdictTone,
} from "@/components/ui";
import { title, usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ExecutiveDashboard() {
  const ws = await getWorkspace();
  const leads = await ws.repo.listLeads(DEMO_ORG);
  const messages = ws.repo.messages.filter((m) => m.organizationId === DEMO_ORG);
  const outbound = messages.filter((m) => m.direction === "outbound");
  const approvals = await ws.store.listApprovals(DEMO_ORG, "pending");
  const runs = await ws.store.listRuns(DEMO_ORG, { limit: 500 });
  const tasks = (await ws.repo.listTasks(DEMO_ORG)).filter((t) => t.status === "open");
  const active = leads.filter((l) => l.status !== "duplicate");
  const pipelineValue = active.reduce((s, l) => s + (l.underwriting?.recommendedMaxOffer ?? 0), 0);
  const byStatus = Object.entries(
    active.reduce<Record<string, number>>(
      (acc, l) => ((acc[l.status] = (acc[l.status] ?? 0) + 1), acc),
      {},
    ),
  );
  const verdicts = outbound.reduce<Record<string, number>>(
    (acc, m) => (
      (acc[m.complianceVerdict ?? "none"] = (acc[m.complianceVerdict ?? "none"] ?? 0) + 1),
      acc
    ),
    {},
  );
  const max = Math.max(1, ...byStatus.map(([, n]) => n));

  return (
    <>
      <PageHeader eyebrow="Command" title="Executive overview">
        <div className="text-right text-xs text-muted">
          <div>
            Simulated time{" "}
            <span className="num text-titanium">
              {ws.clock.now().toISOString().replace("T", " ").slice(0, 16)} UTC
            </span>
          </div>
          <div>
            Model:{" "}
            {ws.modelMode === "claude" ? "Claude (live)" : "Simulated extraction (no API key)"}
          </div>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Active leads" value={active.length} />
        <Stat
          label="Hot leads"
          value={active.filter((l) => l.tier === "hot").length}
          tone="critical"
        />
        <Stat
          label="Messages sent"
          value={outbound.filter((m) => m.status === "sent").length}
          tone="signal"
        />
        <Stat
          label="Blocked / deferred"
          value={outbound.filter((m) => m.status !== "sent").length}
          tone="caution"
          hint="by compliance gate"
        />
        <Stat
          label="Pending approvals"
          value={approvals.length}
          tone={approvals.length ? "caution" : "default"}
        />
        <Stat label="Offer ceilings (Σ)" value={usd(pipelineValue)} hint="recommended max offers" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Pipeline by stage" className="lg:col-span-2">
          <ul className="space-y-2.5">
            {byStatus
              .sort((a, b) => b[1] - a[1])
              .map(([status, n]) => (
                <li
                  key={status}
                  className="grid grid-cols-[140px_1fr_32px] items-center gap-3 text-sm"
                >
                  <span className="text-titanium/90">{title(status)}</span>
                  <span className="h-2 rounded-full bg-graphite-2">
                    <span
                      className="block h-2 rounded-full bg-signal"
                      style={{ width: `${(n / max) * 100}%` }}
                    />
                  </span>
                  <span className="num text-right text-muted">{n}</span>
                </li>
              ))}
          </ul>
        </Panel>
        <Panel title="Compliance gate decisions">
          <ul className="space-y-2 text-sm">
            {Object.entries(verdicts).map(([v, n]) => (
              <li key={v} className="flex items-center justify-between">
                <Pill tone={verdictTone(v)}>{title(v)}</Pill>
                <span className="num text-muted">{n}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Every outbound message passes consent, suppression, DNC freshness, quiet-hour,
            frequency, and content checks before the messaging adapter will send it.
          </p>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          title="Priority leads"
          className="lg:col-span-2"
          action={
            <Link href="/leads" className="text-xs text-signal hover:underline">
              All leads →
            </Link>
          }
        >
          <Table head={["Seller", "Property", "Score", "Stage", "Decision", "Max offer"]}>
            {active
              .sort((a, b) => b.score - a.score)
              .slice(0, 6)
              .map((l) => (
                <tr key={l.id} className="hover:bg-graphite-2/50">
                  <td className="px-3 py-2">
                    <Link className="text-arctic hover:text-signal" href={`/leads/${l.id}`}>
                      {l.fullName ?? "Unknown"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {l.property ? `${l.property.line1}, ${l.property.state}` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className="num mr-2">{l.score}</span>
                    <Pill tone={tierTone(l.tier)}>{l.tier}</Pill>
                  </td>
                  <td className="px-3 py-2 text-titanium/90">{title(l.status)}</td>
                  <td className="px-3 py-2">
                    {l.underwriting ? (
                      <Pill tone={decisionTone(l.underwriting.decision)}>
                        {title(l.underwriting.decision)}
                      </Pill>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="num px-3 py-2">{usd(l.underwriting?.recommendedMaxOffer)}</td>
                </tr>
              ))}
          </Table>
        </Panel>
        <Panel
          title="Open work"
          action={
            <Link href="/automation" className="text-xs text-signal hover:underline">
              Automation →
            </Link>
          }
        >
          <ul className="space-y-3 text-sm">
            {tasks.slice(0, 6).map((t) => (
              <li key={t.id}>
                <div className="text-arctic">{t.title}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted">{t.detail}</div>
              </li>
            ))}
            {tasks.length === 0 && <li className="text-muted">No open tasks.</li>}
          </ul>
          <div className="mt-4 border-t border-line pt-3 text-xs text-muted">
            Workflow runs: <span className="num text-titanium">{runs.length}</span> · succeeded{" "}
            <span className="num text-positive">
              {runs.filter((r) => r.status === "succeeded").length}
            </span>{" "}
            · awaiting approval{" "}
            <span className="num text-caution">
              {runs.filter((r) => r.status === "awaiting_approval").length}
            </span>{" "}
            · dead-lettered{" "}
            <span className="num text-critical">
              {runs.filter((r) => r.status === "dead_lettered").length}
            </span>
          </div>
        </Panel>
      </div>
    </>
  );
}
