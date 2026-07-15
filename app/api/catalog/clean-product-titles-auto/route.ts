import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const JOB_KEY = 'clean-product-titles';
const LIMIT = 500;

function cleanTitle(title: string): string {
  return String(title || '')
    // Quantity / lot / pack noise from beginning.
    .replace(
      /^\s*\d*\s*LOTS?\s+\d+\s*(?:PCS?|PIECES?|UNITS?|ITEMS?)\b[\s:,.–—-]*/gi,
      ''
    )
    .replace(
      /^\s*(?:(?:\d+\s*)?LOTS?\s*)?(?:\d+\s*)?(?:PCS?|PIECES?|UNITS?|ITEMS?)\.?\b[\s:,.–—-]*/gi,
      ''
    )
    .replace(
      /^\s*(?:QTY|QUANTITY)\s*[:#-]?\s*\d+\b[\s:,.–—-]*/gi,
      ''
    )
    .replace(
      /^\s*\d+\s*[X×]\s*/gi,
      ''
    )
    .replace(
      /^\s*(?:PACK|SET)\s+OF\s+\d+\b[\s:,.–—-]*/gi,
      ''
    )

    // Quantity / lot / pack noise from end.
    .replace(
      /[\s:,.–—-]*(?:(?:\d+\s*)?LOTS?\s*)?(?:\d+\s*)?(?:PCS?|PIECES?|UNITS?|ITEMS?)\.?\s*$/gi,
      ''
    )
    .replace(
      /[\s:,.–—-]*(?:QTY|QUANTITY)\s*[:#-]?\s*\d+\s*$/gi,
      ''
    )
    .replace(
      /[\s:,.–—-]*(?:PACK|SET)\s+OF\s+\d+\s*$/gi,
      ''
    )

    // Other quantity patterns.
    .replace(
      /^\s*LOT\s+(?:OF\s+)?\d+(?:\.\d+)?\s*(?:PCS?|PIECES?)?\.?\s*/gi,
      ''
    )
    .replace(
      /^\s*\d+(?:\.\d+)?\s*(?:PCS?|PIECES?)\.?\s*/gi,
      ''
    )
    .replace(
      /\bLOT\s*#?\s*(?:OF\s+)?\d+(?:\.\d+)?\b/gi,
      ''
    )
    .replace(
      /\bQTY\s*[:#-]?\s*\d+(?:\.\d+)?\b/gi,
      ''
    )
    .replace(
      /\b\d+(?:\.\d+)?\s*(?:PCS?|PIECES?)\b/gi,
      ''
    )
    .replace(
      /\b(?:PCS?|PIECES?)\s*\d+(?:\.\d+)?\b/gi,
      ''
    )

    // Condition / packaging noise.
    .replace(/\bNEW\s*[-–—]?\s*OPEN\s+BOX\b/gi, '')
    .replace(/\bOPEN\s+BOX\b/gi, '')
    .replace(/\bNEW\s+OLD\s+STOCK\b/gi, '')
    .replace(/\bNEW\s+SEALED\b/gi, '')
    .replace(/\bREFURBISHED\b/gi, '')
    .replace(/\bNEW\b/gi, '')
    .replace(/\bUSED\b/gi, '')
    .replace(/\bW\/O\s+BOX\b/gi, '')
    .replace(/\bWITHOUT\s+BOX\b/gi, '')
    .replace(/\bNO\s+BOX\b/gi, '')
    .replace(/\bWITH\s+NO\s+ORIGINAL\s+BOX\b/gi, '')
    .replace(/\bNO\s+ORIGINAL\s+BOX\b/gi, '')
    .replace(/\bWITH\s+DAMAGED\s+BOX\b/gi, '')
    .replace(/\bDAMAGED\s+BOX\b/gi, '')
    .replace(/\bWITH\s+BROKEN\s+BOX\b/gi, '')
    .replace(/\bBROKEN\s+BOX\b/gi, '')
    .replace(/\bWITH\s+OLD\s+BOX\b/gi, '')
    .replace(/\bOLD\s+BOX\b/gi, '')
    .replace(/\bWITH\s+OLD\s+PACKAGING\b/gi, '')
    .replace(/\bOLD\s+PACKAGING\b/gi, '')
    .replace(/\bWITH\s+FILTHY\s+BOX\b/gi, '')
    .replace(/\bFILTHY\s+BOX\b/gi, '')

    // Testing noise.
    .replace(/\bTRIED\s*(?:&|AND)\s*TESTED\b/gi, '')
    .replace(/\bTESTED\s+OK\b/gi, '')

    // Accessories / parts noise.
    .replace(/\bWITHOUT\s+ANY\s+ACCESSORIES\b/gi, '')
    .replace(/\bWITHOUT\s+ACCESSORIES\b/gi, '')
    .replace(/\bW\/O\s+ACCESSORIES\b/gi, '')
    .replace(/\bNO\s+ACCESSORIES\b/gi, '')
    .replace(/\bFOR\s+PARTS\b/gi, '')
    .replace(/\bPARTS\s+ONLY\b/gi, '')
    .replace(/\bWITH\s+BROKEN\s+PARTS?\b/gi, '')
    .replace(/\bBROKEN\s+PARTS?\b/gi, '')
    .replace(/\bW\/\s*BROKEN\s+PART\b/gi, '')
    .replace(/\bWITH\s+MISSING\s+PART\b/gi, '')
    .replace(/\bMISSING\s+PART\b/gi, '')
    .replace(
      /\(?\bWITHOUT\s+COVER\s+FOR\s+BATTERY\b\)?/gi,
      ''
    )
    .replace(/\bW\/O\s+FRONT\s+COVER\b/gi, '')
    .replace(/\bWITHOUT\s+FRONT\s+COVER\b/gi, '')
    .replace(/\bWITH\s+BROKEN\s+BACK\s+PLATE\b/gi, '')
    .replace(/\bBROKEN\s+BACK\s+PLATE\b/gi, '')

    // Broken trailing fragments.
    .replace(/\s*[-–—]?\s*W\/\s*$/gi, '')
    .replace(/\s*[-–—]?\s*W\s*$/gi, '')

    // Final normalization.
    .replace(/^[\s.,:;|/\\\-–—]+/g, '')
    .replace(/[\s.,:;|/\\\-–—]+$/g, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET() {
  try {
    const { data: job, error: jobError } = await supabaseAdmin
      .from('catalog_jobs')
      .select('cursor_offset')
      .eq('job_key', JOB_KEY)
      .single();

    if (jobError) {
      throw jobError;
    }

    const currentOffset = Math.max(
      0,
      Number(job?.cursor_offset || 0)
    );

    const { data: products, error: productsError } =
      await supabaseAdmin
        .from('products')
        .select('id, name')
        .order('id', { ascending: true })
        .range(
          currentOffset,
          currentOffset + LIMIT - 1
        );

    if (productsError) {
      throw productsError;
    }

    const rows = products ?? [];

    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    const results: Array<Record<string, unknown>> = [];

    for (const product of rows) {
      try {
        const before = String(product.name || '').trim();
        const after = cleanTitle(before);

        if (!after || after === before) {
          unchanged++;
          continue;
        }

        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update({
            name: after,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateError) {
          throw updateError;
        }

        updated++;

        if (results.length < 25) {
          results.push({
            id: product.id,
            before,
            after,
          });
        }
      } catch (error) {
        failed++;

        console.error(
          `TITLE CLEAN FAILED FOR PRODUCT ${product.id}:`,
          error
        );
      }
    }

    const nextOffset =
      rows.length < LIMIT
        ? 0
        : currentOffset + LIMIT;

    const { error: updateJobError } = await supabaseAdmin
      .from('catalog_jobs')
      .update({
        cursor_offset: nextOffset,
        last_processed: rows.length,
        last_updated: updated,
        last_unresolved: 0,
        last_failed: failed,
        last_rate_limited: false,
        updated_at: new Date().toISOString(),
      })
      .eq('job_key', JOB_KEY);

    if (updateJobError) {
      throw updateJobError;
    }

    return NextResponse.json({
      success: true,
      job: JOB_KEY,
      routeVersion: 'CLEAN-TITLES-AUTO-V3-DIRECT',
      mode: 'direct-clean-no-internal-fetch',
      currentOffset,
      nextOffset,
      cleaner: {
        scanned: rows.length,
        updated,
        unchanged,
        failed,
      },
      results,
    });
  } catch (error) {
    console.error(
      'AUTO CLEAN PRODUCT TITLES ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        routeVersion: 'CLEAN-TITLES-AUTO-V3-DIRECT',
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
