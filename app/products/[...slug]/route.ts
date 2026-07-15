import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE_VERSION = 'LEGACY-PRODUCT-REDIRECT-V1-SAFE';

type RouteContext = {
  params: Promise<{
    slug: string[];
  }>;
};

function normalizePath(pathname: string): string {
  const clean = `/${String(pathname || '')
    .split('/')
    .filter(Boolean)
    .join('/')}`;

  return clean === '/' ? '/' : `${clean}/`;
}

export async function GET(
  req: Request,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;

    const oldPath = normalizePath(
      `/product/${Array.isArray(slug) ? slug.join('/') : ''}`
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
      return NextResponse.json(
        {
          success: false,
          routeVersion: ROUTE_VERSION,
          status: 'LEGACY_REDIRECT_NOT_ENABLED_OR_NOT_FOUND',
          oldPath,
        },
        {
          status: 404,
          headers: {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
          },
        }
      );
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

    return response;
  } catch (error) {
    console.error(
      'LEGACY PRODUCT REDIRECT ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        routeVersion: ROUTE_VERSION,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      }
    );
  }
}
