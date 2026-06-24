import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://orbit-control-next.vercel.app';

export async function GET() {
  const secret: string | undefined = process.env.CRON_SECRET;

  const headers: HeadersInit = {};



  const feed = await fetch(
  `${BASE_URL}/api/ebay/feed-to-queue?offset=10000`,
  { cache: 'no-store' }
);

const process = await fetch(
  `${BASE_URL}/api/ebay/process-queue?limit=200`,
  { cache: 'no-store' }
);

  return NextResponse.json({
    success: true,
    feedStatus: feed?.status || null,
    processStatus: process?.status || null,
  });
}
