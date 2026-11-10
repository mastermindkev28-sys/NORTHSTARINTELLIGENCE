import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 text-center">
      <div className="eyebrow">404</div>
      <h1 className="text-[20px] font-semibold">Not found</h1>
      <p className="text-[13px] text-muted">This page does not exist, or you do not have access to it.</p>
      <Link href="/app" className="text-[13px] text-signal hover:underline">Back to command center</Link>
    </main>
  );
}
