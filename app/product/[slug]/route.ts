import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ROUTE_VERSION = 'LEGACY-PRODUCT-REDIRECT-V5-UNICODE';

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

function encodePathForLookup(pathname: string): string {
  return encodeURI(pathname).replace(
    /%[0-9A-F]{2}/g,
    (value) => value.toLowerCase()
  );
}

function createNotFoundResponse(oldPath: string) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />
  <meta name="robots" content="noindex, nofollow" />

  <title>
    Product Not Found | Orbit Control Automation
  </title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: #030b1a;
      color: #ffffff;
      font-family:
        Arial,
        Helvetica,
        sans-serif;
    }

    main {
      width: 100%;
      max-width: 620px;
      padding: 48px 32px;
      text-align: center;
      border: 1px solid rgba(212, 175, 55, 0.25);
      border-radius: 18px;
      background: #0b1730;
    }

    .code {
      margin: 0;
      color: #d4af37;
      font-size: 72px;
      font-weight: 800;
      line-height: 1;
    }

    h1 {
      margin: 20px 0 12px;
      font-size: 30px;
    }

    p {
      margin: 0 auto;
      max-width: 480px;
      color: #aab6cc;
      font-size: 15px;
      line-height: 1.7;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      margin-top: 30px;
    }

    a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 22px;
      border-radius: 9px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
    }

    .primary {
      background: #d4af37;
      color: #071126;
    }

    .secondary {
      border: 1px solid #42516d;
      color: #ffffff;
    }
  </style>
</head>

<body>
  <main>
    <p class="code">404</p>

    <h1>Product Page Not Found</h1>

    <p>
      This legacy product page is no longer available.
      Browse our current industrial automation inventory
      or submit a request for quotation.
    </p>

    <div class="actions">
      <a class="primary" href="/products">
        Browse Products
      </a>

      <a class="secondary" href="/rfq">
        Submit RFQ
      </a>
    </div>
  </main>
</body>
</html>`;

  return new NextResponse(html, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control':
        'public, max-age=300, s-maxage=3600',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Orbit-Legacy-Path':
        encodePathForLookup(oldPath),
      'X-Orbit-Route-Version': ROUTE_VERSION,
    },
  });
}

export async function GET(
  req: Request,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;

    let decodedSlug = '';

    try {
      decodedSlug = decodeURIComponent(
        String(slug || '').trim()
      );
    } catch {
      decodedSlug = String(slug || '').trim();
    }

    if (!decodedSlug) {
      return createNotFoundResponse('/product/');
    }

    const oldPath = normalizePath(
      `/product/${decodedSlug}`
    );

    const oldPathWithoutSlash =
      oldPath.length > 1
        ? oldPath.replace(/\/+$/, '')
        : oldPath;

    const encodedOldPath =
      encodePathForLookup(oldPath);

    const encodedOldPathWithoutSlash =
      encodedOldPath.length > 1
        ? encodedOldPath.replace(/\/+$/, '')
        : encodedOldPath;

    const candidatePaths = Array.from(
      new Set([
        oldPath,
        oldPathWithoutSlash,
        encodedOldPath,
        encodedOldPathWithoutSlash,
      ])
    );

    const canonicalOldUrls = Array.from(
      new Set([
        `https://www.orbit-surplus.com${oldPath}`,
        `https://www.orbit-surplus.com${oldPathWithoutSlash}`,
        `https://www.orbit-surplus.com${encodedOldPath}`,
        `https://www.orbit-surplus.com${encodedOldPathWithoutSlash}`,
        `https://orbit-surplus.com${oldPath}`,
        `https://orbit-surplus.com${oldPathWithoutSlash}`,
        `https://orbit-surplus.com${encodedOldPath}`,
        `https://orbit-surplus.com${encodedOldPathWithoutSlash}`,
      ])
    );

    let redirectRow: RedirectRow | null = null;

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
      return createNotFoundResponse(oldPath);
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

    return new NextResponse(
      'Internal Server Error',
      {
        status: 500,
        headers: {
          'Content-Type':
            'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Robots-Tag':
            'noindex, nofollow',
          'X-Orbit-Route-Version':
            ROUTE_VERSION,
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
