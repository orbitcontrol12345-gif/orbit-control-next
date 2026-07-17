import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { runFixBrands } from '../run-fix-brands';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const JOB_NAME = 'fix-brands';

export async function GET() {
  try {
    const { data: job, error: jobError } = await supabaseAdmin
      .from('catalog_jobs')
      .select('cursor')
      .eq('name', JOB_NAME)
      .maybeSingle();

    if (jobError) {
      throw jobError;
    }

    const currentOffset = Math.max(
      0,
      Number(job?.cursor || 0)
    );

    const data = await runFixBrands({
      offset: currentOffset,
    });

    const nextOffset =
      typeof data.nextOffset === 'number'
        ? data.nextOffset
        : 0;

    const { error: updateError } = await supabaseAdmin
      .from('catalog_jobs')
      .upsert(
        {
          name: JOB_NAME,
          cursor: nextOffset,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'name',
        }
      );

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      job: JOB_NAME,
      routeVersion: data.routeVersion,
      currentOffset,
      nextOffset,
      rateLimited: Boolean(data.rateLimited),
      cleaner: {
        scanned: data.scanned ?? 0,
        suspiciousFound: data.suspiciousFound ?? 0,
        processed: data.processed ?? 0,
        updated: data.updated ?? 0,
        unchanged: data.unchanged ?? 0,
        unresolved: data.unresolved ?? 0,
        failed: data.failed ?? 0,
      },
    });
  } catch (error) {
    console.error('AUTO FIX BRANDS ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        job: JOB_NAME,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
