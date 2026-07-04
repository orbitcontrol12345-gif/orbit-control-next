import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://orbit-control-next.vercel.app';

async function runStep(path: string) {
  const res = await fetch(`${SITE_URL}${path}`, { cache: 'no-store' });
  const data = await res.json().catch(() => null);

  return {
    ok: res.ok,
    path,
    data,
  };
}

function isFinished(data: any) {
  return data?.status === 'finished' || data?.nextOffset === null;
}

export async function GET() {
  try {
    const steps: any[] = [];

    const rebuild = await runStep('/api/ebay/rebuild-catalog');
    steps.push(rebuild);

    if (!isFinished(rebuild.data)) {
      return NextResponse.json({
        success: true,
        stage: 'rebuild-catalog',
        message: 'Rebuild catalog is still running.',
        steps,
      });
    }

    const cleanup = await runStep('/api/catalog/final-cleanup');
    steps.push(cleanup);

    if (!isFinished(cleanup.data)) {
      return NextResponse.json({
        success: true,
        stage: 'final-cleanup',
        message: 'Final cleanup is still running.',
        steps,
      });
    }

    const deduplicate = await runStep('/api/catalog/deduplicate-apply');
    steps.push(deduplicate);

    if (!isFinished(deduplicate.data)) {
      return NextResponse.json({
        success: true,
        stage: 'deduplicate',
        message: 'Deduplication is still running.',
        steps,
      });
    }

    return NextResponse.json({
      success: true,
      stage: 'finished',
      message: 'Catalog maintenance completed.',
      steps,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      { status: 500 }
    );
  }
}
