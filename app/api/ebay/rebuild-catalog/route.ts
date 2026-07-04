import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://orbit-control-next.vercel.app';

const JOB_ID = 'ebay-rebuild';
const MAX_BATCHES_PER_RUN = 5;

export async function GET() {
  try {
    const now = new Date().toISOString();

    const { data: job, error: jobError } = await supabaseAdmin
      .from('sync_jobs')
      .select('*')
      .eq('id', JOB_ID)
      .maybeSingle();

    if (jobError) throw jobError;

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'sync_jobs row not found' },
        { status: 500 }
      );
    }

    let offset = Number(job.offset_value || 0);
    const batchSize = Number(job.batch_size || 25);

    await supabaseAdmin
      .from('sync_jobs')
      .update({
        status: 'running',
        started_at: job.started_at || now,
        updated_at: now,
        last_error: null,
      })
      .eq('id', JOB_ID);

    const results: any[] = [];

    for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
      const res = await fetch(
        `${SITE_URL}/api/ebay/sync-v2?offset=${offset}&dryRun=false`,
        { cache: 'no-store' }
      );

      const data = await res.json().catch(() => null);

      results.push({
        step: i + 1,
        offset,
        ok: res.ok,
        data,
      });

      if (!res.ok || !data?.success) {
        const errorText = data?.error || `sync-v2 failed at offset ${offset}`;

        await supabaseAdmin
          .from('sync_jobs')
          .update({
            status: 'error',
            last_error: errorText,
            updated_at: new Date().toISOString(),
          })
          .eq('id', JOB_ID);

        return NextResponse.json(
          {
            success: false,
            jobId: JOB_ID,
            status: 'error',
            offset,
            error: errorText,
            results,
          },
          { status: 500 }
        );
      }

      await supabaseAdmin
        .from('sync_jobs')
        .update({
          processed: Number(job.processed || 0) + results.reduce((s, r) => s + Number(r.data?.processed || 0), 0),
          inserted: Number(job.inserted || 0) + results.reduce((s, r) => s + Number(r.data?.inserted || 0), 0),
          updated: Number(job.updated || 0) + results.reduce((s, r) => s + Number(r.data?.updated || 0), 0),
          failed: Number(job.failed || 0) + results.reduce((s, r) => s + Number(r.data?.failed || 0), 0),
          hidden_duplicates:
            Number(job.hidden_duplicates || 0) +
            results.reduce((s, r) => s + Number(r.data?.hiddenDuplicates || 0), 0),
          offset_value: data.nextOffset || offset,
          batch_size: batchSize,
          status: data.nextOffset ? 'running' : 'finished',
          updated_at: new Date().toISOString(),
          finished_at: data.nextOffset ? null : new Date().toISOString(),
        })
        .eq('id', JOB_ID);

      if (!data.nextOffset) {
        return NextResponse.json({
          success: true,
          jobId: JOB_ID,
          status: 'finished',
          nextOffset: null,
          results,
        });
      }

      offset = data.nextOffset;
    }

    return NextResponse.json({
      success: true,
      jobId: JOB_ID,
      status: 'running',
      nextOffset: offset,
      message: 'Processed safe chunk. Run again to continue.',
      results,
    });
  } catch (err: any) {
    await supabaseAdmin
      .from('sync_jobs')
      .update({
        status: 'error',
        last_error: err.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', JOB_ID);

    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
