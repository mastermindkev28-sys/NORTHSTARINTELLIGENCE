import { CATEGORY_LABELS, METHODOLOGY_VERSION, METRICS, RISK_THRESHOLDS, SOURCES, getSource } from '@northstar/market';
import { env } from '@/lib/server/env';
import { PageHeader } from '@/components/page-header';
import { Badge, Panel } from '@/components/ui';
import { MarketTabs, formatMetric } from '@/components/market/parts';

export const metadata = { title: 'Sources and methodology' };

const STATUS_TONE = { live: 'positive', planned: 'neutral', demo_only: 'caution' } as const;

export default function SourcesAndMethod() {
  return (
    <>
      <PageHeader eyebrow={`02 · Market Intelligence · ${METHODOLOGY_VERSION}`} title="Sources and methodology" description="Where every number comes from, how it becomes a score, and the guardrails that keep scoring transparent and fair." />
      <MarketTabs active="sources" />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel eyebrow="1" title="From value to score">
          <ol className="flex list-decimal flex-col gap-2 pl-4 text-[12.5px] text-muted">
            <li>Each variable maps onto 0–100 from a published reference range (or a percentile within your comparison set).</li>
            <li>Category score = weighted mean of its variables (catalog weight × strategy emphasis).</li>
            <li>Market Score = weighted mean of six categories using the active profile.</li>
            <li>Confidence = source quality × freshness × geographic resolution × reporting coverage.</li>
          </ol>
        </Panel>
        <Panel eyebrow="2" title="Missing data">
          <ul className="flex flex-col gap-2 text-[12.5px] text-muted">
            <li>A missing variable is filled at the lower of 50 and the observed category mean, so a gap can never lift a score.</li>
            <li>Below 60% coverage a category shows &ldquo;insufficient data&rdquo;; below 60% overall the Market Score is withheld.</li>
            <li>Missing crime data is never read as safe.</li>
          </ul>
        </Panel>
        <Panel eyebrow="3" title="Guardrails">
          <ul className="flex flex-col gap-2 text-[12.5px] text-muted">
            <li>Race, ethnicity, national origin, religion, sex, familial status, disability, age and proxies are excluded. Only allow-listed metrics can be scored; the database rejects protected names too.</li>
            <li>Public safety is aggregate only, never shown on a property, never for tenant screening.</li>
            <li>Hazard scores do not replace insurance quotes or inspections. Assessed value is never market value.</li>
          </ul>
        </Panel>
      </div>

      <Panel className="mt-6" eyebrow={`Active source: ${env.marketDataSource === 'db' ? 'database reference tables' : 'bundled demo dataset + cited pilot law'}`} title="Data sources">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[12.5px]">
            <thead><tr className="text-left text-[11px] text-muted"><th className="pb-2 font-normal">Source</th><th className="pb-2 font-normal">Agency</th><th className="pb-2 font-normal">Cadence</th><th className="pb-2 font-normal">Access</th><th className="pb-2 font-normal">Caveats</th><th className="pb-2 font-normal">Connector</th></tr></thead>
            <tbody>
              {SOURCES.map((s) => (
                <tr key={s.id} className="border-t border-line align-top">
                  <td className="py-2"><a href={s.url} target="_blank" rel="noreferrer" className="hover:text-signal">{s.name}</a><div className="text-[11px] text-muted">{s.class}</div></td>
                  <td className="py-2 text-muted">{s.agency}</td>
                  <td className="py-2 text-muted">{s.cadence}</td>
                  <td className="py-2 text-muted">{s.access}</td>
                  <td className="py-2 text-[11.5px] text-muted">{s.caveats}</td>
                  <td className="py-2"><Badge tone={STATUS_TONE[s.status]}>{s.status.replace('_', ' ')}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="mt-6" eyebrow="Allow-list" title="Metric catalog">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[12.5px]">
            <thead><tr className="text-left text-[11px] text-muted"><th className="pb-2 font-normal">Variable</th><th className="pb-2 font-normal">Category</th><th className="pb-2 font-normal">Worst → best (0 → 100)</th><th className="pb-2 font-normal">Fresh for</th><th className="pb-2 font-normal">Sources</th><th className="pb-2 font-normal">Definition</th></tr></thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.key} className="border-t border-line align-top">
                  <td className="py-2">{m.label}</td>
                  <td className="py-2 text-muted">{CATEGORY_LABELS[m.category]}</td>
                  <td className="num py-2 text-muted">{formatMetric(m.reference[0], m.unit)} → {formatMetric(m.reference[1], m.unit)}</td>
                  <td className="num py-2 text-muted">{m.freshnessDays} d</td>
                  <td className="py-2 text-[11.5px] text-muted">{m.sources.map((s) => getSource(s)?.name ?? s).join(', ')}</td>
                  <td className="py-2 text-[11.5px] text-muted">{m.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="mt-6" eyebrow="Never averaged into the score" title="Risk flag thresholds">
        <table className="w-full text-[12.5px]">
          <thead><tr className="text-left text-[11px] text-muted"><th className="pb-2 font-normal">Flag</th><th className="pb-2 font-normal">Caution</th><th className="pb-2 font-normal">Critical</th></tr></thead>
          <tbody>
            {RISK_THRESHOLDS.map((t) => (
              <tr key={t.code} className="border-t border-line">
                <td className="py-2">{t.title}</td>
                <td className="num py-2 text-muted">{t.direction === 'above' ? '≥' : '≤'} {t.caution}</td>
                <td className="num py-2 text-muted">{t.critical === undefined ? '—' : `${t.direction === 'above' ? '≥' : '≤'} ${t.critical}`}</td>
              </tr>
            ))}
            <tr className="border-t border-line"><td className="py-2">Inexpensive but exposed</td><td className="py-2 text-muted" colSpan={2}>Affordability ≥ 65 and environmental risk ≤ 40 → critical</td></tr>
          </tbody>
        </table>
      </Panel>
    </>
  );
}
