import Link from 'next/link';
import { notFound } from 'next/navigation';
import { repo } from '@northstar/db';
import { can } from '@northstar/core';
import type { RentalReport, WholesaleDealReport } from '@northstar/underwriting';
import { asTenant } from '@/lib/server/session';
import { setAnalysisStatusAction } from '@/lib/actions/underwriting';
import { MetaItem, PageHeader } from '@/components/page-header';
import { Badge, Button, KpiCard, Panel, Stat } from '@/components/ui';
import { IconArrowRight, IconLock } from '@/components/icons';
import { AssumptionsTable, OfferWaterfall, SensitivityGrid, TraceTable, WarningList } from '@/components/underwrite/report-parts';
import { dateTime, money, moneyCompact, pct, ratio } from '@/lib/format';

export const metadata = { title: 'Analysis report' };

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { a, role } = await asTenant(async (tx, s) => ({ a: await repo.getAnalysis(tx, id), role: s.role }));
  if (!a) notFound();

  const statusActions = (
    <div className="flex items-center gap-2">
      <Badge dot tone={a.status === 'final' ? 'positive' : a.status === 'archived' ? 'neutral' : 'signal'}>{a.status}</Badge>
      {a.status === 'draft' && can(role, 'underwriting.finalize') && (
        <form action={setAnalysisStatusAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="final" /><Button type="submit" variant="secondary">Finalize</Button></form>
      )}
      {a.status !== 'archived' && can(role, 'underwriting.save') && (
        <form action={setAnalysisStatusAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="archived" /><Button type="submit" variant="ghost">Archive</Button></form>
      )}
    </div>
  );

  return (
    <>
      <div className="mb-5 text-[12px]"><Link href="/app/underwrite" className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-titanium"><span className="rotate-180"><IconArrowRight size={12} /></span>All analyses</Link></div>
      <PageHeader
        eyebrow={a.kind === 'rental' ? '03 · Rental analysis report' : '03 · Wholesale / flip analysis report'}
        title={a.name}
        meta={<><MetaItem label="Created">{dateTime(a.createdAt)}</MetaItem><MetaItem label="Analyst">{a.createdByName ?? 'unknown'}</MetaItem><MetaItem label="Engine">v{a.engineVersion}</MetaItem><MetaItem label="Fingerprint">{a.inputsFingerprint}</MetaItem></>}
        actions={statusActions}
      />
      {a.status === 'final' && <div className="-mt-3 mb-6 flex items-center gap-2.5 rounded-lg border border-positive/25 bg-positive/[0.06] px-3.5 py-2.5 text-[12.5px] text-positive"><IconLock size={14} />Finalized analyses are immutable decision records. Inputs and results cannot be changed.</div>}
      {a.kind === 'rental' ? <RentalView r={a.report as RentalReport} /> : <WholesaleView r={a.report as WholesaleDealReport} />}
    </>
  );
}

function Common({ r }: { r: WholesaleDealReport | RentalReport }) {
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel flush title="Inputs and assumptions" eyebrow="Provenance"><AssumptionsTable groups={r.assumptionsBySource} /></Panel>
        <Panel title="Warnings" eyebrow="Review before acting"><WarningList warnings={r.warnings} /></Panel>
      </div>
      <Panel title="Calculation trace" eyebrow="Every formula, in order" actions={<Badge tone="signal">{r.trace.length} steps</Badge>} className="mt-6"><TraceTable trace={r.trace} /></Panel>
      <p className="mt-6 max-w-3xl text-[11px] leading-relaxed text-faint">{r.disclaimer}</p>
    </>
  );
}

function WholesaleView({ r }: { r: WholesaleDealReport }) {
  const s = r.summary;
  return (
    <div className="flex flex-col gap-6">
      <div className="stagger grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <section className="panel panel-accent glow-signal relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-signal/20 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <Stat size="xl" label="Recommended max offer" value={money(s.recommendedMaxOffer)} tone="signal" sub="Lower of the two methods" />
            <Badge dot tone={s.viableForBuyer ? 'positive' : 'critical'}>{s.viableForBuyer ? 'Buyer viable' : 'Not viable'}</Badge>
          </div>
          <div className="relative mt-4 flex gap-4 border-t border-line/70 pt-3 text-[11.5px]">
            <span className="text-muted">Rule of thumb <span className="num ml-1 text-titanium">{money(s.maoRuleOfThumb)}</span></span>
            <span className="text-muted">Cost stack <span className="num ml-1 text-titanium">{money(s.maoCostStack)}</span></span>
          </div>
        </section>
        <KpiCard label="ARV" value={money(s.arv)} sub={r.arvAnalysis ? `${r.arvAnalysis.compCount} comps · ${money(r.arvAnalysis.low)}–${money(r.arvAnalysis.high)}` : 'Entered directly'} />
        <KpiCard label="Buyer margin" value={pct(s.buyerMargin)} tone={s.viableForBuyer ? 'positive' : 'critical'} sub={`${money(s.buyerProjectedProfit)} projected profit`} />
        <KpiCard label="Your net" value={money(r.assignment.wholesalerNet)} tone="positive" sub={`Fee ${money(s.assignmentFee)} · max ${money(r.assignment.maxSupportableFee)}`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel code="A" title="Offer build-up" eyebrow="Two methods">
          <div className="eyebrow mb-3 text-[9.5px]">Rule of thumb · {money(s.arv)} × multiplier − repairs − fee</div>
          <OfferWaterfall arv={s.arv} steps={[{ label: 'Repairs', value: s.repairCosts }, { label: 'Discount + fee', value: Math.max(0, s.arv - s.repairCosts - s.maoRuleOfThumb) }]} result={s.maoRuleOfThumb} resultLabel="Rule-of-thumb MAO" />
          <div className="eyebrow mb-3 mt-6 text-[9.5px]">Cost stack · what the end buyer must pay out</div>
          <OfferWaterfall
            arv={s.arv}
            steps={[
              { label: 'Repairs', value: s.repairCosts },
              { label: 'Buyer acquisition', value: r.costStack.acquisition },
              { label: 'Holding', value: r.costStack.holding },
              { label: 'Financing', value: r.costStack.financing },
              { label: 'Disposition', value: r.costStack.disposition },
              { label: 'Buyer target profit', value: r.costStack.targetProfit },
              { label: 'Fee and other', value: Math.max(0, s.arv - s.repairCosts - r.costStack.acquisition - r.costStack.holding - r.costStack.financing - r.costStack.disposition - r.costStack.targetProfit - s.maoCostStack) },
            ]}
            result={s.maoCostStack}
            resultLabel="Cost-stack MAO"
          />
        </Panel>
        <Panel code="B" title="MAO sensitivity" eyebrow="ARV × repairs">
          <SensitivityGrid grid={r.sensitivity} rowLabel="ARV" colLabel="Repairs" format={(v) => moneyCompact(v)} tone={(v) => (v <= 0 ? 'bad' : 'good')} value={(v) => v} />
          <div className="mt-5 grid grid-cols-3 gap-4 border-t border-line pt-4">
            <Stat label="Buyer all-in" value={money(r.assignment.buyerAllIn)} />
            <Stat label="Buyer ROI on cash" value={pct(r.buyerFlip.returnOnCash)} tone="positive" />
            <Stat label="Annualized" value={pct(r.buyerFlip.annualizedReturnOnCash)} />
          </div>
        </Panel>
      </div>
      {r.arvAnalysis && (
        <Panel flush title="Comparable sales" eyebrow="ARV derivation">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[640px] text-[12.5px]">
              <thead><tr className="text-left"><th>Comp</th><th>Source</th><th className="text-right">Sale price</th><th className="text-right">Adjustments</th><th className="text-right">Adj. $/sqft</th><th className="text-right">Indicated value</th></tr></thead>
              <tbody>
                {r.arvAnalysis.comps.map((c) => (
                  <tr key={c.id}><td>{c.id}{c.address ? ` · ${c.address}` : ''}</td><td><Badge>{c.source.replace(/_/g, ' ')}</Badge></td><td className="num text-right">{money(c.salePrice)}</td><td className="num text-right">{money(c.totalAdjustment)}</td><td className="num text-right">{money(c.adjustedPricePerSqft, true)}</td><td className="num text-right text-arctic">{money(c.indicatedValue)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <Common r={r} />
    </div>
  );
}

function RentalView({ r }: { r: RentalReport }) {
  const a = r.analysis;
  return (
    <div className="flex flex-col gap-6">
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard accent label="Monthly cash flow" value={money(a.monthlyCashFlow)} tone={a.monthlyCashFlow >= 0 ? 'signal' : 'critical'} sub={`${money(a.annualCashFlow)} per year`} trend={r.projection ? r.projection.years.map((y) => y.cashFlow) : undefined} />
        <KpiCard label="Cap rate" value={pct(a.capRate, 2)} sub={`NOI ${money(a.netOperatingIncome)}`} />
        <KpiCard label="Cash-on-cash" value={pct(a.cashOnCash, 2)} sub={`on ${money(a.totalCashInvested)}`} />
        <KpiCard label="DSCR" value={ratio(a.dscr)} tone={a.dscr === null ? undefined : a.dscr < 1 ? 'critical' : a.dscr < 1.25 ? 'caution' : 'positive'} sub={a.dscr === null ? 'All cash' : `Debt service ${money(a.annualDebtService)}/yr`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Operating statement" eyebrow="Year 1">
          <table className="w-full text-[13px]"><tbody className="[&_td]:py-1.5">
            <tr><td className="text-muted">Gross potential rent</td><td className="num text-right">{money(a.grossPotentialRent)}</td></tr>
            <tr><td className="text-muted">Vacancy & credit loss</td><td className="num text-right">−{money(a.vacancyLoss)}</td></tr>
            <tr className="border-t border-line"><td className="pt-3 font-medium">Effective gross income</td><td className="num pt-3 text-right">{money(a.effectiveGrossIncome)}</td></tr>
            {Object.entries(a.expenseBreakdown).filter(([, v]) => v > 0).map(([k, v]) => <tr key={k}><td className="capitalize text-muted">{k.replace(/([A-Z])/g, ' $1')}</td><td className="num text-right">−{money(v)}</td></tr>)}
            <tr className="border-t border-line"><td className="pt-3 font-medium">Net operating income</td><td className="num pt-3 text-right">{money(a.netOperatingIncome)}</td></tr>
            <tr><td className="text-muted">Debt service</td><td className="num text-right">−{money(a.annualDebtService)}</td></tr>
            <tr className="border-t border-line"><td className="pt-3 font-medium">Pre-tax cash flow</td><td className="num pt-3 text-right">{money(a.annualCashFlow)}</td></tr>
          </tbody></table>
        </Panel>
        {r.sensitivity ? (
          <Panel title="Cash-on-cash sensitivity" eyebrow="Rent × interest rate">
            <SensitivityGrid grid={r.sensitivity} rowLabel="Rent" colLabel="Rate" format={(v) => pct(v.cashOnCash)} tone={(v) => ((v.cashOnCash ?? 0) < 0 ? 'bad' : 'good')} value={(v) => v.cashOnCash} />
          </Panel>
        ) : <Panel title="Sensitivity" eyebrow="All-cash"><p className="text-[13px] text-muted">Rate sensitivity applies to financed purchases only.</p></Panel>}
      </div>
      {r.projection && (
        <Panel flush title={`${r.projection.years.length}-year projection`} eyebrow={`IRR ${pct(r.projection.irr)} · equity multiple ${ratio(r.projection.equityMultiple)} · net sale ${money(r.projection.netSaleProceeds)}`}>
          <div className="overflow-x-auto">
            <table className="data-table compact min-w-[720px] text-[12.5px]">
              <thead><tr className="text-left">{['Year', 'EGI', 'OpEx', 'NOI', 'Debt service', 'Cash flow', 'Value', 'Loan', 'Equity'].map((h) => <th key={h} className="text-right first:text-left">{h}</th>)}</tr></thead>
              <tbody>{r.projection.years.map((y) => (
                <tr key={y.year}><td className="num text-faint">{String(y.year).padStart(2, '0')}</td>{[y.effectiveGrossIncome, y.operatingExpenses, y.netOperatingIncome, y.debtService, y.cashFlow, y.propertyValue, y.loanBalance, y.equity].map((v, i) => <td key={i} className={`num text-right ${i === 4 ? (v >= 0 ? 'text-positive' : 'text-critical') : i === 7 ? 'text-arctic' : ''}`}>{money(v)}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        </Panel>
      )}
      <Common r={r} />
    </div>
  );
}
