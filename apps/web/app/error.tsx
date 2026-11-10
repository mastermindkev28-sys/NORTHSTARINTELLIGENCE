'use client';
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 text-center">
      <div className="eyebrow">Error</div>
      <h1 className="text-[20px] font-semibold">Something went wrong</h1>
      <p className="text-[13px] text-muted">The error has been logged{error.digest ? ` (reference ${error.digest})` : ''}.</p>
      <button onClick={reset} className="text-[13px] text-signal hover:underline">Try again</button>
    </main>
  );
}
