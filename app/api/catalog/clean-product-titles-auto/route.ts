import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const JOB_KEY = 'clean-product-titles';

export async function GET(req: Request) {
  try {
    const { data: job, error: jobError } = await supabaseAdmin
      .from('catalog_jobs')
      .select('*')
      .eq('job_key', JOB_KEY)
      .single();

    if (jobError) throw jobError;

    const currentOffset = Math.max(
      0,
      Number(job?.cursor_offset || 0)
    );

    const requestUrl = new URL(req.url);
    const baseUrl = requestUrl.origin;

    const cleanerUrl =
      `${baseUrl}/api/catalog/clean-product-titles` +
      `?offset=${currentOffset}`;

    const cleanerResponse = await fetch(cleanerUrl, {
      method: 'GET',
      cache: 'no-store',
    });

    const cleanerResult = await cleanerResponse
      .json()
      .catch(() => null);

    if (!cleanerResponse.ok || !cleanerResult?.success) {
      throw new Error(
        `Title cleaner failed: ${JSON.stringify(cleanerResult)}`
      );
    }

    const nextOffset =
      cleanerResult.nextOffset === null ||
      cleanerResult.nextOffset === undefined
        ? 0
        : Number(cleanerResult.nextOffset);

    const { error: updateError } = await supabaseAdmin
      .from('catalog_jobs')
      .update({
        cursor_offset: nextOffset,
        last_processed: Number(cleanerResult.scanned || 0),
        last_updated: Number(cleanerResult.updated || 0),
        last_unresolved: 0,
        last_failed: Number(cleanerResult.failed || 0),
        last_rate_limited: false,
        updated_at: new Date().toISOString(),
      })
      .eq('job_key', JOB_KEY);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      job: JOB_KEY,
      routeVersion: cleanerResult.routeVersion,
      currentOffset,
      nextOffset,
      cleaner: {
        scanned: cleanerResult.scanned,
        updated: cleanerResult.updated,
        unchanged: cleanerResult.unchanged,
        failed: cleanerResult.failed,
      },
    });
  } catch (error) {
    console.error('AUTO CLEAN PRODUCT TITLES ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
