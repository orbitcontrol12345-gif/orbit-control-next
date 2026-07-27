import { NextResponse } from 'next/server';

export async function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://orbit-surplus.com/sitemap-static.xml</loc>
  </sitemap>

  <sitemap>
    <loc>https://orbit-surplus.com/sitemap-products/1.xml</loc>
  </sitemap>

  <sitemap>
    <loc>https://orbit-surplus.com/sitemap-products/2.xml</loc>
  </sitemap>

  <sitemap>
    <loc>https://orbit-surplus.com/sitemap-products/3.xml</loc>
  </sitemap>

  <sitemap>
    <loc>https://orbit-surplus.com/sitemap-products/4.xml</loc>
  </sitemap>
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
