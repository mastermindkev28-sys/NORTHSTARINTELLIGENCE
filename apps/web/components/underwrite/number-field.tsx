'use client';

import { Field, Input } from '@/components/ui';

export function NumberField({
  id, label, value, onChange, suffix, prefix, hint, error, step = 'any', right,
}: {
  id: string; label: string; value: number | ''; onChange: (v: number | '') => void;
  suffix?: string; prefix?: string; hint?: string; error?: string | undefined; step?: string; right?: React.ReactNode;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          {prefix && <span className="num pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted">{prefix}</span>}
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            step={step}
            value={value}
            aria-invalid={!!error}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            className={prefix ? 'pl-6' : undefined}
            style={suffix ? { paddingRight: `${suffix.length * 7.5 + 20}px` } : undefined}
          />
          {suffix && <span className="num pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted">{suffix}</span>}
        </div>
        {right}
      </div>
    </Field>
  );
}
