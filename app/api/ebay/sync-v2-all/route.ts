import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://orbit-control-next.vercel.app';

export async function GET(request: Request) {
  const url = new URL(request.url);

  let offset = Number(url.searchParams.get('offset') || 0);
  const batches = Number(url.searchParams.get('batches') || 5);

  const results: any[] = [];

  for (let i = 0; i < batches; i++) {
    const res = await fetch(
      `${SITE_URL}/api/ebay/sync-v2?offset=${offset}&dryRun=false`,
      { cache: 'no-store' }
    );

    const data = await res.json().catch(() => null);

    results.push({
      offset,
      ok: res.ok,
      data,
    });

    if (!res.ok || !data?.nextOffset) {
      return NextResponse.json({
        success: res.ok,
        stopped: true,
        currentOffset: offset,
        nextOffset: data?.nextOffset || null,
        results,
      });
    }

    offset = data.nextOffset;
  }

  return NextResponse.json({
    success: true,
    processedBatches: batches,
    nextOffset: offset,
    results,
  });
}
