import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE_VERSION = 'LEGACY-PRODUCT-REDIRECT-V2-SEO';

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

function normalizePath(pathname: string): string {
  const clean = `/${String(pathname || '')
    .split('/')
    .filter(Boolean)
    .join('/')}`;

  return clean === '/' ? '/' : `${clean}/`;
}

function createNotFoundResponse(oldPath: string) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, nofollow">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page Not Found | Orbit Control Automation</title>
</head>
<body>
  <main>
    <h1>404 - Page Not Found</h1>
    <p>The requested product page is no longer available.</p>
    <p><a href="/products">Browse our current products</a></p>
  </main>
</body>
</html>`;

  return new NextResponse(html, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Orbit-Legacy-Path': oldPath,
    },
  });
}

export async function GET(
  req: Request,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;

    const decodedSlug = decodeURIComponent(
      String(slug || '').trim()
    );

    if (!decodedSlug) {
      return createNotFoundResponse('/product/');
    }

    const oldPath = normalizePath(
      `/product/${decodedSlug}`
    );

    const pathWithoutTrailingSlash =
      oldPath.length > 1
        ? oldPath.replace(/\/+$/, '')
        : oldPath;

    const candidatePaths = Array.from(
      new Set([
        oldPath,
        pathWithoutTrailingSlash,
      ])
    );

    const { data: redirectRow, error } =
      await supabaseAdmin
        .from('migration_redirects')
        .select(`
          id,
          old_path,
          new_url,
          match_level,
          is_active,
          redirect_enabled
        `)
        .in('old_path', candidatePaths)
        .eq('is_active', true)
        .eq('redirect_enabled', true)
        .limit(1)
        .maybeSingle();

    if (error) {
      throw error;
    }

    if (!redirectRow?.new_url) {
      return createNotFoundResponse(oldPath);
    }

    const destination = new URL(
      String(redirectRow.new_url),
      req.url
    );

    const response = NextResponse.redirect(
      destination,
      308
    );

    response.headers.set(
      'Cache-Control',
      'public, max-age=3600, s-maxage=86400'
    );

    response.headers.set(
      'X-Orbit-Migration',
      'legacy-product-redirect'
    );

    response.headers.set(
      'X-Robots-Tag',
      'noindex, follow'
    );

    return response;
  } catch (error) {
    console.error(
      'LEGACY PRODUCT REDIRECT ERROR:',
      error
    );

    return new NextResponse(
      'Internal Server Error',
      {
        status: 500,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      }
    );
  }
}

export async function HEAD(
  req: Request,
  context: RouteContext
) {
  const response = await GET(req, context);

  return new NextResponse(null, {
    status: response.status,
    headers: response.headers,
  });
}
