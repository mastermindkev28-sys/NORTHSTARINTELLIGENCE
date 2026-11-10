import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { SignUpForm } from '@/components/auth/signup-form';
import { getSession } from '@/lib/server/session';

export const metadata = { title: 'Create workspace' };

export default async function SignUpPage() {
  if (await getSession()) redirect('/app');
  return (
    <AuthShell title="Create your workspace" subtitle="You will be the owner. Invite your team after setup." footer={<>Already have an account? <Link className="text-signal hover:underline" href="/login">Sign in</Link></>}>
      <SignUpForm />
    </AuthShell>
  );
}
