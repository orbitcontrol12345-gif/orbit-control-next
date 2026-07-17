import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const JOB_KEY = 'fix-brands';

export async function GET(req: Request) {
  try {
    const { data: job, error: jobError } = await supabaseAdmin
      .from('catalog_jobs')
      .select('*')
      .eq('job_key', JOB_KEY)
      .single();

    if (jobError) {
      throw new Error(
        `Failed to load catalog job: ${jobError.message}`
      );
    }

    const currentOffset = Math.max(
      0,
      Number(job?.cursor_offset || 0)
    );

    const requestUrl = new URL(req.url);
    const baseUrl = requestUrl.origin;

    const cleanerUrl =
      `${baseUrl}/api/catalog/fix-brands` +
      `?offset=${currentOffset}`;

    const cleanerResponse = await fetch(cleanerUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Orbit-Control-Fix-Brands-Auto/1.0',
      },
    });

    /*
     * نقرأ النص أولًا بدل response.json()
     * حتى لا نخسر رسالة الخطأ إذا كانت الاستجابة HTML
     * أو فارغة أو ليست JSON.
     */
    const rawResponse = await cleanerResponse.text();

    let cleanerResult: any = null;

    if (rawResponse.trim()) {
      try {
        cleanerResult = JSON.parse(rawResponse);
      } catch {
        cleanerResult = null;
      }
    }

    if (!cleanerResponse.ok) {
      throw new Error(
        [
          `Brand cleaner HTTP error`,
          `status=${cleanerResponse.status}`,
          `statusText=${cleanerResponse.statusText}`,
          `body=${rawResponse.slice(0, 1000) || '[empty response]'}`,
        ].join(' | ')
      );
    }

    if (!cleanerResult) {
      throw new Error(
        `Brand cleaner returned invalid or empty JSON: ${
          rawResponse.slice(0, 1000) || '[empty response]'
        }`
      );
    }

    if (cleanerResult.success !== true) {
      throw new Error(
        `Brand cleaner reported failure: ${JSON.stringify(
          cleanerResult
        )}`
      );
    }

    const rateLimited =
      cleanerResult.rateLimited === true;

    let nextOffset = currentOffset;

    if (!rateLimited) {
      const returnedNextOffset =
        cleanerResult.nextOffset;

      nextOffset =
        returnedNextOffset === null ||
        returnedNextOffset === undefined
          ? 0
          : Math.max(
              0,
              Number(returnedNextOffset) || 0
            );
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
      throw new Error(
        `Failed to update catalog job: ${updateError.message}`
      );
    }

    return NextResponse.json({
      success: true,
      job: JOB_KEY,
      routeVersion:
        cleanerResult.routeVersion || 'UNKNOWN',
      currentOffset,
      nextOffset,
      rateLimited,
      cleaner: {
        scanned: Number(
          cleanerResult.scanned || 0
        ),
        suspiciousFound: Number(
          cleanerResult.suspiciousFound || 0
        ),
        processed: Number(
          cleanerResult.processed || 0
        ),
        updated: Number(
          cleanerResult.updated || 0
        ),
        unchanged: Number(
          cleanerResult.unchanged || 0
        ),
        unresolved: Number(
          cleanerResult.unresolved || 0
        ),
        failed: Number(
          cleanerResult.failed || 0
        ),
      },
    });
  } catch (error) {
    console.error(
      'AUTO FIX BRANDS ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        job: JOB_KEY,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}
