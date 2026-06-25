import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://orbit-control-next.vercel.app';

export async function GET() {
  const res = await fetch(`${SITE_URL}/api/ebay/process-queue?limit=200`, {
    cache: 'no-store',
  });

  const data = await res.json().catch(() => null);

  return NextResponse.json({
    success: res.ok,
    status: res.status,
    data,
  });
}
