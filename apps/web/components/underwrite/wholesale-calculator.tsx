'use client';

import { useMemo, useState, useTransition } from 'react';
import { buildWholesaleDealReport, UnderwritingInputError, type InputSource, type WholesaleDealReport } from '@northstar/underwriting';
import { fieldErrors, toWholesaleDealInput, wholesaleFormSchema } from '@northstar/core/validation';
import { saveAnalysisAction } from '@/lib/actions/underwriting';
import { Badge, Button, Field, Input, Meter, Panel, Segmented, Stat, StatusDot, cx } from '@/components/ui';
import { money, moneyCompact, pct } from '@/lib/format';
import { NumberField } from './number-field';
import { SourceSelect } from './source-select';
import { SensitivityGrid, WarningList } from './report-parts';

type N = number | '';
interface CompRow { id: string; address: string; salePrice: N; squareFeet: N; saleDate: string; distanceMiles: N; netAdjustment: N; source: InputSource }

interface State {
  name: string;
  address: string;
  arvMode: 'direct' | 'comps';
  arv: N; arvSource: InputSource; arvRef: string;
  subjectSquareFeet: N; subjectSqftSource: InputSource;
  valuationDate: string;
  comps: CompRow[];
  repairs: N; repairsSource: InputSource; repairsRef: string;
  contractPrice: N;
  assignmentFee: N;
  arvMultiplierPct: N;
  wholesalerCosts: N;
  buyer: {
    acquisitionClosingPct: N; holdingMonths: N; annualPropertyTax: N; annualInsurance: N; monthlyUtilities: N;
    loanToValuePct: N; financeRehab: boolean; annualInterestRatePct: N; pointsPct: N;
    commissionPct: N; sellerClosingPct: N; targetProfitPct: N;
  };
}

const today = () => new Date().toISOString().slice(0, 10);
const emptyComp = (i: number): CompRow => ({ id: `C${i}`, address: '', salePrice: '', squareFeet: '', saleDate: '', distanceMiles: '', netAdjustment: 0, source: 'user_assumption' });

const INITIAL: State = {
  name: '', address: '',
  arvMode: 'direct', arv: '', arvSource: 'user_assumption', arvRef: '',
  subjectSquareFeet: '', subjectSqftSource: 'user_assumption', valuationDate: today(),
  comps: [emptyComp(1), emptyComp(2), emptyComp(3)],
  repairs: '', repairsSource: 'user_assumption', repairsRef: '',
  contractPrice: '', assignmentFee: 10000, arvMultiplierPct: 70, wholesalerCosts: 0,
  buyer: {
    acquisitionClosingPct: 1.5, holdingMonths: 6, annualPropertyTax: '', annualInsurance: '', monthlyUtilities: 200,
    loanToValuePct: 0, financeRehab: false, annualInterestRatePct: 11, pointsPct: 2,
    commissionPct: 5, sellerClosingPct: 1, targetProfitPct: 10,
  },
};

const opt = (v: N) => (v === '' ? undefined : v);

function toPayload(s: State) {
  const comps = s.arvMode === 'comps'
    ? s.comps.filter((c) => c.salePrice !== '' && c.squareFeet !== '').map((c) => ({
        id: c.id, address: c.address || undefined, salePrice: c.salePrice, squareFeet: c.squareFeet,
        saleDate: c.saleDate || undefined, distanceMiles: opt(c.distanceMiles), netAdjustment: c.netAdjustment === '' ? 0 : c.netAdjustment, source: c.source,
      }))
    : [];
  return {
    name: s.name || 'Untitled analysis',
    address: s.address || undefined,
    subjectSquareFeet: opt(s.subjectSquareFeet),
    subjectSquareFeetSource: s.subjectSqftSource,
    arv: s.arvMode === 'direct' && s.arv !== '' ? { value: s.arv, source: s.arvSource, sourceRef: s.arvRef || undefined } : undefined,
    comps,
    valuationDate: s.valuationDate || undefined,
    repairs: { value: s.repairs === '' ? undefined : s.repairs, source: s.repairsSource, sourceRef: s.repairsRef || undefined },
    contractPrice: opt(s.contractPrice),
    assignmentFee: s.assignmentFee === '' ? undefined : s.assignmentFee,
    arvMultiplierPct: opt(s.arvMultiplierPct),
    wholesalerCosts: opt(s.wholesalerCosts),
    buyer: Object.fromEntries(Object.entries(s.buyer).map(([k, v]) => [k, v === '' ? undefined : v])),
  };
}

export function WholesaleCalculator({ canSave }: { canSave: boolean }) {
  const [s, setS] = useState<State>(INITIAL);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));
  const setB = <K extends keyof State['buyer']>(k: K, v: State['buyer'][K]) => setS((p) => ({ ...p, buyer: { ...p.buyer, [k]: v } }));
  const setComp = (i: number, patch: Partial<CompRow>) => setS((p) => ({ ...p, comps: p.comps.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  const payload = useMemo(() => toPayload(s), [s]);
  const result = useMemo((): { report: WholesaleDealReport | null; errors: Record<string, string> } => {
    const parsed = wholesaleFormSchema.safeParse(payload);
    if (!parsed.success) return { report: null, errors: fieldErrors(parsed.error) };
    try {
      return { report: buildWholesaleDealReport(toWholesaleDealInput(parsed.data)), errors: {} };
    } catch (e) {
      if (e instanceof UnderwritingInputError) return { report: null, errors: { [e.field]: e.message } };
      throw e;
    }
  }, [payload]);

  const errors = { ...result.errors, ...serverErrors };
  const touched = s.arv !== '' || s.repairs !== '' || s.comps.some((c) => c.salePrice !== '');
  const err = (k: string) => (touched ? errors[k] : undefined);
  const r = result.report;

  const save = () => {
    setServerError(null);
    startSaving(async () => {
      const res = await saveAnalysisAction('wholesale_deal', payload);
      if (res) {
        setServerErrors(res.fields ?? {});
        setServerError(res.error ?? null);
      }
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex flex-col gap-6">
        <Panel code="01" title="Deal" eyebrow="Identification">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Analysis name" htmlFor="name" error={err('name')}>
              <Input id="name" value={s.name} placeholder="e.g. 412 Maple Ave" onChange={(e) => set('name', e.target.value)} maxLength={200} />
            </Field>
            <Field label="Property address (optional)" htmlFor="address">
              <Input id="address" value={s.address} onChange={(e) => set('address', e.target.value)} maxLength={200} />
            </Field>
          </div>
        </Panel>

        <Panel
          code="02"
          title="After-repair value"
          eyebrow="Valuation"
          actions={<Segmented label="ARV method" value={s.arvMode} onChange={(v) => set('arvMode', v)} options={[{ value: 'direct', label: 'Enter ARV' }, { value: 'comps', label: 'From comps' }]} />}
        >
          {s.arvMode === 'direct' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField id="arv" label="ARV" prefix="$" value={s.arv} onChange={(v) => set('arv', v)} error={err('arv') ?? err('arv.value')} right={<SourceSelect label="ARV" value={s.arvSource} onChange={(v) => set('arvSource', v)} />} />
              <Field label="Source reference" htmlFor="arvRef" hint="e.g. appraisal, AVM name, broker opinion">
                <Input id="arvRef" value={s.arvRef} onChange={(e) => set('arvRef', e.target.value)} maxLength={200} />
              </Field>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField id="sqft" label="Subject living area" suffix="sqft" value={s.subjectSquareFeet} onChange={(v) => set('subjectSquareFeet', v)} error={err('subjectSquareFeet')} right={<SourceSelect label="Subject sqft" value={s.subjectSqftSource} onChange={(v) => set('subjectSqftSource', v)} />} />
                <Field label="Valuation date" htmlFor="vdate"><Input id="vdate" type="date" value={s.valuationDate} onChange={(e) => set('valuationDate', e.target.value)} /></Field>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table compact min-w-[760px] text-[12.5px]">
                  <thead>
                    <tr className="text-left">
                      {['ID', 'Address', 'Sale price', 'Sqft', 'Sale date', 'Miles', 'Net adj.', 'Source', ''].map((h) => <th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {s.comps.map((c, i) => (
                      <tr key={i} className="align-middle">
                        <td className="py-1 pr-2"><Input aria-label="Comp ID" value={c.id} onChange={(e) => setComp(i, { id: e.target.value })} className="w-14" maxLength={40} /></td>
                        <td className="py-1 pr-2"><Input aria-label="Comp address" value={c.address} onChange={(e) => setComp(i, { address: e.target.value })} /></td>
                        <td className="py-1 pr-2"><Input aria-label="Comp sale price" type="number" value={c.salePrice} onChange={(e) => setComp(i, { salePrice: e.target.value === '' ? '' : Number(e.target.value) })} className="w-28" /></td>
                        <td className="py-1 pr-2"><Input aria-label="Comp sqft" type="number" value={c.squareFeet} onChange={(e) => setComp(i, { squareFeet: e.target.value === '' ? '' : Number(e.target.value) })} className="w-20" /></td>
                        <td className="py-1 pr-2"><Input aria-label="Comp sale date" type="date" value={c.saleDate} onChange={(e) => setComp(i, { saleDate: e.target.value })} className="w-36" /></td>
                        <td className="py-1 pr-2"><Input aria-label="Comp distance" type="number" value={c.distanceMiles} onChange={(e) => setComp(i, { distanceMiles: e.target.value === '' ? '' : Number(e.target.value) })} className="w-16" /></td>
                        <td className="py-1 pr-2"><Input aria-label="Comp net adjustment" type="number" value={c.netAdjustment} onChange={(e) => setComp(i, { netAdjustment: e.target.value === '' ? '' : Number(e.target.value) })} className="w-24" /></td>
                        <td className="py-1 pr-2"><SourceSelect label={`Comp ${c.id}`} value={c.source} onChange={(v) => setComp(i, { source: v })} /></td>
                        <td className="py-1"><button aria-label={`Remove comp ${c.id}`} className="px-1 text-muted hover:text-critical" onClick={() => setS((p) => ({ ...p, comps: p.comps.filter((_, j) => j !== i) }))}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between">
                <Button variant="secondary" onClick={() => setS((p) => ({ ...p, comps: [...p.comps, emptyComp(p.comps.length + 1)] }))} disabled={s.comps.length >= 25}>Add comp</Button>
                {r?.arvAnalysis && <div className="num text-[12px] text-muted">ARV {money(r.arvAnalysis.arv)} · range {money(r.arvAnalysis.low)}–{money(r.arvAnalysis.high)} · {money(r.arvAnalysis.weightedPricePerSqft, true)}/sqft</div>}
              </div>
              {err('arv') && <p className="text-[12px] text-critical">{err('arv')}</p>}
            </div>
          )}
        </Panel>

        <Panel code="03" title="Repairs and deal terms" eyebrow="Acquisition">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField id="repairs" label="Estimated repairs" prefix="$" value={s.repairs} onChange={(v) => set('repairs', v)} error={err('repairs.value') ?? err('repairs')} right={<SourceSelect label="Repairs" value={s.repairsSource} onChange={(v) => set('repairsSource', v)} />} />
            <NumberField id="fee" label="Target assignment fee" prefix="$" value={s.assignmentFee} onChange={(v) => set('assignmentFee', v)} error={err('assignmentFee')} />
            <NumberField id="mult" label="ARV multiplier" suffix="%" value={s.arvMultiplierPct} onChange={(v) => set('arvMultiplierPct', v)} error={err('arvMultiplierPct')} hint="Rule-of-thumb buyer ceiling. Common default 70%." />
            <NumberField id="contract" label="Proposed contract price (optional)" prefix="$" value={s.contractPrice} onChange={(v) => set('contractPrice', v)} hint="Leave blank to evaluate at the recommended max offer." />
            <NumberField id="wcosts" label="Your deal costs" prefix="$" value={s.wholesalerCosts} onChange={(v) => set('wholesalerCosts', v)} hint="Marketing, title, EMD at risk" />
          </div>
        </Panel>

        <Panel code="04" title="End-buyer assumptions" eyebrow="Cost stack">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField id="acq" label="Buyer closing costs" suffix="%" value={s.buyer.acquisitionClosingPct} onChange={(v) => setB('acquisitionClosingPct', v)} />
            <NumberField id="months" label="Holding period" suffix="mo" value={s.buyer.holdingMonths} onChange={(v) => setB('holdingMonths', v)} />
            <NumberField id="tax" label="Annual property tax" prefix="$" value={s.buyer.annualPropertyTax} onChange={(v) => setB('annualPropertyTax', v)} error={err('buyer.annualPropertyTax')} />
            <NumberField id="ins" label="Annual insurance" prefix="$" value={s.buyer.annualInsurance} onChange={(v) => setB('annualInsurance', v)} error={err('buyer.annualInsurance')} />
            <NumberField id="util" label="Monthly utilities" prefix="$" value={s.buyer.monthlyUtilities} onChange={(v) => setB('monthlyUtilities', v)} />
            <NumberField id="ltv" label="Loan-to-purchase" suffix="%" value={s.buyer.loanToValuePct} onChange={(v) => setB('loanToValuePct', v)} hint="0 for all-cash buyers" />
            <NumberField id="rate" label="Interest rate" suffix="%" value={s.buyer.annualInterestRatePct} onChange={(v) => setB('annualInterestRatePct', v)} error={err('buyer.annualInterestRatePct')} />
            <NumberField id="points" label="Points" suffix="%" value={s.buyer.pointsPct} onChange={(v) => setB('pointsPct', v)} />
            <NumberField id="comm" label="Agent commission at resale" suffix="%" value={s.buyer.commissionPct} onChange={(v) => setB('commissionPct', v)} />
            <NumberField id="sclose" label="Seller closing at resale" suffix="%" value={s.buyer.sellerClosingPct} onChange={(v) => setB('sellerClosingPct', v)} />
            <NumberField id="profit" label="Buyer target profit" suffix="% ARV" value={s.buyer.targetProfitPct} onChange={(v) => setB('targetProfitPct', v)} />
            <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-muted">
              <input type="checkbox" checked={s.buyer.financeRehab} onChange={(e) => setB('financeRehab', e.target.checked)} className="accent-signal" /> Lender funds rehab
            </label>
          </div>
        </Panel>
      </div>

      <div className="xl:sticky xl:top-20 xl:self-start">
        <section className={cx('panel fade-in overflow-hidden', r && 'panel-accent glow-signal')}>
          <header className="flex items-center justify-between gap-3 border-b border-line/80 px-5 py-3.5">
            <div>
              <div className="eyebrow mb-1 flex items-center gap-2"><StatusDot tone={r ? 'positive' : 'neutral'} live={!!r} />Deterministic engine</div>
              <h2 className="text-[14px] font-semibold text-titanium">Live result</h2>
            </div>
            {r ? <Badge dot tone={r.summary.viableForBuyer ? 'positive' : 'critical'}>{r.summary.viableForBuyer ? 'Buyer viable' : 'Not viable'}</Badge> : <Badge>Awaiting inputs</Badge>}
          </header>
          <div className="p-5">
          {r ? (
            <div className="flex flex-col gap-5">
              <div className="rounded-xl border border-signal/25 bg-[radial-gradient(120%_120%_at_0%_0%,rgb(86_137_255/0.18),transparent_60%)] p-4">
                <Stat size="xl" label="Recommended max offer" value={money(r.summary.recommendedMaxOffer)} tone={r.summary.recommendedMaxOffer > 0 ? 'signal' : 'critical'} sub="Lower of rule-of-thumb and cost-stack MAO" />
                <div className="mt-4 grid grid-cols-2 gap-2 text-[11.5px]">
                  <div className={cx('surface-inset px-3 py-2', r.summary.maoRuleOfThumb <= r.summary.maoCostStack && 'border-signal/40')}><div className="eyebrow text-[9px]">Rule of thumb</div><div className="num mt-1 text-[14px] text-titanium">{money(r.summary.maoRuleOfThumb)}</div></div>
                  <div className={cx('surface-inset px-3 py-2', r.summary.maoCostStack < r.summary.maoRuleOfThumb && 'border-signal/40')}><div className="eyebrow text-[9px]">Cost stack</div><div className="num mt-1 text-[14px] text-titanium">{money(r.summary.maoCostStack)}</div></div>
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                  <span className="eyebrow">Buyer margin</span>
                  <span className={cx('num', r.summary.viableForBuyer ? 'text-positive' : 'text-critical')}>{pct(r.summary.buyerMargin)} <span className="text-faint">· {money(r.summary.buyerProjectedProfit)}</span></span>
                </div>
                <Meter value={Math.max(0, r.summary.buyerMargin * 100)} max={30} tone={r.summary.viableForBuyer ? 'positive' : 'critical'} />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line pt-4">
                <Stat label="ARV" value={money(r.summary.arv)} />
                <Stat label="Repairs" value={money(r.summary.repairCosts)} />
                <Stat label="Buyer price" value={money(r.summary.buyerPrice)} sub={`at contract ${money(r.summary.contractPrice)}`} />
                <Stat label="Your net" value={money(r.assignment.wholesalerNet)} tone="positive" sub={`fee ${money(r.summary.assignmentFee)}`} />
                <Stat label="Max supportable fee" value={money(r.assignment.maxSupportableFee)} />
                <Stat label="Buyer all-in" value={money(r.assignment.buyerAllIn)} />
              </div>
              <WarningList warnings={r.warnings} limit={5} />
              <div className="border-t border-line pt-4">
                <div className="eyebrow mb-2">MAO sensitivity · ARV × repairs</div>
                <SensitivityGrid grid={r.sensitivity} rowLabel="ARV" colLabel="Repairs" format={(v) => moneyCompact(v)} tone={(v) => (v <= 0 ? 'bad' : 'good')} value={(v) => v} />
              </div>
            </div>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted">Enter an ARV (or comps), repairs, property tax, and insurance to see the analysis. Every figure is computed by tested, deterministic functions; nothing is estimated by AI.</p>
          )}
          <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4">
            {serverError && <p role="alert" className="text-[12.5px] text-critical">{serverError}</p>}
            <Button onClick={save} disabled={!r || !canSave || saving} className="h-10 w-full">{saving ? 'Saving…' : 'Save analysis'}</Button>
            {!canSave && <p className="text-[11.5px] text-muted">Your role can run analyses but not save them.</p>}
            <p className="text-[10.5px] leading-relaxed text-faint">{r?.disclaimer}</p>
          </div>
          </div>
        </section>
      </div>
    </div>
  );
}
