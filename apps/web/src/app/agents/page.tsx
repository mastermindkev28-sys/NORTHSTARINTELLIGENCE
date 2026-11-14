import { AGENT_SPECS } from "@northstar/agents";
import { PageHeader, Pill } from "@/components/ui";
import { title } from "@/lib/format";

export default function AgentsPage() {
  return (
    <>
      <PageHeader eyebrow="Platform" title="Agent registry" />
      <p className="-mt-3 mb-6 max-w-3xl text-sm text-muted">Agents are workflows with least-privilege grants. AI is used only where judgment over unstructured input adds value; calculations, compliance, and routing are deterministic.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {AGENT_SPECS.map((a) => (
          <article key={a.id} className="rounded-lg border border-line bg-graphite p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-signal">{title(a.division)}</div>
                <h2 className="mt-1 font-medium text-arctic">{a.name}</h2>
              </div>
              <Pill tone={a.status === "implemented" ? "positive" : a.status === "partial" ? "caution" : "default"}>{title(a.status)}</Pill>
            </div>
            <p className="mt-2 text-sm text-titanium/85">{a.purpose}</p>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div><dt className="inline text-muted">AI usage: </dt><dd className="inline text-titanium/85">{a.aiUsage}</dd></div>
              <div><dt className="inline text-muted">Triggers: </dt><dd className="num inline text-titanium/85">{a.triggers.join(", ")}</dd></div>
              <div><dt className="inline text-muted">Permissions: </dt><dd className="num inline text-titanium/85">{a.permissions.join(", ") || "engine-internal"}</dd></div>
              {a.escalation.length > 0 && <div><dt className="inline text-muted">Escalates on: </dt><dd className="inline text-titanium/85">{a.escalation.join("; ")}</dd></div>}
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}
