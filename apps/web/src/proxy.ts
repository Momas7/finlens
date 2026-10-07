import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/signup'];
const HOME = '/painel';

// Checagem otimista (só presença do cookie). A validação real da sessão acontece no
// layout de /painel, que consulta /v1/me e limpa o cookie se a sessão for inválida.
export function proxy(request: NextRequest) {
  const hasSession = Boolean(getSessionCookie(request));
  const isPublic = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL(HOME, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/|v1/|auth/|_next/|icon.svg|favicon.ico).*)'],
};
