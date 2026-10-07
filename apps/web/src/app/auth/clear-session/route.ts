import { type NextRequest, NextResponse } from 'next/server';

// Cookie de sessão presente mas rejeitado pela API (sessão revogada, usuário apagado,
// secret trocado). Apaga os cookies do Better Auth antes de ir para /login; sem isso o
// proxy veria o cookie e mandaria /login de volta para /, num loop de redirects.
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  for (const { name } of request.cookies.getAll()) {
    if (name.startsWith('better-auth.') || name.startsWith('__Secure-better-auth.')) {
      // Cookies __Secure- só podem ser sobrescritos com o atributo Secure.
      response.cookies.set(name, '', {
        maxAge: 0,
        path: '/',
        secure: name.startsWith('__Secure-'),
      });
    }
  }
  return response;
}
