'use client';

import type { InputSource } from '@northstar/underwriting';
import { cx } from '@/components/ui';

const OPTIONS: { value: InputSource; label: string; short: string }[] = [
  { value: 'user_assumption', label: 'User assumption', short: 'ASSUMED' },
  { value: 'verified', label: 'Verified', short: 'VERIFIED' },
  { value: 'third_party_estimate', label: 'Third-party estimate', short: '3RD PARTY' },
  { value: 'ai_interpretation', label: 'AI interpretation', short: 'AI' },
];

export const sourceTone: Record<InputSource, string> = {
  verified: 'text-positive border-positive/40',
  third_party_estimate: 'text-signal border-signal/40',
  user_assumption: 'text-muted border-line',
  ai_interpretation: 'text-caution border-caution/40',
};

export function SourceSelect({ value, onChange, label }: { value: InputSource; onChange: (v: InputSource) => void; label: string }) {
  return (
    <select
      aria-label={`${label} source`}
      value={value}
      onChange={(e) => onChange(e.target.value as InputSource)}
      className={cx('h-6 rounded border bg-transparent px-1 font-mono text-[10px] tracking-wider', sourceTone[value])}
    >
      {OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-graphite text-titanium">{o.short}</option>)}
    </select>
  );
}
