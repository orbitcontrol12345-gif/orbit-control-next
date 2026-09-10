import { NextRequest, NextResponse } from 'next/server';

import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from '@/lib/admin-auth';
import {
  isCronApiPath,
  isProductionDiagnosticPath,
  isPublicApiPath,
} from '@/lib/api-access-control';

const LOGIN_PAGE = '/admin/login';

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
  const isApiRoute = pathname.startsWith('/api/');
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(
    request.method,
  );
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  const isProduction =
    process.env.VERCEL_ENV === 'production' ||
    process.env.NODE_ENV === 'production';

  if (
    isMutation &&
    (fetchSite === 'cross-site' ||
      (origin && origin !== request.nextUrl.origin))
  ) {
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

  if (
    isProduction &&
    process.env.ENABLE_PRODUCTION_DIAGNOSTICS !== 'true' &&
    isProductionDiagnosticPath(pathname)
  ) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          error: 'Not found',
        },
        { status: 404 },
      ),
    );
  }

  if (isPublicApiPath(pathname)) {
    return withSecurityHeaders(NextResponse.next());
  }

  const session = await verifyAdminSessionToken(token);
  const cronSecret = process.env.CRON_SECRET?.trim() || '';
  const cronAuthorized = Boolean(
    isApiRoute &&
      isCronApiPath(pathname) &&
      cronSecret &&
      request.headers.get('authorization') ===
        `Bearer ${cronSecret}`,
  );

  if (pathname === LOGIN_PAGE) {
    if (session) {
      return withSecurityHeaders(
        NextResponse.redirect(new URL('/admin/products', request.url)),
      );
    }

    return withSecurityHeaders(NextResponse.next());
  }

  if (!session && !cronAuthorized) {
    if (isApiRoute) {
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
  matcher: ['/admin/:path*', '/api/:path*'],
};
