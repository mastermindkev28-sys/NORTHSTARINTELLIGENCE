import Link from 'next/link';
import { notFound } from 'next/navigation';
import { repo } from '@northstar/db';
import { can } from '@northstar/core';
import type { RentalReport, WholesaleDealReport } from '@northstar/underwriting';
import { asTenant } from '@/lib/server/session';
import { setAnalysisStatusAction } from '@/lib/actions/underwriting';
import { PageHeader } from '@/components/page-header';
import { Badge, Button, Panel, Stat } from '@/components/ui';
import { AssumptionsTable, SensitivityGrid, TraceTable, WarningList } from '@/components/underwrite/report-parts';
import { dateTime, money, moneyCompact, pct, ratio } from '@/lib/format';

export const metadata = { title: 'Analysis report' };

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { a, role } = await asTenant(async (tx, s) => ({ a: await repo.getAnalysis(tx, id), role: s.role }));
  if (!a) notFound();

  const statusActions = (
    <div className="flex items-center gap-2">
      <Badge tone={a.status === 'final' ? 'positive' : a.status === 'archived' ? 'neutral' : 'signal'}>{a.status}</Badge>
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
      <div className="mb-4 text-[12px]"><Link href="/app/underwrite" className="text-muted hover:text-titanium">← All analyses</Link></div>
      <PageHeader eyebrow={a.kind === 'rental' ? 'Rental analysis' : 'Wholesale / flip analysis'} title={a.name} description={`Created ${dateTime(a.createdAt)} by ${a.createdByName ?? 'unknown'} · engine v${a.engineVersion} · inputs fingerprint ${a.inputsFingerprint}`} actions={statusActions} />
      {a.status === 'final' && <p className="-mt-4 mb-6 text-[12.5px] text-muted">Finalized analyses are immutable decision records. Inputs and results cannot be changed.</p>}
      {a.kind === 'rental' ? <RentalView r={a.report as RentalReport} /> : <WholesaleView r={a.report as WholesaleDealReport} />}
    </>
  );
}

function Common({ r }: { r: WholesaleDealReport | RentalReport }) {
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Inputs and assumptions" eyebrow="Provenance"><AssumptionsTable groups={r.assumptionsBySource} /></Panel>
        <Panel title="Warnings" eyebrow="Review before acting"><WarningList warnings={r.warnings} /></Panel>
      </div>
      <Panel title="Calculation trace" eyebrow="Every formula, in order" className="mt-6"><TraceTable trace={r.trace} /></Panel>
      <p className="mt-6 max-w-3xl text-[11.5px] leading-relaxed text-muted">{r.disclaimer}</p>
    </>
  );
}

function WholesaleView({ r }: { r: WholesaleDealReport }) {
  const s = r.summary;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel><Stat label="Recommended max offer" value={money(s.recommendedMaxOffer)} tone="signal" sub="Lower of the two methods" /></Panel>
        <Panel><Stat label="ARV" value={money(s.arv)} sub={r.arvAnalysis ? `${r.arvAnalysis.compCount} comps · ${money(r.arvAnalysis.low)}–${money(r.arvAnalysis.high)}` : 'Entered directly'} /></Panel>
        <Panel><Stat label="Buyer margin" value={pct(s.buyerMargin)} tone={s.viableForBuyer ? 'positive' : 'critical'} sub={`${money(s.buyerProjectedProfit)} projected profit`} /></Panel>
        <Panel><Stat label="Your net" value={money(r.assignment.wholesalerNet)} sub={`Fee ${money(s.assignmentFee)} · max ${money(r.assignment.maxSupportableFee)}`} /></Panel>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Offer build-up" eyebrow="Two methods">
          <table className="w-full text-[13px]">
            <tbody className="[&_td]:py-1.5">
              <tr><td className="text-muted">After-repair value</td><td className="num text-right">{money(s.arv)}</td></tr>
              <tr><td className="text-muted">Repairs</td><td className="num text-right">−{money(s.repairCosts)}</td></tr>
              <tr className="border-t border-line"><td className="pt-3 font-medium">Rule-of-thumb MAO</td><td className="num pt-3 text-right">{money(s.maoRuleOfThumb)}</td></tr>
              <tr><td className="text-muted">Buyer acquisition costs</td><td className="num text-right">{money(r.costStack.acquisition)}</td></tr>
              <tr><td className="text-muted">Holding costs</td><td className="num text-right">{money(r.costStack.holding)}</td></tr>
              <tr><td className="text-muted">Financing costs</td><td className="num text-right">{money(r.costStack.financing)}</td></tr>
              <tr><td className="text-muted">Disposition costs</td><td className="num text-right">{money(r.costStack.disposition)}</td></tr>
              <tr><td className="text-muted">Buyer target profit</td><td className="num text-right">{money(r.costStack.targetProfit)}</td></tr>
              <tr className="border-t border-line"><td className="pt-3 font-medium">Cost-stack MAO</td><td className="num pt-3 text-right">{money(s.maoCostStack)}</td></tr>
            </tbody>
          </table>
        </Panel>
        <Panel title="MAO sensitivity" eyebrow="ARV × repairs">
          <SensitivityGrid grid={r.sensitivity} rowLabel="ARV" colLabel="Repairs" format={(v) => moneyCompact(v)} tone={(v) => (v <= 0 ? 'bad' : 'good')} />
          <div className="mt-5 grid grid-cols-3 gap-4 border-t border-line pt-4">
            <Stat label="Buyer all-in" value={money(r.assignment.buyerAllIn)} />
            <Stat label="Buyer ROI on cash" value={pct(r.buyerFlip.returnOnCash)} />
            <Stat label="Annualized" value={pct(r.buyerFlip.annualizedReturnOnCash)} />
          </div>
        </Panel>
      </div>
      {r.arvAnalysis && (
        <Panel title="Comparable sales" eyebrow="ARV derivation">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead><tr className="text-left text-muted"><th className="pb-2 font-normal">Comp</th><th className="pb-2 font-normal">Source</th><th className="pb-2 text-right font-normal">Sale price</th><th className="pb-2 text-right font-normal">Adjustments</th><th className="pb-2 text-right font-normal">Adj. $/sqft</th><th className="pb-2 text-right font-normal">Indicated value</th></tr></thead>
              <tbody>
                {r.arvAnalysis.comps.map((c) => (
                  <tr key={c.id} className="border-t border-line/60"><td className="py-1.5">{c.id}{c.address ? ` · ${c.address}` : ''}</td><td className="py-1.5"><Badge>{c.source.replace(/_/g, ' ')}</Badge></td><td className="num py-1.5 text-right">{money(c.salePrice)}</td><td className="num py-1.5 text-right">{money(c.totalAdjustment)}</td><td className="num py-1.5 text-right">{money(c.adjustedPricePerSqft, true)}</td><td className="num py-1.5 text-right">{money(c.indicatedValue)}</td></tr>
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel><Stat label="Monthly cash flow" value={money(a.monthlyCashFlow)} tone={a.monthlyCashFlow >= 0 ? 'signal' : 'critical'} /></Panel>
        <Panel><Stat label="Cap rate" value={pct(a.capRate, 2)} sub={`NOI ${money(a.netOperatingIncome)}`} /></Panel>
        <Panel><Stat label="Cash-on-cash" value={pct(a.cashOnCash, 2)} sub={`on ${money(a.totalCashInvested)}`} /></Panel>
        <Panel><Stat label="DSCR" value={ratio(a.dscr)} tone={a.dscr === null ? undefined : a.dscr < 1 ? 'critical' : a.dscr < 1.25 ? 'caution' : 'positive'} sub={a.dscr === null ? 'All cash' : `Debt service ${money(a.annualDebtService)}/yr`} /></Panel>
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
            <SensitivityGrid grid={r.sensitivity} rowLabel="Rent" colLabel="Rate" format={(v) => pct(v.cashOnCash)} tone={(v) => ((v.cashOnCash ?? 0) < 0 ? 'bad' : 'good')} />
          </Panel>
        ) : <Panel title="Sensitivity" eyebrow="All-cash"><p className="text-[13px] text-muted">Rate sensitivity applies to financed purchases only.</p></Panel>}
      </div>
      {r.projection && (
        <Panel title={`${r.projection.years.length}-year projection`} eyebrow={`IRR ${pct(r.projection.irr)} · equity multiple ${ratio(r.projection.equityMultiple)} · net sale ${money(r.projection.netSaleProceeds)}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[12.5px]">
              <thead><tr className="text-left text-muted">{['Year', 'EGI', 'OpEx', 'NOI', 'Debt service', 'Cash flow', 'Value', 'Loan', 'Equity'].map((h) => <th key={h} className="pb-2 text-right font-normal first:text-left">{h}</th>)}</tr></thead>
              <tbody>{r.projection.years.map((y) => (
                <tr key={y.year} className="border-t border-line/60"><td className="num py-1.5">{y.year}</td>{[y.effectiveGrossIncome, y.operatingExpenses, y.netOperatingIncome, y.debtService, y.cashFlow, y.propertyValue, y.loanBalance, y.equity].map((v, i) => <td key={i} className="num py-1.5 text-right">{money(v)}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        </Panel>
      )}
      <Common r={r} />
    </div>
  );
}
