import Link from "next/link";
import { getWorkspace, DEMO_ORG } from "@/lib/workspace";
import { PageHeader, Panel, Pill, Table, decisionTone, tierTone } from "@/components/ui";
import { title, usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const ws = await getWorkspace();
  const leads = (await ws.repo.listLeads(DEMO_ORG)).sort((a, b) => b.score - a.score);
  return (
    <>
      <PageHeader eyebrow="Northstar Acquire" title="Lead intelligence" />
      <Panel>
        <Table
          head={[
            "Seller",
            "Property",
            "Source",
            "Score",
            "Completeness",
            "Stage",
            "ARV",
            "Max offer",
            "Decision",
          ]}
        >
          {leads.map((l) => (
            <tr key={l.id} className="hover:bg-graphite-2/50">
              <td className="px-3 py-2.5">
                <Link href={`/leads/${l.id}`} className="text-arctic hover:text-signal">
                  {l.fullName ?? "Unknown"}
                </Link>
              </td>
              <td className="px-3 py-2.5 text-muted">
                {l.property ? `${l.property.line1}, ${l.property.city} ${l.property.state}` : "—"}
              </td>
              <td className="px-3 py-2.5 text-titanium/80">{title(l.source)}</td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <span className="num mr-2">{l.score}</span>
                <Pill tone={tierTone(l.tier)}>{l.tier}</Pill>
              </td>
              <td className="num px-3 py-2.5 text-muted">{Math.round(l.completeness * 100)}%</td>
              <td className="px-3 py-2.5">
                {l.status === "duplicate" ? <Pill tone="caution">Duplicate</Pill> : title(l.status)}
              </td>
              <td className="num px-3 py-2.5">{usd(l.underwriting?.arv.value)}</td>
              <td className="num px-3 py-2.5">{usd(l.underwriting?.recommendedMaxOffer)}</td>
              <td className="px-3 py-2.5">
                {l.underwriting ? (
                  <Pill tone={decisionTone(l.underwriting.decision)}>
                    {title(l.underwriting.decision)}
                  </Pill>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
