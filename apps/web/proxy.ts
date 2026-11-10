import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge gate: unauthenticated requests to /app are redirected to /login, and every request gets a
 * request id for log/audit correlation. Real session validation happens server-side against the
 * database (lib/server/session.ts); a cookie's presence here is only a fast-path hint.
 */
export function proxy(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') ?? `req_${crypto.randomUUID()}`;
  if (req.nextUrl.pathname.startsWith('/app') && !req.cookies.has('ns_session')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  const headers = new Headers(req.headers);
  headers.set('x-request-id', requestId);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('x-request-id', requestId);
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|icon.svg|favicon.ico).*)'] };
