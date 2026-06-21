import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SITE_URL = 'https://orbit-control-next.vercel.app';
const STATE_ID = 'ebay_us_feed_import';
const STEP = 100;

import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const { data: state } = await supabaseAdmin
    .from('import_state')
    .select('last_offset')
    .eq('id', STATE_ID)
    .maybeSingle();

  const offset = state?.last_offset || 0;

  const res = await fetch(`${SITE_URL}/api/ebay/import-us-feed?offset=${offset}`, {
    cache: 'no-store',
  });

   const result = await res.json();

  const nextOffset = result.success ? offset + STEP : offset;

  await supabaseAdmin.from('import_state').upsert({
    id: STATE_ID,
    last_offset: nextOffset,
    last_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({
    success: result.success,
    offset,
    nextOffset,
    imported: result.imported,
    fetchedFromFeed: result.fetchedFromFeed,
    error: result.error || null,
    sample: result.sample || [],
    result,
  });
}
