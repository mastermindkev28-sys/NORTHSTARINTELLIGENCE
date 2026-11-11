import Link from 'next/link';
import { can } from '@northstar/core';
import { marketRepo } from '@northstar/db';
import { CATEGORY_KEYS, CATEGORY_LABELS, INVESTMENT_STRATEGIES, METRICS, PROFILES } from '@northstar/market';
import { asTenant } from '@/lib/server/session';
import { createProfileAction, deleteProfileAction } from '@/lib/actions/market';
import { PageHeader } from '@/components/page-header';
import { Button, Input, Panel, Select } from '@/components/ui';
import { MarketTabs } from '@/components/market/parts';

export const metadata = { title: 'Score profiles' };

export default async function Profiles({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const data = await asTenant(async (tx, s) => ({ profiles: await marketRepo.listScoreProfiles(tx), role: s.role }));
  const write = can(data.role, 'records.write');
  const strategies = ['balanced', ...INVESTMENT_STRATEGIES] as const;

  return (
    <>
      <PageHeader eyebrow="02 · Market Intelligence" title="Score profiles" description="Strategy profiles are starting hypotheses, not universal truths. Compare their weights, or save your own weighting for your team." />
      <MarketTabs active="profiles" />

      <Panel eyebrow="Built-in" title="Strategy weights by category">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[12.5px]">
            <thead><tr className="text-left text-[11px] text-muted"><th className="pb-2 font-normal">Profile</th>{CATEGORY_KEYS.map((k) => <th key={k} className="pb-2 text-right font-normal">{CATEGORY_LABELS[k]}</th>)}<th className="pb-2 pl-4 font-normal">Emphasized variables</th></tr></thead>
            <tbody>
              {strategies.map((id) => {
                const p = PROFILES[id];
                const total = CATEGORY_KEYS.reduce((s, k) => s + p.categoryWeights[k], 0);
                return (
                  <tr key={id} className="border-t border-line align-top">
                    <td className="py-2"><Link href={`/app/market?profile=${id}`} className="font-medium hover:text-signal">{p.label}</Link><div className="max-w-56 text-[11px] text-muted">{p.description}</div></td>
                    {CATEGORY_KEYS.map((k) => <td key={k} className="num py-2 text-right">{Math.round((p.categoryWeights[k] / total) * 100)}%</td>)}
                    <td className="py-2 pl-4 text-[11.5px] text-muted">{Object.entries(p.variableEmphasis).filter(([, v]) => v !== 1).map(([k, v]) => `${METRICS.find((m) => m.key === k)?.label ?? k} ×${v}`).join(', ') || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel eyebrow="Your organization" title={`${data.profiles.length} saved profile${data.profiles.length === 1 ? '' : 's'}`}>
          {data.profiles.length === 0 ? <p className="text-[13px] text-muted">No custom profiles yet.</p> : (
            <ul className="flex flex-col divide-y divide-line">
              {data.profiles.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                  <div>
                    <Link href={`/app/market?profile=custom:${p.id}`} className="font-medium hover:text-signal">{p.name}</Link>
                    <div className="text-[11.5px] text-muted">Based on {PROFILES[p.baseProfile as keyof typeof PROFILES]?.label ?? p.baseProfile} · {Object.entries(p.categoryWeights).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', ') || 'base weights'}</div>
                  </div>
                  {can(data.role, 'records.delete') && <form action={deleteProfileAction}><input type="hidden" name="id" value={p.id} /><button type="submit" className="text-[11.5px] text-muted hover:text-critical">Delete</button></form>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {write && (
          <Panel eyebrow="Create" title="New custom profile">
            {sp.error && <p className="mb-3 text-[12.5px] text-critical" role="alert">{sp.error === 'name' ? 'A profile with that name already exists.' : 'Weights must be between 0 and 100, with at least one above 0.'}</p>}
            <form action={createProfileAction} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Input name="name" placeholder="Profile name" required maxLength={120} aria-label="Profile name" />
                <Select name="base" defaultValue="buy_and_hold" aria-label="Base profile">
                  {strategies.map((s) => <option key={s} value={s}>Start from {PROFILES[s].label}</option>)}
                </Select>
              </div>
              <p className="text-[11.5px] text-muted">Category weights (relative; blank keeps the base profile&apos;s value).</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {CATEGORY_KEYS.map((k) => (
                  <label key={k} className="flex items-center justify-between gap-2 text-[12px] text-muted">
                    {CATEGORY_LABELS[k]}
                    <input type="number" name={`w_${k}`} min={0} max={100} step={1} placeholder="—" className="num h-7 w-16 rounded border border-line bg-obsidian px-2 text-right text-[12px] text-titanium" />
                  </label>
                ))}
              </div>
              <details className="text-[12px]">
                <summary className="cursor-pointer text-muted hover:text-titanium">Variable emphasis (advanced)</summary>
                <div className="mt-2 grid grid-cols-1 gap-y-1.5 sm:grid-cols-2 sm:gap-x-4">
                  {METRICS.filter((m) => m.key !== 'landlord_regulatory_index').map((m) => (
                    <label key={m.key} className="flex items-center justify-between gap-2 text-[11.5px] text-muted">
                      {m.label}
                      <input type="number" name={`e_${m.key}`} min={0} max={10} step={0.25} placeholder="1" className="num h-6 w-14 rounded border border-line bg-obsidian px-1.5 text-right text-[11.5px] text-titanium" />
                    </label>
                  ))}
                </div>
              </details>
              <Button type="submit">Save profile</Button>
            </form>
          </Panel>
        )}
      </div>
    </>
  );
}
