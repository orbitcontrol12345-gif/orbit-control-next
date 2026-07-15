import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLD_SITE = 'https://www.orbit-surplus.com';

const POSSIBLE_SITEMAPS = [
  '/sitemap_index.xml',
  '/sitemap.xml',
  '/wp-sitemap.xml',
  '/product-sitemap.xml',
  '/product-sitemap1.xml',
  '/product-sitemap2.xml',
];

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function extractLocs(xml: string): string[] {
  const matches = Array.from(
    xml.matchAll(/<loc[^>]*>([\s\S]*?)<\/loc>/gi)
  );

  return Array.from(
    new Set(
      matches
        .map((match) => decodeXml(String(match[1] || '').trim()))
        .filter(Boolean)
    )
  );
}

function looksLikeProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    return (
      path.includes('/product/') ||
      path.includes('/products/') ||
      path.includes('/shop/')
    );
  } catch {
    return false;
  }
}

function looksLikeSitemapUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    return (
      parsed.pathname.toLowerCase().includes('sitemap') &&
      parsed.pathname.toLowerCase().endsWith('.xml')
    );
  } catch {
    return false;
  }
}

async function fetchXml(url: string) {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; OrbitMigrationAudit/1.0)',
        Accept: 'application/xml,text/xml,text/plain,*/*',
      },
    });

    const text = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get('content-type'),
      text,
    };
  } catch (error: unknown) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      contentType: null,
      text: '',
      error:
        error instanceof Error
          ? error.message
          : 'Unknown fetch error',
    };
  }
}

export async function GET() {
  try {
    const checkedSitemaps: Array<Record<string, unknown>> = [];
    const discoveredSitemaps = new Set<string>();
    const productUrls = new Set<string>();

    for (const path of POSSIBLE_SITEMAPS) {
      const url = `${OLD_SITE}${path}`;
      const result = await fetchXml(url);

      const locs = result.ok ? extractLocs(result.text) : [];

      checkedSitemaps.push({
        url,
        ok: result.ok,
        status: result.status,
        finalUrl: result.finalUrl,
        contentType: result.contentType,
        locCount: locs.length,
      });

      if (!result.ok) {
        continue;
      }

      for (const loc of locs) {
        if (looksLikeSitemapUrl(loc)) {
          discoveredSitemaps.add(loc);
        }

        if (looksLikeProductUrl(loc)) {
          productUrls.add(loc);
        }
      }
    }

    const sitemapQueue = Array.from(discoveredSitemaps);
    const visitedSitemaps = new Set<string>();

    while (
      sitemapQueue.length > 0 &&
      visitedSitemaps.size < 100
    ) {
      const sitemapUrl = sitemapQueue.shift();

      if (!sitemapUrl) {
        continue;
      }

      if (visitedSitemaps.has(sitemapUrl)) {
        continue;
      }

      visitedSitemaps.add(sitemapUrl);

      const result = await fetchXml(sitemapUrl);

      if (!result.ok) {
        checkedSitemaps.push({
          url: sitemapUrl,
          ok: false,
          status: result.status,
          finalUrl: result.finalUrl,
          contentType: result.contentType,
          locCount: 0,
        });

        continue;
      }

      const locs = extractLocs(result.text);

      checkedSitemaps.push({
        url: sitemapUrl,
        ok: true,
        status: result.status,
        finalUrl: result.finalUrl,
        contentType: result.contentType,
        locCount: locs.length,
      });

      for (const loc of locs) {
        if (
          looksLikeSitemapUrl(loc) &&
          !visitedSitemaps.has(loc)
        ) {
          sitemapQueue.push(loc);
        }

        if (looksLikeProductUrl(loc)) {
          productUrls.add(loc);
        }
      }
    }

    const products = Array.from(productUrls);

    return NextResponse.json({
      success: true,
      routeVersion: 'MIGRATION-DISCOVER-OLD-V1',
      mode: 'audit-only-no-write',
      oldSite: OLD_SITE,
      checkedSitemapCount: checkedSitemaps.length,
      discoveredNestedSitemaps: discoveredSitemaps.size,
      oldProductUrlsFound: products.length,
      checkedSitemaps,
      sampleProductUrls: products.slice(0, 25),
      nextStep:
        products.length > 0
          ? 'Build old-to-new product matcher'
          : 'Inspect old sitemap structure',
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unexpected migration discovery error';

    return NextResponse.json(
      {
        success: false,
        routeVersion: 'MIGRATION-DISCOVER-OLD-V1',
        error: message,
      },
      { status: 500 }
    );
  }
}
