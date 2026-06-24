import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://orbit-control-next.vercel.app';

export async function GET() {
  try {
    const processRes = await fetch(
      `${SITE_URL}/api/ebay/process-queue?limit=200`,
      { cache: 'no-store' }
    );

    let processData: unknown = null;

    try {
      processData = await processRes.json();
    } catch {
      processData = await processRes.text();
    }

    return NextResponse.json({
      success: processRes.ok,
      processStatus: processRes.status,
      processData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
