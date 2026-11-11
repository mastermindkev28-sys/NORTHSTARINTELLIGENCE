'use client';

import { useMemo, useState } from 'react';
import { assessUndervaluation, MarketInputError, type UndervaluationResult, type UvDistressEvent } from '@northstar/market';
import { Badge, Panel, cx } from '@/components/ui';
import { NumberField } from '@/components/underwrite/number-field';

interface CompRow { id: string; address: string; price: number | ''; sqft: number | ''; saleDate: string; distance: number | ''; adjustment: number | ''; armsLength: boolean }

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

const EXAMPLE: CompRow[] = [
  { id: 'C1', address: '118 Orchard St', price: 214_000, sqft: 1_480, saleDate: daysAgo(40), distance: 0.3, adjustment: 0, armsLength: true },
  { id: 'C2', address: '204 Orchard St', price: 228_500, sqft: 1_590, saleDate: daysAgo(75), distance: 0.4, adjustment: -6_000, armsLength: true },
  { id: 'C3', address: '9 Linden Ct', price: 205_000, sqft: 1_420, saleDate: daysAgo(110), distance: 0.6, adjustment: 4_000, armsLength: true },
  { id: 'C4', address: '77 Canal Rd', price: 219_900, sqft: 1_510, saleDate: daysAgo(150), distance: 0.8, adjustment: 0, armsLength: true },
  { id: 'C5', address: '31 Mill Ln (family transfer)', price: 120_000, sqft: 1_500, saleDate: daysAgo(30), distance: 0.2, adjustment: 0, armsLength: false },
];

const STATUS_TONE = { supported: 'positive', not_supported: 'neutral', insufficient_evidence: 'caution', indicative: 'signal', present: 'caution', absent: 'neutral', statement: 'neutral' } as const;
const CLASS_TONE = { potentially_below_market: 'positive', not_below_market: 'neutral', indicators_only: 'caution', insufficient_evidence: 'caution' } as const;
const DISTRESS: UvDistressEvent['type'][] = ['tax_delinquency', 'tax_sale', 'lis_pendens', 'sheriff_sale', 'probate', 'code_violation', 'vacancy'];

export function UndervaluationWorkbench() {
  const [price, setPrice] = useState<number | ''>(172_000);
  const [sqft, setSqft] = useState<number | ''>(1_500);
  const [basis, setBasis] = useState<'list_price' | 'offer_price' | 'contract_price'>('list_price');
  const [comps, setComps] = useState<CompRow[]>(EXAMPLE);
  const [avm, setAvm] = useState<number | ''>(205_000);
  const [hoodPpsf, setHoodPpsf] = useState<number | ''>(142);
  const [hoodN, setHoodN] = useState<number | ''>(23);
  const [seller, setSeller] = useState<number | ''>(175_000);
  const [assessed, setAssessed] = useState<number | ''>(96_000);
  const [distress, setDistress] = useState<Set<UvDistressEvent['type']>>(new Set(['tax_delinquency']));

  const { result, error } = useMemo((): { result: UndervaluationResult | null; error: string | null } => {
    if (price === '' || sqft === '') return { result: null, error: 'Enter a price and living area.' };
    try {
      return {
        error: null,
        result: assessUndervaluation({
          asOf: today(),
          subjectSquareFeet: sqft,
          price,
          priceBasis: basis,
          comps: comps.filter((c) => c.price !== '' && c.sqft !== '' && c.distance !== '' && c.saleDate).map((c) => ({ id: c.id, address: c.address, salePrice: c.price as number, squareFeet: c.sqft as number, saleDate: c.saleDate, distanceMiles: c.distance as number, ...(c.adjustment ? { adjustments: { net: c.adjustment as number } } : {}), armsLength: c.armsLength })),
          ...(avm !== '' ? { avms: [{ provider: 'Third-party AVM (demo)', value: avm, asOf: today() }] } : {}),
          ...(hoodPpsf !== '' && hoodN !== '' ? { neighborhood: { medianPricePerSqft: hoodPpsf, sampleSize: hoodN, windowDays: 180, areaName: 'Subject neighborhood', source: 'licensed_sales' } } : {}),
          distressEvents: [...distress].map((t) => ({ type: t, status: 'active' as const, eventDate: daysAgo(60), source: 'County records (demo)' })),
          ...(seller !== '' ? { sellerAskingPrice: { value: seller, statedAt: today() } } : {}),
          ...(assessed !== '' ? { assessedValue: { value: assessed, year: new Date().getFullYear(), jurisdiction: 'County assessor' } } : {}),
        }),
      };
    } catch (e) {
      return { result: null, error: e instanceof MarketInputError ? e.message : 'Could not evaluate these inputs.' };
    }
  }, [price, sqft, basis, comps, avm, hoodPpsf, hoodN, seller, assessed, distress]);

  const set = (i: number, patch: Partial<CompRow>) => setComps((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="flex flex-col gap-6">
        <Panel eyebrow="Subject" title="Price being tested">
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField id="price" label="Price" prefix="$" value={price} onChange={setPrice} />
            <NumberField id="sqft" label="Living area" suffix="sq ft" value={sqft} onChange={setSqft} />
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-muted">Price basis
              <select value={basis} onChange={(e) => setBasis(e.target.value as typeof basis)} className="h-9 rounded-md border border-line bg-obsidian px-2 text-sm text-titanium">
                <option value="list_price">List price</option><option value="offer_price">Offer price</option><option value="contract_price">Contract price</option>
              </select>
            </label>
          </div>
        </Panel>
        <Panel eyebrow="Signal 1 · minimum 3 within 1 mi and 180 days" title="Comparable sales" actions={<button type="button" onClick={() => setComps((c) => [...c, { id: `C${c.length + 1}`, address: '', price: '', sqft: '', saleDate: daysAgo(30), distance: '', adjustment: '', armsLength: true }])} className="text-[12px] text-signal hover:underline">Add comp</button>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[12.5px]">
              <thead><tr className="text-left text-[11px] text-muted"><th className="pb-2 font-normal">Address</th><th className="pb-2 font-normal">Sale price</th><th className="pb-2 font-normal">Sq ft</th><th className="pb-2 font-normal">Sale date</th><th className="pb-2 font-normal">Miles</th><th className="pb-2 font-normal">Net adj.</th><th className="pb-2 font-normal">Arm&apos;s length</th><th /></tr></thead>
              <tbody>
                {comps.map((c, i) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-1.5 pr-2"><input aria-label={`${c.id} address`} value={c.address} onChange={(e) => set(i, { address: e.target.value })} className="h-8 w-full rounded border border-line bg-obsidian px-2" /></td>
                    {(['price', 'sqft'] as const).map((k) => <td key={k} className="py-1.5 pr-2"><input aria-label={`${c.id} ${k}`} type="number" value={c[k]} onChange={(e) => set(i, { [k]: e.target.value === '' ? '' : Number(e.target.value) })} className="num h-8 w-24 rounded border border-line bg-obsidian px-2 text-right" /></td>)}
                    <td className="py-1.5 pr-2"><input aria-label={`${c.id} sale date`} type="date" value={c.saleDate} onChange={(e) => set(i, { saleDate: e.target.value })} className="h-8 rounded border border-line bg-obsidian px-2" /></td>
                    <td className="py-1.5 pr-2"><input aria-label={`${c.id} distance`} type="number" step="0.1" value={c.distance} onChange={(e) => set(i, { distance: e.target.value === '' ? '' : Number(e.target.value) })} className="num h-8 w-16 rounded border border-line bg-obsidian px-2 text-right" /></td>
                    <td className="py-1.5 pr-2"><input aria-label={`${c.id} adjustment`} type="number" value={c.adjustment} onChange={(e) => set(i, { adjustment: e.target.value === '' ? '' : Number(e.target.value) })} className="num h-8 w-20 rounded border border-line bg-obsidian px-2 text-right" /></td>
                    <td className="py-1.5 text-center"><input aria-label={`${c.id} arm's length`} type="checkbox" checked={c.armsLength} onChange={(e) => set(i, { armsLength: e.target.checked })} /></td>
                    <td className="py-1.5 text-right"><button type="button" onClick={() => setComps((cs) => cs.filter((_, j) => j !== i))} className="text-[11px] text-muted hover:text-critical">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel eyebrow="Signals 2 and 3" title="Estimates and area sales">
            <div className="grid gap-4">
              <NumberField id="avm" label="Third-party AVM" prefix="$" value={avm} onChange={setAvm} hint="Indicative only. Never sufficient on its own." />
              <div className="grid grid-cols-2 gap-4">
                <NumberField id="hood" label="Area median $/sq ft" prefix="$" value={hoodPpsf} onChange={setHoodPpsf} />
                <NumberField id="hoodn" label="Sales in sample" value={hoodN} onChange={setHoodN} hint="10+ required" />
              </div>
            </div>
          </Panel>
          <Panel eyebrow="Signals 4 and 5" title="Distress and seller statement">
            <div className="mb-4 flex flex-wrap gap-2">
              {DISTRESS.map((t) => (
                <label key={t} className={cx('cursor-pointer rounded border px-2 py-1 text-[11.5px]', distress.has(t) ? 'border-caution/50 bg-caution/10 text-caution' : 'border-line text-muted')}>
                  <input type="checkbox" className="sr-only" checked={distress.has(t)} onChange={() => setDistress((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; })} />
                  {t.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
            <NumberField id="seller" label="Seller-stated price" prefix="$" value={seller} onChange={setSeller} hint="Recorded as a statement, not a valuation." />
          </Panel>
        </div>
        <Panel eyebrow="Separate tax measure" title="Assessed value">
          <NumberField id="assessed" label="Assessed value" prefix="$" value={assessed} onChange={setAssessed} hint="Shown for tax context only. It never enters any valuation signal." />
        </Panel>
      </div>

      <div className="flex flex-col gap-6 xl:sticky xl:top-20 xl:self-start">
        {error || !result ? (
          <Panel><p className="text-[13px] text-critical" role="alert">{error}</p></Panel>
        ) : (
          <>
            <Panel eyebrow="Classification" title={result.headline}>
              <div className="flex items-center gap-3">
                <Badge tone={CLASS_TONE[result.classification]}>{result.classification.replace(/_/g, ' ')}</Badge>
                <span className="text-[12px] text-muted">Evidence confidence: {result.confidence}</span>
              </div>
              {result.compValue && (
                <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-[12px]">
                  <div><dt className="eyebrow">Comp value</dt><dd className="num mt-1 text-[16px]">${Math.round(result.compValue.value).toLocaleString('en-US')}</dd></div>
                  <div><dt className="eyebrow">Range</dt><dd className="num mt-1">${Math.round(result.compValue.low / 1000)}k–${Math.round(result.compValue.high / 1000)}k</dd></div>
                  <div><dt className="eyebrow">Comps · CV</dt><dd className="num mt-1">{result.compValue.compCount} · {(result.compValue.dispersion * 100).toFixed(1)}%</dd></div>
                </dl>
              )}
            </Panel>
            <Panel eyebrow="Five separate signals" title="Evidence">
              <ul className="flex flex-col divide-y divide-line">
                {result.signals.map((s, i) => (
                  <li key={`${s.key}${i}`} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium">{s.label}</span>
                      <Badge tone={STATUS_TONE[s.status]}>{s.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-muted">{s.summary}</p>
                  </li>
                ))}
              </ul>
              {result.compValue && result.compValue.excluded.length > 0 && (
                <div className="mt-3 border-t border-line pt-3 text-[11.5px] text-muted">
                  Excluded comps: {result.compValue.excluded.map((e) => `${e.id} (${e.reason})`).join('; ')}
                </div>
              )}
            </Panel>
            {result.taxMeasures && (
              <Panel eyebrow="Tax measure" title={`Assessed $${result.taxMeasures.assessedValue.toLocaleString('en-US')}`}>
                <p className="text-[12px] text-muted">{result.taxMeasures.note}</p>
              </Panel>
            )}
          </>
        )}
      </div>
    </div>
  );
}
