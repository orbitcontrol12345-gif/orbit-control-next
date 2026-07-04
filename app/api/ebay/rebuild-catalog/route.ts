import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://orbit-control-next.vercel.app';

const JOB_ID = 'ebay-rebuild';
const MAX_BATCHES_PER_RUN = 10;

export async function GET() {
  const results: any[] = [];

  for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
    const res = await fetch(
      `${SITE_URL}/api/ebay/sync-v2-all?batches=1`,
      { cache: 'no-store' }
    );

    const data = await res.json().catch(() => null);

    results.push({
      step: i + 1,
      ok: res.ok,
      data,
    });

    if (!res.ok || !data?.nextOffset) {
      return NextResponse.json({
        success: res.ok,
        jobId: JOB_ID,
        stopped: true,
        results,
      });
    }
  }

  return NextResponse.json({
    success: true,
    jobId: JOB_ID,
    message: 'Processed safe chunk. Run again to continue.',
    results,
  });
}
