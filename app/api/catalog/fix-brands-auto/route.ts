import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { runFixBrands } from '../run-fix-brands';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const JOB_KEY = 'fix-brands';

export async function GET() {
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

    const cleanerResult = await runFixBrands({
      offset: currentOffset,
    });

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
        scanned: cleanerResult.scanned || 0,
        suspiciousFound:
          cleanerResult.suspiciousFound || 0,
        processed: cleanerResult.processed || 0,
        updated: cleanerResult.updated || 0,
        unchanged: cleanerResult.unchanged || 0,
        unresolved: cleanerResult.unresolved || 0,
        failed: cleanerResult.failed || 0,
      },
    });
  } catch (error: unknown) {
    console.error('AUTO FIX BRANDS ERROR:', error);

    const errorDetails =
      error instanceof Error
        ? {
            message: error.message,
            name: error.name,
            stack: error.stack,
          }
        : typeof error === 'object' && error !== null
          ? error
          : {
              message: String(error),
            };

    return NextResponse.json(
      {
        success: false,
        job: JOB_KEY,
        error: errorDetails,
      },
      { status: 500 }
    );
  }
}
