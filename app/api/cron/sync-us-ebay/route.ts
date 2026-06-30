import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;

    // اقرأ آخر Offset
    const stateRes = await fetch(
      `${origin}/api/sync-state`,
      { cache: 'no-store' }
    );

    if (!stateRes.ok) {
      throw new Error('Cannot read sync state');
    }

    const state = await stateRes.json();

    const offset = Number(state.current_offset || 0);

    // شغّل Sync
    const syncRes = await fetch(
      `${origin}/api/ebay/sync-us?offset=${offset}`,
      { cache: 'no-store' }
    );

    if (!syncRes.ok) {
      throw new Error('Sync failed');
    }

    const sync = await syncRes.json();

    const nextOffset =
      sync.nextOffset === null ? 0 : Number(sync.nextOffset);

    // خزّن الـ Offset الجديد
    await fetch(`${origin}/api/sync-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        current_offset: nextOffset,
      }),
    });

    return NextResponse.json({
      success: true,
      previousOffset: offset,
      nextOffset,
      processed: sync.processed,
      inserted: sync.inserted,
      updated: sync.updated,
      failed: sync.failed,
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
