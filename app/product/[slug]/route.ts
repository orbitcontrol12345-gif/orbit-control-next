import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ROUTE_VERSION = 'LEGACY-PRODUCT-REDIRECT-V3-FALLBACK';

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

type RedirectRow = {
  id: number;
  old_url: string | null;
  old_path: string | null;
  new_url: string | null;
  match_level: string | null;
  is_active: boolean | null;
  redirect_enabled: boolean | null;
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

    const decodedSlug = decodeURIComponent(slug);

    const oldPath = normalizePath(
      `/product/${decodedSlug}`
    );

    const oldPathWithoutSlash =
      oldPath.replace(/\/+$/, '');

    const candidatePaths = Array.from(
      new Set([
        oldPath,
        oldPathWithoutSlash,
      ])
    );

    const canonicalOldUrls = [
      `https://www.orbit-surplus.com${oldPath}`,
      `https://www.orbit-surplus.com${oldPathWithoutSlash}`,
      `https://orbit-surplus.com${oldPath}`,
      `https://orbit-surplus.com${oldPathWithoutSlash}`,
    ];

    let redirectRow: RedirectRow | null = null;

    /*
     * First attempt: search by old_path.
     */
    const pathResult = await supabaseAdmin
      .from('migration_redirects')
      .select(`
        id,
        old_url,
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

    if (pathResult.error) {
      throw pathResult.error;
    }

    redirectRow =
      pathResult.data as RedirectRow | null;

    /*
     * Fallback: search by complete old_url.
     */
    if (!redirectRow?.new_url) {
      const urlResult = await supabaseAdmin
        .from('migration_redirects')
        .select(`
          id,
          old_url,
          old_path,
          new_url,
          match_level,
          is_active,
          redirect_enabled
        `)
        .in('old_url', canonicalOldUrls)
        .eq('is_active', true)
        .eq('redirect_enabled', true)
        .limit(1)
        .maybeSingle();

      if (urlResult.error) {
        throw urlResult.error;
      }

      redirectRow =
        urlResult.data as RedirectRow | null;
    }

    if (!redirectRow?.new_url) {
      return NextResponse.json(
        {
          success: false,
          routeVersion: ROUTE_VERSION,
          status:
            'LEGACY_REDIRECT_NOT_ENABLED_OR_NOT_FOUND',
          slug: decodedSlug,
          oldPath,
          candidatePaths,
          canonicalOldUrls,
          redirectEnabled: false,
        },
        {
          status: 404,
          headers: {
            'Cache-Control':
              'no-store, no-cache, must-revalidate',
            'X-Robots-Tag':
              'noindex, nofollow',
          },
        }
      );
    }

    const destination = new URL(
      redirectRow.new_url,
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
      'X-Orbit-Redirect-Id',
      String(redirectRow.id)
    );

    response.headers.set(
      'X-Orbit-Route-Version',
      ROUTE_VERSION
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
          'Cache-Control':
            'no-store, no-cache, must-revalidate',
          'X-Robots-Tag':
            'noindex, nofollow',
        },
      }
    );
  }
}
