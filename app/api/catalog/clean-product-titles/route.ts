import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cleanTitle } from '@/app/api/ebay/process-queue/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MARKETPLACE = 'EBAY_US';
const SCAN_LIMIT = 500;
const ROUTE_VERSION = 'CLEAN-TITLES-V2-CURSOR';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));

    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('id, name')
      .eq('marketplace', MARKETPLACE)
      .not('name', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + SCAN_LIMIT - 1);

    if (error) throw error;

    let scanned = 0;
    let updated = 0;
    let unchanged = 0;
    let failed = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const product of products ?? []) {
      scanned++;

      try {
        const oldName = String(product.name || '').trim();
        const newName = cleanTitle(oldName);

        if (!newName || newName === oldName) {
          unchanged++;
          continue;
        }

        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update({
            name: newName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateError) throw updateError;

        updated++;
        results.push({
          id: product.id,
          before: oldName,
          after: newName,
          status: 'updated',
        });
      } catch (error) {
        failed++;
        results.push({
          id: product.id,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      routeVersion: ROUTE_VERSION,
      offset,
      scanned,
      updated,
      unchanged,
      failed,
      nextOffset:
        (products?.length ?? 0) === SCAN_LIMIT
          ? offset + SCAN_LIMIT
          : null,
      results,
    });
  } catch (error) {
    console.error('CLEAN PRODUCT TITLES ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        routeVersion: ROUTE_VERSION,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
