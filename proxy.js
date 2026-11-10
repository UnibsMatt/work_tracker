import { NextResponse } from 'next/server';
import { COOKIE, verifyToken } from '@/lib/auth';

const PUBLIC = ['/login', '/api/login'];

export async function proxy(req) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.includes(pathname)) return NextResponse.next();

  if (await verifyToken(req.cookies.get(COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return Response.json({ error: 'Accesso non effettuato' }, { status: 401 });
  }
  // use the public host/protocol (Cloudflare tunnel sends these) so we don't
  // redirect to the internal http://localhost address
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host;
  const proto = (req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '')).split(',')[0];
  return NextResponse.redirect(`${proto}://${host}/login`);
}

export const config = {
  matcher: '/((?!_next/static|_next/image).*)',
};
