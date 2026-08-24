import { NextRequest, NextResponse } from 'next/server';

import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from '@/lib/admin-auth';

const LOGIN_PAGE = '/admin/login';
const LOGIN_API = '/api/admin/login';
const LOGOUT_API = '/api/admin/logout';

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'same-origin');

  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(
    request.method,
  );
  const origin = request.headers.get('origin');

  if (isMutation && origin && origin !== request.nextUrl.origin) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          error: 'Invalid request origin',
        },
        { status: 403 },
      ),
    );
  }

  if (pathname === LOGIN_API || pathname === LOGOUT_API) {
    return withSecurityHeaders(NextResponse.next());
  }

  const session = await verifyAdminSessionToken(token);

  if (pathname === LOGIN_PAGE) {
    if (session) {
      return withSecurityHeaders(
        NextResponse.redirect(new URL('/admin/products', request.url)),
      );
    }

    return withSecurityHeaders(NextResponse.next());
  }

  if (!session) {
    if (pathname.startsWith('/api/admin/')) {
      return withSecurityHeaders(
        NextResponse.json(
          {
            success: false,
            error: 'Unauthorized',
          },
          { status: 401 },
        ),
      );
    }

    const loginUrl = new URL(LOGIN_PAGE, request.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);

    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
