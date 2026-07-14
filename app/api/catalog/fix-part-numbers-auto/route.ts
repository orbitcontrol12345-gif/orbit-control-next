import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const JOB_KEY = 'fix-part-numbers';

export async function GET(req: Request) {
  try {
    const { data: job, error: jobError } = await supabaseAdmin
      .from('catalog_jobs')
      .select('*')
      .eq('job_key', JOB_KEY)
      .single();

    if (jobError) {
      throw jobError;
    }

    const currentOffset = Math.max(
      0,
      Number(job?.cursor_offset || 0)
    );

    const requestUrl = new URL(req.url);
    const baseUrl = requestUrl.origin;

    const cleanerUrl =
      `${baseUrl}/api/catalog/fix-part-numbers` +
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
        `Cleaner failed: ${JSON.stringify(cleanerResult)}`
      );
    }

    const rateLimited =
      cleanerResult.rateLimited === true;

    let nextOffset = currentOffset;

    if (!rateLimited) {
      nextOffset =
        cleanerResult.nextOffset === null ||
        cleanerResult.nextOffset === undefined
          ? 0
          : Number(cleanerResult.nextOffset);
    }

    const { error: updateError } = await supabaseAdmin
      .from('catalog_jobs')
      .update({
        cursor_offset: nextOffset,
        last_processed: Number(
          cleanerResult.processed || 0
        ),
        last_updated: Number(
          cleanerResult.updated || 0
        ),
        last_unresolved: Number(
          cleanerResult.unresolved || 0
        ),
        last_failed: Number(
          cleanerResult.failed || 0
        ),
        last_rate_limited: rateLimited,
        updated_at: new Date().toISOString(),
      })
      .eq('job_key', JOB_KEY);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      job: JOB_KEY,
      routeVersion: cleanerResult.routeVersion,
      currentOffset,
      nextOffset,
      rateLimited,
      cleaner: {
        scanned: cleanerResult.scanned,
        suspiciousFound:
          cleanerResult.suspiciousFound,
        processed: cleanerResult.processed,
        updated: cleanerResult.updated,
        unchanged: cleanerResult.unchanged,
        unresolved: cleanerResult.unresolved,
        failed: cleanerResult.failed,
      },
    });
  } catch (error) {
    console.error(
      'AUTO FIX PART NUMBERS ERROR:',
      error
    );

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
