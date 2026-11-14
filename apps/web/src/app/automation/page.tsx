import { getWorkspace, DEMO_ORG } from "@/lib/workspace";
import { PageHeader, Panel, Pill, Table } from "@/components/ui";
import { time, title } from "@/lib/format";
import { decide } from "./actions";

export const dynamic = "force-dynamic";

const statusTone = (s: string) =>
  (s === "succeeded"
    ? "positive"
    : s === "dead_lettered"
      ? "critical"
      : s === "awaiting_approval" || s === "sleeping"
        ? "caution"
        : s === "cancelled"
          ? "default"
          : "signal") as "positive" | "critical" | "caution" | "default" | "signal";

export default async function AutomationCenter() {
  const ws = await getWorkspace();
  const approvals = await ws.store.listApprovals(DEMO_ORG);
  const runs = await ws.store.listRuns(DEMO_ORG, { limit: 200 });
  const dead = await ws.store.listDeadLetters(DEMO_ORG);
  const audit = ws.store.audit
    .filter((a) => a.organizationId === DEMO_ORG)
    .slice(-10)
    .reverse();

  return (
    <>
      <PageHeader eyebrow="Platform" title="Automation center" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title={`Human approvals (${approvals.filter((a) => a.status === "pending").length} pending)`}
          className="lg:col-span-2"
        >
          <ul className="space-y-3">
            {approvals.map((a) => (
              <li key={a.id} className="rounded-md border border-line bg-obsidian/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-arctic">{a.summary}</div>
                    <div className="mt-1 text-xs text-muted">
                      Requires <span className="num">{a.requiredPermission}</span> · requested{" "}
                      {time(a.createdAt)}
                    </div>
                    {a.status !== "pending" && (
                      <div className="mt-1 text-xs text-muted">
                        {title(a.status)} by {a.decidedBy}
                        {a.reason ? ` — ${a.reason}` : ""}
                      </div>
                    )}
                  </div>
                  {a.status === "pending" ? (
                    <form action={decide} className="flex gap-2">
                      <input type="hidden" name="approvalId" value={a.id} />
                      <button
                        name="decision"
                        value="approved"
                        className="rounded-md bg-signal px-3 py-1.5 text-xs font-medium text-obsidian hover:bg-signal/90"
                      >
                        Approve
                      </button>
                      <button
                        name="decision"
                        value="rejected"
                        className="rounded-md border border-line px-3 py-1.5 text-xs text-titanium hover:bg-graphite-2"
                      >
                        Reject
                      </button>
                    </form>
                  ) : (
                    <Pill tone={a.status === "approved" ? "positive" : "critical"}>
                      {title(a.status)}
                    </Pill>
                  )}
                </div>
              </li>
            ))}
            {approvals.length === 0 && (
              <li className="text-sm text-muted">No approvals requested.</li>
            )}
          </ul>
          <p className="mt-3 text-[11px] text-muted">
            Agents cannot approve their own requests. Decisions require a human user with the stated
            permission and are written to the append-only audit log.
          </p>
        </Panel>
        <Panel title="Audit log (latest)">
          <ul className="space-y-2 text-xs">
            {audit.map((e, i) => (
              <li key={i}>
                <span className="num text-signal">{e.action}</span>{" "}
                <span className="text-muted">
                  by {e.actorType}:{e.actorId} · {time(e.at)}
                </span>
              </li>
            ))}
            {audit.length === 0 && (
              <li className="text-muted">No consequential actions recorded yet.</li>
            )}
          </ul>
        </Panel>
      </div>

      <Panel title={`Workflow runs (${runs.length})`} className="mt-4">
        <Table head={["Workflow", "Status", "Failed attempts", "Started", "Last update", "Error"]}>
          {runs.map((r) => (
            <tr key={r.id}>
              <td className="num px-3 py-2 text-titanium">{r.workflowId}</td>
              <td className="px-3 py-2">
                <Pill tone={statusTone(r.status)}>{title(r.status)}</Pill>
              </td>
              <td className="num px-3 py-2 text-muted">
                {r.attempt}/{r.maxAttempts}
              </td>
              <td className="px-3 py-2 text-muted">{time(r.createdAt)}</td>
              <td className="px-3 py-2 text-muted">{time(r.updatedAt)}</td>
              <td className="px-3 py-2 text-xs text-critical">{r.lastError?.message ?? ""}</td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel title={`Dead-letter queue (${dead.length})`} className="mt-4">
        {dead.length === 0 ? (
          <p className="text-sm text-muted">
            Empty. Runs land here after exhausting retries or on non-retryable errors.
          </p>
        ) : (
          <Table head={["Workflow", "Attempts", "Error", "At"]}>
            {dead.map((d) => (
              <tr key={d.id}>
                <td className="num px-3 py-2">{d.workflowId}</td>
                <td className="num px-3 py-2">{d.attempts}</td>
                <td className="px-3 py-2 text-xs text-critical">{d.error.message}</td>
                <td className="px-3 py-2 text-muted">{time(d.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  );
}
