'use client';

import { useMemo, useState, useTransition } from 'react';
import { buildRentalReport, UnderwritingInputError, type InputSource, type RentalReport } from '@northstar/underwriting';
import { fieldErrors, rentalFormSchema, toRentalReportInput } from '@northstar/core/validation';
import { saveAnalysisAction } from '@/lib/actions/underwriting';
import { Badge, Button, Field, Input, Panel, Stat, cx } from '@/components/ui';
import { money, pct, ratio } from '@/lib/format';
import { NumberField } from './number-field';
import { SourceSelect } from './source-select';
import { SensitivityGrid, WarningList } from './report-parts';

type N = number | '';

interface State {
  name: string;
  price: N; priceSource: InputSource;
  rents: N[]; rentSource: InputSource;
  vacancyPct: N; annualPropertyTax: N; annualInsurance: N;
  managementPct: N; maintenancePct: N; capexPct: N; monthlyHoa: N;
  closingCosts: N; initialRepairs: N;
  financing: 'cash' | 'loan';
  downPaymentPct: N; ratePct: N; termYears: N; interestOnly: boolean; pointsPct: N;
  projectionYears: N; rentGrowthPct: N; expenseGrowthPct: N; appreciationPct: N;
}

const INITIAL: State = {
  name: '', price: '', priceSource: 'user_assumption', rents: [''], rentSource: 'user_assumption',
  vacancyPct: 5, annualPropertyTax: '', annualInsurance: '', managementPct: 8, maintenancePct: 5, capexPct: 5, monthlyHoa: 0,
  closingCosts: 0, initialRepairs: 0,
  financing: 'loan', downPaymentPct: 25, ratePct: 7, termYears: 30, interestOnly: false, pointsPct: 0,
  projectionYears: 10, rentGrowthPct: 3, expenseGrowthPct: 3, appreciationPct: 3,
};

const u = (v: N) => (v === '' ? undefined : v);

export function RentalCalculator({ canSave }: { canSave: boolean }) {
  const [s, setS] = useState<State>(INITIAL);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));

  const payload = useMemo(() => ({
    name: s.name || 'Untitled rental analysis',
    purchasePrice: { value: u(s.price), source: s.priceSource },
    monthlyRents: s.rents.map(u),
    rentSource: s.rentSource,
    vacancyPct: u(s.vacancyPct), annualPropertyTax: u(s.annualPropertyTax), annualInsurance: u(s.annualInsurance),
    managementPct: u(s.managementPct), maintenancePct: u(s.maintenancePct), capexPct: u(s.capexPct), monthlyHoa: u(s.monthlyHoa),
    closingCosts: u(s.closingCosts), initialRepairs: u(s.initialRepairs),
    financing: s.financing === 'cash' ? { type: 'cash' } : { type: 'loan', downPaymentPct: u(s.downPaymentPct), annualInterestRatePct: u(s.ratePct), termYears: u(s.termYears), interestOnly: s.interestOnly, pointsPct: u(s.pointsPct) },
    projection: { years: u(s.projectionYears), rentGrowthPct: u(s.rentGrowthPct), expenseGrowthPct: u(s.expenseGrowthPct), appreciationPct: u(s.appreciationPct) },
  }), [s]);

  const result = useMemo((): { report: RentalReport | null; errors: Record<string, string> } => {
    const parsed = rentalFormSchema.safeParse(payload);
    if (!parsed.success) return { report: null, errors: fieldErrors(parsed.error) };
    try {
      return { report: buildRentalReport(toRentalReportInput(parsed.data)), errors: {} };
    } catch (e) {
      if (e instanceof UnderwritingInputError) return { report: null, errors: { [e.field]: e.message } };
      throw e;
    }
  }, [payload]);

  const touched = s.price !== '' || s.rents.some((r) => r !== '');
  const err = (k: string) => (touched ? result.errors[k] : undefined);
  const r = result.report;
  const a = r?.analysis;

  const save = () => {
    setServerError(null);
    startSaving(async () => {
      const res = await saveAnalysisAction('rental', payload);
      if (res?.error) setServerError(res.error);
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-6">
        <Panel title="Property and income" eyebrow="Revenue">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Analysis name" htmlFor="rname"><Input id="rname" value={s.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. 18 Oak Duplex" maxLength={200} /></Field>
            <NumberField id="price" label="Purchase price" prefix="$" value={s.price} onChange={(v) => set('price', v)} error={err('purchasePrice.value')} right={<SourceSelect label="Price" value={s.priceSource} onChange={(v) => set('priceSource', v)} />} />
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-medium text-muted">Monthly rent by unit</span>
              <SourceSelect label="Rents" value={s.rentSource} onChange={(v) => set('rentSource', v)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {s.rents.map((rent, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input aria-label={`Unit ${i + 1} rent`} type="number" value={rent} onChange={(e) => setS((p) => ({ ...p, rents: p.rents.map((x, j) => (j === i ? (e.target.value === '' ? '' : Number(e.target.value)) : x)) }))} />
                  {s.rents.length > 1 && <button aria-label={`Remove unit ${i + 1}`} className="px-1 text-muted hover:text-critical" onClick={() => setS((p) => ({ ...p, rents: p.rents.filter((_, j) => j !== i) }))}>×</button>}
                </div>
              ))}
              <Button variant="secondary" onClick={() => setS((p) => ({ ...p, rents: [...p.rents, ''] }))}>Add unit</Button>
            </div>
            {err('monthlyRents.0') && <p className="mt-1 text-[12px] text-critical">{err('monthlyRents.0')}</p>}
          </div>
        </Panel>

        <Panel title="Operating expenses" eyebrow="Expenses">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField id="vac" label="Vacancy & credit loss" suffix="%" value={s.vacancyPct} onChange={(v) => set('vacancyPct', v)} />
            <NumberField id="rtax" label="Annual property tax" prefix="$" value={s.annualPropertyTax} onChange={(v) => set('annualPropertyTax', v)} error={err('annualPropertyTax')} />
            <NumberField id="rins" label="Annual insurance" prefix="$" value={s.annualInsurance} onChange={(v) => set('annualInsurance', v)} error={err('annualInsurance')} />
            <NumberField id="hoa" label="Monthly HOA" prefix="$" value={s.monthlyHoa} onChange={(v) => set('monthlyHoa', v)} />
            <NumberField id="mgmt" label="Management" suffix="% EGI" value={s.managementPct} onChange={(v) => set('managementPct', v)} />
            <NumberField id="maint" label="Maintenance reserve" suffix="% GPR" value={s.maintenancePct} onChange={(v) => set('maintenancePct', v)} />
            <NumberField id="capex" label="CapEx reserve" suffix="% GPR" value={s.capexPct} onChange={(v) => set('capexPct', v)} />
          </div>
        </Panel>

        <Panel
          title="Acquisition and financing"
          eyebrow="Capital"
          actions={
            <div className="flex rounded-md border border-line p-0.5 text-[12px]" role="tablist" aria-label="Financing">
              {(['loan', 'cash'] as const).map((m) => (
                <button key={m} role="tab" aria-selected={s.financing === m} onClick={() => set('financing', m)} className={cx('rounded px-2.5 py-1', s.financing === m ? 'bg-graphite-2 text-titanium' : 'text-muted')}>{m === 'loan' ? 'Financed' : 'All cash'}</button>
              ))}
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField id="close" label="Closing costs" prefix="$" value={s.closingCosts} onChange={(v) => set('closingCosts', v)} />
            <NumberField id="rep" label="Initial repairs" prefix="$" value={s.initialRepairs} onChange={(v) => set('initialRepairs', v)} />
            {s.financing === 'loan' && (
              <>
                <NumberField id="down" label="Down payment" suffix="%" value={s.downPaymentPct} onChange={(v) => set('downPaymentPct', v)} />
                <NumberField id="rrate" label="Interest rate" suffix="%" value={s.ratePct} onChange={(v) => set('ratePct', v)} error={err('financing.annualInterestRatePct')} />
                <NumberField id="term" label="Term" suffix="yrs" value={s.termYears} onChange={(v) => set('termYears', v)} />
                <NumberField id="rpts" label="Points" suffix="%" value={s.pointsPct} onChange={(v) => set('pointsPct', v)} />
                <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-muted"><input type="checkbox" className="accent-signal" checked={s.interestOnly} onChange={(e) => set('interestOnly', e.target.checked)} /> Interest-only</label>
              </>
            )}
          </div>
        </Panel>

        <Panel title="Projection assumptions" eyebrow="Hold period">
          <div className="grid gap-4 sm:grid-cols-4">
            <NumberField id="yrs" label="Years" value={s.projectionYears} onChange={(v) => set('projectionYears', v)} />
            <NumberField id="rg" label="Rent growth" suffix="%/yr" value={s.rentGrowthPct} onChange={(v) => set('rentGrowthPct', v)} />
            <NumberField id="eg" label="Expense growth" suffix="%/yr" value={s.expenseGrowthPct} onChange={(v) => set('expenseGrowthPct', v)} />
            <NumberField id="ap" label="Appreciation" suffix="%/yr" value={s.appreciationPct} onChange={(v) => set('appreciationPct', v)} />
          </div>
        </Panel>
      </div>

      <div className="xl:sticky xl:top-20 xl:self-start">
        <Panel title="Live result" eyebrow="Deterministic engine" actions={a ? <Badge tone={a.annualCashFlow >= 0 ? 'positive' : 'critical'}>{a.annualCashFlow >= 0 ? 'Cash flow positive' : 'Negative cash flow'}</Badge> : <Badge>Awaiting inputs</Badge>}>
          {r && a ? (
            <div className="flex flex-col gap-5">
              <Stat label="Monthly cash flow" value={money(a.monthlyCashFlow)} tone={a.monthlyCashFlow >= 0 ? 'signal' : 'critical'} sub={`${money(a.annualCashFlow)} per year, pre-tax`} />
              <div className="grid grid-cols-2 gap-4 border-t border-line pt-4">
                <Stat label="NOI" value={money(a.netOperatingIncome)} />
                <Stat label="Cap rate" value={pct(a.capRate, 2)} />
                <Stat label="Cash-on-cash" value={pct(a.cashOnCash, 2)} />
                <Stat label="DSCR" value={ratio(a.dscr)} tone={a.dscr === null ? undefined : a.dscr < 1 ? 'critical' : a.dscr < 1.25 ? 'caution' : 'positive'} />
                <Stat label="Cash invested" value={money(a.totalCashInvested)} />
                <Stat label="Break-even occ." value={pct(a.breakEvenOccupancy)} />
                {r.projection && <Stat label={`IRR (${r.projection.years.length} yr)`} value={pct(r.projection.irr, 1)} />}
                {r.projection && <Stat label="Equity multiple" value={ratio(r.projection.equityMultiple)} />}
              </div>
              <WarningList warnings={r.warnings.filter((w) => w.code !== 'projection_assumptions')} limit={5} />
              {r.sensitivity && (
                <div className="border-t border-line pt-4">
                  <div className="eyebrow mb-2">Cash-on-cash · rent × rate</div>
                  <SensitivityGrid grid={r.sensitivity} rowLabel="Rent" colLabel="Rate" format={(v) => pct(v.cashOnCash)} tone={(v) => ((v.cashOnCash ?? 0) < 0 ? 'bad' : 'good')} />
                </div>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-muted">Enter a purchase price, rents, property tax, and insurance to see the analysis.</p>
          )}
          <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4">
            {serverError && <p role="alert" className="text-[12.5px] text-critical">{serverError}</p>}
            <Button onClick={save} disabled={!r || !canSave || saving} className="w-full">{saving ? 'Saving…' : 'Save analysis'}</Button>
            {!canSave && <p className="text-[11.5px] text-muted">Your role can run analyses but not save them.</p>}
            <p className="text-[11px] leading-relaxed text-muted/80">{r?.disclaimer}</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
