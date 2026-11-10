'use client';

import { useActionState } from 'react';
import { signUpAction, type FormState } from '@/lib/actions/auth';
import { Button, Field, Input } from '@/components/ui';

export function SignUpForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signUpAction, {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="Your name" htmlFor="displayName" error={f.displayName}>
        <Input id="displayName" name="displayName" defaultValue={state.values?.displayName} autoComplete="name" required aria-invalid={!!f.displayName} />
      </Field>
      <Field label="Work email" htmlFor="email" error={f.email}>
        <Input id="email" name="email" defaultValue={state.values?.email} type="email" autoComplete="email" required aria-invalid={!!f.email} />
      </Field>
      <Field label="Company / workspace name" htmlFor="orgName" error={f.orgName}>
        <Input id="orgName" name="orgName" defaultValue={state.values?.orgName} autoComplete="organization" required aria-invalid={!!f.orgName} />
      </Field>
      <Field label="Password" htmlFor="password" error={f.password} hint="At least 12 characters. A passphrase works well.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required aria-invalid={!!f.password} />
      </Field>
      {state.error && <p role="alert" className="text-[13px] text-critical">{state.error}</p>}
      <Button type="submit" disabled={pending} className="mt-2 h-10">{pending ? 'Creating workspace…' : 'Create workspace'}</Button>
    </form>
  );
}
