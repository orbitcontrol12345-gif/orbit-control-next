import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cleanTitle } from '@/app/api/ebay/process-queue/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMIT = 100;

export async function GET() {
  try {
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('id, name')
      .eq('marketplace', 'EBAY_US')
      .not('name', 'is', null)
      .order('id', { ascending: true })
      .limit(LIMIT);

    if (error) {
      throw error;
    }

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

        if (updateError) {
          throw updateError;
        }

        updated++;

        results.push({
          id: product.id,
          before: oldName,
          after: newName,
        });
      } catch (error) {
        failed++;

        results.push({
          id: product.id,
          status: 'failed',
          error:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      routeVersion: 'CLEAN-TITLES-V1',
      scanned,
      updated,
      unchanged,
      failed,
      results,
    });
  } catch (error) {
    console.error('CLEAN PRODUCT TITLES ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
