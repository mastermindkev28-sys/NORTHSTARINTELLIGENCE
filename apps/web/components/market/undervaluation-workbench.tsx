'use client';

import { useMemo, useState } from 'react';
import { assessUndervaluation, MarketInputError, type UndervaluationResult, type UvDistressEvent } from '@northstar/market';
import { Badge, Button, Panel, Stat, cx, selectClass, toneBg, toneVar } from '@/components/ui';
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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Panel accent code="00" eyebrow="Subject" title="Price being tested">
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField id="price" label="Price" prefix="$" value={price} onChange={setPrice} />
            <NumberField id="sqft" label="Living area" suffix="sq ft" value={sqft} onChange={setSqft} />
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-muted">Price basis
              <select value={basis} onChange={(e) => setBasis(e.target.value as typeof basis)} className={selectClass}>
                <option value="list_price">List price</option><option value="offer_price">Offer price</option><option value="contract_price">Contract price</option>
              </select>
            </label>
          </div>
        </Panel>
        <Panel flush code="01" eyebrow="Signal 1 · minimum 3 within 1 mi and 180 days" title="Comparable sales" actions={<Button type="button" variant="secondary" className="h-7 px-2.5 text-[12px]" onClick={() => setComps((c) => [...c, { id: `C${c.length + 1}`, address: '', price: '', sqft: '', saleDate: daysAgo(30), distance: '', adjustment: '', armsLength: true }])}>Add comp</Button>}>
          <div className="overflow-x-auto">
            <table className="data-table compact min-w-[780px] text-[12.5px]">
              <thead><tr className="text-left"><th>Address</th><th>Sale price</th><th>Sq ft</th><th>Sale date</th><th>Miles</th><th>Net adj.</th><th className="text-center">Arm&apos;s length</th><th /></tr></thead>
              <tbody>
                {comps.map((c, i) => (
                  <tr key={c.id} className={c.armsLength ? undefined : 'opacity-60'}>
                    <td className="pr-1"><input aria-label={`${c.id} address`} value={c.address} onChange={(e) => set(i, { address: e.target.value })} className="h-8 w-full min-w-[150px] rounded-md border border-line bg-void/60 px-2 text-titanium focus:border-signal/80 focus:outline-none" /></td>
                    {(['price', 'sqft'] as const).map((k) => <td key={k} className="pr-1"><input aria-label={`${c.id} ${k}`} type="number" value={c[k]} onChange={(e) => set(i, { [k]: e.target.value === '' ? '' : Number(e.target.value) })} className="num h-8 w-24 rounded-md border border-line bg-void/60 px-2 text-titanium focus:border-signal/80 focus:outline-none text-right" /></td>)}
                    <td className="pr-1"><input aria-label={`${c.id} sale date`} type="date" value={c.saleDate} onChange={(e) => set(i, { saleDate: e.target.value })} className="h-8 rounded-md border border-line bg-void/60 px-2 text-titanium focus:border-signal/80 focus:outline-none" /></td>
                    <td className="pr-1"><input aria-label={`${c.id} distance`} type="number" step="0.1" value={c.distance} onChange={(e) => set(i, { distance: e.target.value === '' ? '' : Number(e.target.value) })} className="num h-8 w-16 rounded-md border border-line bg-void/60 px-2 text-titanium focus:border-signal/80 focus:outline-none text-right" /></td>
                    <td className="pr-1"><input aria-label={`${c.id} adjustment`} type="number" value={c.adjustment} onChange={(e) => set(i, { adjustment: e.target.value === '' ? '' : Number(e.target.value) })} className="num h-8 w-20 rounded-md border border-line bg-void/60 px-2 text-titanium focus:border-signal/80 focus:outline-none text-right" /></td>
                    <td className="text-center"><input aria-label={`${c.id} arm's length`} type="checkbox" checked={c.armsLength} onChange={(e) => set(i, { armsLength: e.target.checked })} className="size-3.5 accent-[var(--color-signal)]" /></td>
                    <td className="text-right"><button type="button" onClick={() => setComps((cs) => cs.filter((_, j) => j !== i))} className="text-[11px] text-muted hover:text-critical">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel code="02" eyebrow="Signals 2 and 3" title="Estimates and area sales">
            <div className="grid gap-4">
              <NumberField id="avm" label="Third-party AVM" prefix="$" value={avm} onChange={setAvm} hint="Indicative only. Never sufficient on its own." />
              <div className="grid grid-cols-2 gap-4">
                <NumberField id="hood" label="Area median $/sq ft" prefix="$" value={hoodPpsf} onChange={setHoodPpsf} />
                <NumberField id="hoodn" label="Sales in sample" value={hoodN} onChange={setHoodN} hint="10+ required" />
              </div>
            </div>
          </Panel>
          <Panel code="04" eyebrow="Signals 4 and 5" title="Distress and seller statement">
            <div className="mb-4 flex flex-wrap gap-2">
              {DISTRESS.map((t) => (
                <label key={t} className={cx('inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] capitalize transition-colors', distress.has(t) ? 'border-caution/45 bg-caution/10 text-caution shadow-[0_0_14px_-6px_rgb(233_180_76/0.8)]' : 'border-line text-muted hover:border-line-strong hover:text-titanium')}>
                  <span className={cx('size-1.5 rounded-full', distress.has(t) ? 'bg-caution' : 'bg-faint')} />
                  <input type="checkbox" className="sr-only" checked={distress.has(t)} onChange={() => setDistress((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; })} />
                  {t.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
            <NumberField id="seller" label="Seller-stated price" prefix="$" value={seller} onChange={setSeller} hint="Recorded as a statement, not a valuation." />
          </Panel>
        </div>
        <Panel code="TX" eyebrow="Separate tax measure" title="Assessed value">
          <NumberField id="assessed" label="Assessed value" prefix="$" value={assessed} onChange={setAssessed} hint="Shown for tax context only. It never enters any valuation signal." />
        </Panel>
      </div>

      <div className="order-first grid items-start gap-6 lg:grid-cols-2 2xl:order-none 2xl:sticky 2xl:top-20 2xl:flex 2xl:flex-col 2xl:self-start">
        {error || !result ? (
          <Panel><p className="text-[13px] text-critical" role="alert">{error}</p></Panel>
        ) : (
          <>
            <section className={cx('panel fade-in overflow-hidden', result.classification === 'potentially_below_market' ? 'panel-accent glow-signal' : '')}>
              <div className="border-b border-line/80 px-5 py-3.5">
                <div className="eyebrow mb-1">Classification</div>
                <h2 className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-arctic">{result.headline}</h2>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Badge dot tone={CLASS_TONE[result.classification]}>{result.classification.replace(/_/g, ' ')}</Badge>
                  <span className="text-[11.5px] text-muted">Evidence confidence: <span className="text-titanium">{result.confidence}</span></span>
                </div>
              </div>
              <div className="p-5">
                <div className="mb-4 flex gap-1" aria-label="Signal summary">
                  {result.signals.map((sg, i) => (
                    <div key={`${sg.key}${i}`} className="flex-1" title={`${sg.label}: ${sg.status.replace(/_/g, ' ')}`}>
                      <div className={cx('h-1.5 rounded-full', toneBg[STATUS_TONE[sg.status]], STATUS_TONE[sg.status] === 'neutral' && 'opacity-30')} style={STATUS_TONE[sg.status] === 'neutral' ? undefined : { boxShadow: `0 0 8px ${toneVar[STATUS_TONE[sg.status]]}` }} />
                    </div>
                  ))}
                </div>
                {result.compValue && price !== '' && (() => {
                  const cv = result.compValue;
                  const lo = Math.min(cv.low, price) * 0.94, hi = Math.max(cv.high, price) * 1.06;
                  const at = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
                  const gap = (cv.value - price) / cv.value;
                  return (
                    <div>
                      <div className="grid grid-cols-3 gap-3">
                        <Stat label="Comp value" value={`$${Math.round(cv.value).toLocaleString('en-US')}`} />
                        <Stat label="Tested price" value={`$${Math.round(price).toLocaleString('en-US')}`} tone="signal" />
                        <Stat label="Discount" value={`${(gap * 100).toFixed(1)}%`} tone={gap > 0 ? 'positive' : 'critical'} />
                      </div>
                      <div className="relative mt-6 h-12">
                        <div className="absolute inset-x-0 top-5 h-1.5 rounded-full bg-graphite-3/80" />
                        <div className="absolute top-5 h-1.5 rounded-full bg-[linear-gradient(90deg,rgb(62_197_154/0.35),rgb(62_197_154/0.85))] shadow-[0_0_10px_rgb(62_197_154/0.6)]" style={{ left: at(cv.low), width: `calc(${at(cv.high)} - ${at(cv.low)})` }} />
                        <div className="absolute top-3.5 h-4 w-px bg-positive" style={{ left: at(cv.value) }} />
                        <div className="absolute -top-1 -translate-x-1/2" style={{ left: at(price) }}>
                          <div className="rounded bg-signal px-1.5 py-0.5 font-mono text-[9.5px] font-medium text-white shadow-[0_0_12px_rgb(86_137_255/0.8)]">PRICE</div>
                          <div className="mx-auto h-5 w-0.5 bg-signal" />
                        </div>
                        <div className="num absolute top-8 -translate-x-1/2 text-[10px] text-faint" style={{ left: at(cv.low) }}>${Math.round(cv.low / 1000)}k</div>
                        <div className="num absolute top-8 -translate-x-1/2 text-[10px] text-faint" style={{ left: at(cv.high) }}>${Math.round(cv.high / 1000)}k</div>
                      </div>
                      <div className="mt-2 flex justify-between font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">
                        <span>Comp range</span>
                        <span>{cv.compCount} comps · CV {(cv.dispersion * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </section>
            <Panel className="lg:row-span-2" eyebrow="Five separate signals" title="Evidence">
              <ol className="relative flex flex-col">
                {result.signals.map((sg, i) => {
                  const t = STATUS_TONE[sg.status];
                  return (
                    <li key={`${sg.key}${i}`} className="relative flex gap-3.5 pb-4 last:pb-0">
                      {i < result.signals.length - 1 && <span className="absolute left-[11px] top-7 bottom-0 w-px bg-line" />}
                      <span className={cx('num relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium', t === 'positive' ? 'border-positive/50 bg-positive/15 text-positive' : t === 'caution' ? 'border-caution/50 bg-caution/10 text-caution' : t === 'signal' ? 'border-signal/50 bg-signal/10 text-signal' : 'border-line-strong bg-graphite-2 text-muted')}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[13px] font-medium text-titanium">{sg.label}</span>
                          <Badge tone={t}>{sg.status.replace(/_/g, ' ')}</Badge>
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">{sg.summary}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {result.compValue && result.compValue.excluded.length > 0 && (
                <div className="mt-4 rounded-md border border-line bg-void/40 px-3 py-2 text-[11.5px] text-muted">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">Excluded comps</span><br />
                  {result.compValue.excluded.map((e) => `${e.id} (${e.reason})`).join('; ')}
                </div>
              )}
            </Panel>
            {result.taxMeasures && (
              <Panel eyebrow="Tax measure" title={`Assessed $${result.taxMeasures.assessedValue.toLocaleString('en-US')}`}>
                <p className="text-[12px] leading-relaxed text-muted">{result.taxMeasures.note}</p>
              </Panel>
            )}
          </>
        )}
      </div>
    </div>
  );
}
