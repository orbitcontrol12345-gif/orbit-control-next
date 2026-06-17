import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;
export async function GET() {
  const offsets = [
    0, 200, 400, 600, 800,
    1000, 1200, 1400, 1600, 1800,
    2000, 2200, 2400, 2600, 2800,
    3000, 3200, 3400, 3600, 3800,
    4000, 4200, 4400, 4600, 4800
  ];

  const results = [];

  for (const offset of offsets) {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL}/api/ebay-products?save=true&offset=${offset}`
      );

      const data = await response.json();

      results.push({
        offset,
        fetched: data.fetched,
        inserted: data.inserted,
      });
    } catch (error) {
      results.push({
        offset,
        error: true,
      });
    }
  }

  return NextResponse.json({
    success: true,
    runs: results,
  });
}
