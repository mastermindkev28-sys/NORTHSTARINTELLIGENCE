'use client';

import { useActionState } from 'react';
import { loginAction, type FormState } from '@/lib/actions/auth';
import { Button, Field, Input } from '@/components/ui';

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="Work email" htmlFor="email">
        <Input id="email" name="email" defaultValue={state.values?.email} type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state.error && <p role="alert" className="text-[13px] text-critical">{state.error}</p>}
      <Button type="submit" disabled={pending} className="mt-2 h-10">{pending ? 'Signing in…' : 'Sign in'}</Button>
    </form>
  );
}
