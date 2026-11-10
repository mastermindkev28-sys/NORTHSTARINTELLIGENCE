import { NextResponse } from 'next/server';
import { withAnonymous } from '@northstar/db';
import { db } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

/** Liveness + database reachability. Reveals no tenant data. */
export async function GET() {
  const started = Date.now();
  try {
    await withAnonymous(db(), (tx) => tx.query('select 1'));
    return NextResponse.json({ status: 'ok', db: 'ok', latencyMs: Date.now() - started });
  } catch {
    return NextResponse.json({ status: 'degraded', db: 'unreachable' }, { status: 503 });
  }
}
