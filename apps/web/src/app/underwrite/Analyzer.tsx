"use client";
import { useActionState } from "react";
import { analyze, type AnalyzerState } from "./actions";

const usd = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(v);
const pct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(2)}%`;

function Field({
  name,
  label,
  defaultValue,
  suffix,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.1em] text-muted">{label}</span>
      <div className="mt-1 flex items-center rounded-md border border-line bg-obsidian focus-within:border-signal">
        <input
          name={name}
          defaultValue={defaultValue}
          inputMode="decimal"
          className="num w-full bg-transparent px-2.5 py-1.5 text-sm text-arctic outline-none"
        />
        {suffix && <span className="pr-2.5 text-xs text-muted">{suffix}</span>}
      </div>
    </label>
  );
}

function Metric({
  label,
  value,
  tone = "text-arctic",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-line bg-obsidian/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className={`num mt-1 text-lg ${tone}`}>{value}</div>
    </div>
  );
}

export function Analyzer() {
  const [state, action, pending] = useActionState<AnalyzerState, FormData>(analyze, {});
  const w = state.wholesale;
  const r = state.rental;
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <form action={action} className="space-y-4 rounded-lg border border-line bg-graphite p-4">
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="col-span-2 mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-signal">
            Property
          </legend>
          <Field name="arv" label="ARV" defaultValue="300000" suffix="$" />
          <Field name="sqft" label="Living area" defaultValue="1500" suffix="sqft" />
          <Field name="rehab" label="Rehab" defaultValue="40000" suffix="$" />
          <Field name="asking" label="Asking price" defaultValue="155000" suffix="$" />
        </fieldset>
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="col-span-2 mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-signal">
            Wholesale assumptions
          </legend>
          <Field name="arvFactor" label="ARV factor" defaultValue="70" suffix="%" />
          <Field name="fee" label="Assignment fee" defaultValue="10000" suffix="$" />
          <Field name="profit" label="Buyer profit" defaultValue="15" suffix="% ARV" />
          <Field name="hold" label="Hold period" defaultValue="6" suffix="mo" />
          <Field name="tax" label="Annual tax" defaultValue="3600" suffix="$" />
          <Field name="insurance" label="Annual insurance" defaultValue="1500" suffix="$" />
          <label className="col-span-2 flex items-center gap-2 text-xs text-titanium">
            <input type="checkbox" name="financed" defaultChecked className="accent-[#5689ff]" />{" "}
            End buyer uses hard money (90% LTC / 70% LTV, 2 pts)
          </label>
          <Field name="hmRate" label="Hard money rate" defaultValue="12" suffix="%" />
        </fieldset>
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="col-span-2 mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-signal">
            Rental (optional)
          </legend>
          <Field name="rent" label="Monthly rent" defaultValue="2100" suffix="$" />
          <Field name="rentalPrice" label="Purchase price" defaultValue="" suffix="$" />
          <Field name="down" label="Down payment" defaultValue="25" suffix="%" />
          <Field name="rate" label="Interest rate" defaultValue="7.5" suffix="%" />
          <Field name="vacancy" label="Vacancy" defaultValue="6" suffix="%" />
        </fieldset>
        <button
          disabled={pending}
          className="w-full rounded-md bg-signal py-2 text-sm font-medium text-obsidian hover:bg-signal/90 disabled:opacity-60"
        >
          {pending ? "Analyzing…" : "Analyze deal"}
        </button>
        <p className="text-[11px] text-muted">
          Rental purchase price defaults to the recommended max offer.
        </p>
      </form>

      <div className="space-y-4">
        {state.error && (
          <div className="rounded-md border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
            {state.error}
          </div>
        )}
        {!w && !state.error && (
          <div className="rounded-lg border border-dashed border-line p-10 text-center text-sm text-muted">
            Enter deal inputs and run the analysis.
          </div>
        )}
        {w && (
          <section className="rounded-lg border border-line bg-graphite p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Wholesale analysis
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="MAO (rule)" value={usd(w.maoRuleOfThumb)} />
              <Metric label="MAO (cost-based)" value={usd(w.maoCostBased)} />
              <Metric
                label="Recommended max"
                value={usd(w.recommendedMaxOffer)}
                tone="text-signal"
              />
              <Metric
                label="Spread to asking"
                value={usd(w.spreadToAsking)}
                tone={(w.spreadToAsking ?? 0) >= 0 ? "text-positive" : "text-critical"}
              />
            </div>
            <p className="mt-3 text-sm">
              <span className="font-medium uppercase tracking-wider text-arctic">
                {w.decision.replace("_", " ")}
              </span>{" "}
              <span className="text-muted">— {w.decisionReasons.join(" ")}</span>
            </p>
            {w.endBuyerCosts && (
              <p className="mt-1 text-xs text-muted">
                End-buyer costs: holding {usd(w.endBuyerCosts.holding)} · financing{" "}
                {usd(w.endBuyerCosts.financing)} · disposition {usd(w.endBuyerCosts.disposition)}
              </p>
            )}
            <details className="mt-3" open>
              <summary className="cursor-pointer text-xs font-medium text-signal">
                Calculation trace
              </summary>
              <ul className="mt-2 divide-y divide-line/60 text-xs">
                {w.trace.map((s, i) => (
                  <li key={i} className="grid grid-cols-[1fr_auto] gap-3 py-1.5">
                    <div>
                      <div className="text-titanium">{s.label}</div>
                      <div className="text-muted">{s.formula}</div>
                    </div>
                    <div className="num self-center text-right text-arctic">
                      {s.unit === "ratio" ? pct(s.result) : usd(s.result)}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
            <p className="mt-3 text-[11px] text-muted">{w.limitations.join(" ")}</p>
          </section>
        )}
        {r && (
          <section className="rounded-lg border border-line bg-graphite p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Rental analysis (year one, stabilized)
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="NOI" value={usd(r.netOperatingIncome)} />
              <Metric label="Cap rate" value={pct(r.capRate)} />
              <Metric
                label="Cash-on-cash"
                value={pct(r.cashOnCash)}
                tone={(r.cashOnCash ?? 0) >= 0 ? "text-positive" : "text-critical"}
              />
              <Metric
                label="DSCR"
                value={r.dscr == null ? "—" : r.dscr.toFixed(2)}
                tone={(r.dscr ?? 2) >= 1.2 ? "text-positive" : "text-caution"}
              />
              <Metric label="Monthly cash flow" value={usd(r.monthlyCashFlow)} />
              <Metric label="Cash invested" value={usd(r.totalCashInvested)} />
              <Metric label="Break-even occupancy" value={pct(r.breakEvenOccupancy)} />
              <Metric label="Expense ratio" value={pct(r.operatingExpenseRatio)} />
            </div>
            {r.warnings.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-caution">
                {r.warnings.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
