import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';
import { getSession } from '@/lib/server/session';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await getSession()) redirect('/app');
  return (
    <AuthShell title="Sign in" subtitle="Access your Northstar workspace." footer={<>New to Northstar? <Link className="text-signal hover:underline" href="/signup">Create a workspace</Link></>}>
      <LoginForm />
    </AuthShell>
  );
}
