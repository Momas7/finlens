import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/signup'];

// Checagem otimista (só presença do cookie). A validação real da sessão
// acontece no layout autenticado, que consulta /v1/me.
export function proxy(request: NextRequest) {
  const hasSession = Boolean(getSessionCookie(request));
  const isPublic = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/|v1/|_next/|favicon.ico).*)'],
};
