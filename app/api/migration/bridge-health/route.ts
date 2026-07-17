import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ROUTE_VERSION = 'BRIDGE-HEALTH-V1';
const JOB_KEY = 'migration-bridge-health';

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 100;
const LOCK_TIMEOUT_MINUTES = 10;
const FETCH_TIMEOUT_MS = 20_000;
const CONCURRENCY = 8;

type MigrationRedirect = {
  id: number;
  old_url: string | null;
  old_path: string | null;
  new_url: string | null;
  match_level: string | null;
  product_id: number | string | null;
  redirect_enabled: boolean | null;
};

type VerificationResult = {
  id: number;
  verified: boolean;
  verifyStatus: string;
  verifyHttp: number | null;
  verifyError: string | null;
  checkedUrl: string | null;
};

function getBatchSize(requestUrl: URL): number {
  const requested = Number(
    requestUrl.searchParams.get('limit') || DEFAULT_BATCH_SIZE
  );

  if (!Number.isFinite(requested) || requested <= 0) {
    return DEFAULT_BATCH_SIZE;
  }

  return Math.min(Math.floor(requested), MAX_BATCH_SIZE);
}

function normalizeNewUrl(
  newUrl: string | null,
  siteUrl: string
): string | null {
  const value = String(newUrl || '').trim();

  if (!value) {
    return null;
  }

  try {
    /*
     * Always verify the destination against the current new website.
     *
     * Examples:
     * /products/abc
     * https://orbit-control-next.vercel.app/products/abc
     * https://www.orbit-surplus.com/products/abc
     *
     * All become:
     * CURRENT_SITE/products/abc
     */
    const parsed = new URL(value, siteUrl);

    return `${siteUrl}${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  url: string,
  method: 'HEAD' | 'GET'
): Promise<Response> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      method,
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept:
          method === 'HEAD'
            ? '*/*'
            : 'text/html,application/xhtml+xml',
        'User-Agent':
          'Orbit-Control-Migration-Bridge-Health/1.0',
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyRedirect(
  row: MigrationRedirect,
  siteUrl: string
): Promise<VerificationResult> {
  const checkedUrl = normalizeNewUrl(row.new_url, siteUrl);

  if (!checkedUrl) {
    return {
      id: row.id,
      verified: false,
      verifyStatus: 'INVALID_NEW_URL',
      verifyHttp: null,
      verifyError: 'new_url is empty or invalid',
      checkedUrl: null,
    };
  }

  try {
    let response = await fetchWithTimeout(checkedUrl, 'HEAD');

    /*
     * Some servers or routes do not support HEAD properly.
     * Fall back to GET when HEAD is rejected.
     */
    if (response.status === 405 || response.status === 501) {
      response = await fetchWithTimeout(checkedUrl, 'GET');
    }

    const httpStatus = response.status;

    if (httpStatus >= 200 && httpStatus < 300) {
      return {
        id: row.id,
        verified: true,
        verifyStatus: 'OK',
        verifyHttp: httpStatus,
        verifyError: null,
        checkedUrl,
      };
    }

    if (
      httpStatus === 301 ||
      httpStatus === 302 ||
      httpStatus === 303 ||
      httpStatus === 307 ||
      httpStatus === 308
    ) {
      const location = response.headers.get('location');

      return {
        id: row.id,
        verified: false,
        verifyStatus: 'UNEXPECTED_REDIRECT',
        verifyHttp: httpStatus,
        verifyError: location
          ? `Redirected to: ${location}`
          : 'Redirect response without a location header',
        checkedUrl,
      };
    }

    if (httpStatus === 404) {
      return {
        id: row.id,
        verified: false,
        verifyStatus: 'NOT_FOUND',
        verifyHttp: httpStatus,
        verifyError: 'Destination product page returned 404',
        checkedUrl,
      };
    }

    if (httpStatus === 410) {
      return {
        id: row.id,
        verified: false,
        verifyStatus: 'GONE',
        verifyHttp: httpStatus,
        verifyError: 'Destination product page returned 410',
        checkedUrl,
      };
    }

    if (httpStatus >= 500) {
      return {
        id: row.id,
        verified: false,
        verifyStatus: 'SERVER_ERROR',
        verifyHttp: httpStatus,
        verifyError: `Destination returned HTTP ${httpStatus}`,
        checkedUrl,
      };
    }

    return {
      id: row.id,
      verified: false,
      verifyStatus: 'HTTP_ERROR',
      verifyHttp: httpStatus,
      verifyError: `Unexpected HTTP status ${httpStatus}`,
      checkedUrl,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    const aborted =
      error instanceof Error &&
      (error.name === 'AbortError' ||
        message.toLowerCase().includes('aborted'));

    return {
      id: row.id,
      verified: false,
      verifyStatus: aborted ? 'TIMEOUT' : 'FETCH_ERROR',
      verifyHttp: null,
      verifyError: aborted
        ? `Request exceeded ${FETCH_TIMEOUT_MS}ms`
        : message,
      checkedUrl,
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  handler: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= items.length) {
        return;
      }

      results[index] = await handler(items[index]);
    }
  }

  const workers = Array.from(
    {
      length: Math.min(concurrency, items.length),
    },
    () => worker()
  );

  await Promise.all(workers);

  return results;
}

async function ensureJobExists() {
  const now = new Date().toISOString();

  const { data: existingJob, error: readError } =
    await supabaseAdmin
      .from('catalog_jobs')
      .select('job_key')
      .eq('job_key', JOB_KEY)
      .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (existingJob) {
    return;
  }

  const { error: insertError } = await supabaseAdmin
    .from('catalog_jobs')
    .insert({
      job_key: JOB_KEY,
      cursor_offset: 0,
      is_running: false,
      last_processed: 0,
      last_updated: 0,
      last_unresolved: 0,
      last_failed: 0,
      last_rate_limited: false,
      heartbeat_at: now,
      updated_at: now,
    });

  if (insertError) {
    /*
     * Ignore a duplicate created by two simultaneous first requests.
     */
    if (insertError.code !== '23505') {
      throw insertError;
    }
  }
}

async function releaseLock(params?: {
  cursorOffset?: number;
  lastProcessed?: number;
  lastUpdated?: number;
  lastUnresolved?: number;
  lastFailed?: number;
  cycleCompleted?: boolean;
}) {
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    is_running: false,
    heartbeat_at: now,
    finished_at: now,
    updated_at: now,
  };

  if (params?.cursorOffset !== undefined) {
    update.cursor_offset = params.cursorOffset;
  }

  if (params?.lastProcessed !== undefined) {
    update.last_processed = params.lastProcessed;
  }

  if (params?.lastUpdated !== undefined) {
    update.last_updated = params.lastUpdated;
  }

  if (params?.lastUnresolved !== undefined) {
    update.last_unresolved = params.lastUnresolved;
  }

  if (params?.lastFailed !== undefined) {
    update.last_failed = params.lastFailed;
  }

  update.last_rate_limited = false;

  const { error } = await supabaseAdmin
    .from('catalog_jobs')
    .update(update)
    .eq('job_key', JOB_KEY);

  if (error) {
    console.error('FAILED TO RELEASE BRIDGE HEALTH LOCK:', error);
  }
}

export async function GET(req: Request) {
  let lockAcquired = false;

  try {
    const requestUrl = new URL(req.url);
    const batchSize = getBatchSize(requestUrl);

    const requestedOffsetRaw =
      requestUrl.searchParams.get('offset');

    const resetRequested =
      requestUrl.searchParams.get('reset') === '1';

    await ensureJobExists();

    if (resetRequested) {
      const now = new Date().toISOString();

      const { error: resetJobError } = await supabaseAdmin
        .from('catalog_jobs')
        .update({
          cursor_offset: 0,
          is_running: false,
          last_processed: 0,
          last_updated: 0,
          last_unresolved: 0,
          last_failed: 0,
          last_rate_limited: false,
          heartbeat_at: now,
          finished_at: null,
          updated_at: now,
        })
        .eq('job_key', JOB_KEY);

      if (resetJobError) {
        throw resetJobError;
      }

      /*
       * Reset verification results, but never change redirect_enabled.
       */
      const { error: resetRowsError } = await supabaseAdmin
        .from('migration_redirects')
        .update({
          verified: false,
          verify_status: null,
          verify_http: null,
          verify_error: null,
          verify_checked_at: null,
        })
        .in('match_level', [
          'EXACT_MATCH',
          'STRONG_MATCH',
        ]);

      if (resetRowsError) {
        throw resetRowsError;
      }

      return NextResponse.json({
        success: true,
        routeVersion: ROUTE_VERSION,
        status: 'BRIDGE_HEALTH_RESET',
        job: JOB_KEY,
        cursorOffset: 0,
        redirectEnabledChanged: false,
      });
    }

    const { data: currentJob, error: currentJobError } =
      await supabaseAdmin
        .from('catalog_jobs')
        .select(`
          job_key,
          cursor_offset,
          is_running,
          heartbeat_at,
          started_at,
          finished_at
        `)
        .eq('job_key', JOB_KEY)
        .single();

    if (currentJobError) {
      throw currentJobError;
    }

    /*
     * cursor_offset = -1 means the full health cycle completed.
     * Supplying ?offset=0 allows a manual batch test without resetting
     * stored verification data.
     */
    if (
      requestedOffsetRaw === null &&
      Number(currentJob?.cursor_offset) === -1
    ) {
      const [
        totalResult,
        verifiedResult,
        failedResult,
      ] = await Promise.all([
        supabaseAdmin
          .from('migration_redirects')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .in('match_level', [
            'EXACT_MATCH',
            'STRONG_MATCH',
          ]),

        supabaseAdmin
          .from('migration_redirects')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .in('match_level', [
            'EXACT_MATCH',
            'STRONG_MATCH',
          ])
          .eq('verified', true),

        supabaseAdmin
          .from('migration_redirects')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .in('match_level', [
            'EXACT_MATCH',
            'STRONG_MATCH',
          ])
          .eq('verified', false)
          .not('verify_checked_at', 'is', null),
      ]);

      if (totalResult.error) {
        throw totalResult.error;
      }

      if (verifiedResult.error) {
        throw verifiedResult.error;
      }

      if (failedResult.error) {
        throw failedResult.error;
      }

      return NextResponse.json({
        success: true,
        routeVersion: ROUTE_VERSION,
        status: 'BRIDGE_HEALTH_CYCLE_ALREADY_COMPLETE',
        job: JOB_KEY,
        cursorOffset: -1,

        totals: {
          safeRedirectRows: totalResult.count ?? 0,
          verifiedRows: verifiedResult.count ?? 0,
          failedRows: failedResult.count ?? 0,
        },

        redirectEnabledChanged: false,
      });
    }

    const staleBefore = new Date(
      Date.now() -
        LOCK_TIMEOUT_MINUTES * 60 * 1000
    ).toISOString();

    const { data: lockedJob, error: lockError } =
      await supabaseAdmin
        .from('catalog_jobs')
        .update({
          is_running: true,
          started_at: new Date().toISOString(),
          heartbeat_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('job_key', JOB_KEY)
        .or(
          `is_running.eq.false,heartbeat_at.is.null,heartbeat_at.lt.${staleBefore}`
        )
        .select(`
          job_key,
          cursor_offset,
          is_running,
          heartbeat_at
        `)
        .maybeSingle();

    if (lockError) {
      throw lockError;
    }

    if (!lockedJob) {
      return NextResponse.json({
        success: true,
        routeVersion: ROUTE_VERSION,
        status: 'JOB_ALREADY_RUNNING',
        job: JOB_KEY,
        lockTimeoutMinutes: LOCK_TIMEOUT_MINUTES,
        redirectEnabledChanged: false,
      });
    }

    lockAcquired = true;

    const storedOffset = Math.max(
      0,
      Number(lockedJob.cursor_offset || 0)
    );

    const currentOffset =
      requestedOffsetRaw === null
        ? storedOffset
        : Math.max(
            0,
            Number(requestedOffsetRaw || 0)
          );

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      'https://orbit-control-next.vercel.app'
    ).replace(/\/$/, '');

    /*
     * We use a stable ordered range.
     * cursor_offset here represents the number of rows already scanned,
     * not the database record ID.
     */
    const { data: rows, error: rowsError } =
      await supabaseAdmin
        .from('migration_redirects')
        .select(`
          id,
          old_url,
          old_path,
          new_url,
          match_level,
          product_id,
          redirect_enabled
        `)
        .in('match_level', [
          'EXACT_MATCH',
          'STRONG_MATCH',
        ])
        .eq('is_active', true)
        .order('id', {
          ascending: true,
        })
        .range(
          currentOffset,
          currentOffset + batchSize - 1
        );

    if (rowsError) {
      throw rowsError;
    }

    const bridgeRows =
      (rows || []) as MigrationRedirect[];

    const results = await mapWithConcurrency(
      bridgeRows,
      CONCURRENCY,
      (row) => verifyRedirect(row, siteUrl)
    );

    await supabaseAdmin
      .from('catalog_jobs')
      .update({
        heartbeat_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('job_key', JOB_KEY);

    let updatedRows = 0;
    let updateFailures = 0;

    /*
     * Update only verification columns.
     * redirect_enabled and match data remain untouched.
     */
    for (const result of results) {
      const { error: updateError } = await supabaseAdmin
        .from('migration_redirects')
        .update({
          verified: result.verified,
          verify_status: result.verifyStatus,
          verify_http: result.verifyHttp,
          verify_error: result.verifyError,
          verify_checked_at: new Date().toISOString(),
        })
        .eq('id', result.id);

      if (updateError) {
        updateFailures += 1;

        console.error(
          `BRIDGE HEALTH UPDATE FAILED FOR ID ${result.id}:`,
          updateError
        );
      } else {
        updatedRows += 1;
      }
    }

    const checked = results.length;
    const verified = results.filter(
      (item) => item.verified
    ).length;

    const unhealthy = results.filter(
      (item) => !item.verified
    ).length;

    const notFound = results.filter(
      (item) => item.verifyStatus === 'NOT_FOUND'
    ).length;

    const redirects = results.filter(
      (item) =>
        item.verifyStatus === 'UNEXPECTED_REDIRECT'
    ).length;

    const timeouts = results.filter(
      (item) => item.verifyStatus === 'TIMEOUT'
    ).length;

    const fetchErrors = results.filter(
      (item) => item.verifyStatus === 'FETCH_ERROR'
    ).length;

    const serverErrors = results.filter(
      (item) => item.verifyStatus === 'SERVER_ERROR'
    ).length;

    /*
     * If fewer rows than requested are returned, we reached the end.
     */
    const cycleCompleted =
      bridgeRows.length < batchSize;

    const nextOffset = cycleCompleted
      ? -1
      : currentOffset + bridgeRows.length;

    await releaseLock({
      cursorOffset: nextOffset,
      lastProcessed: checked,
      lastUpdated: updatedRows,
      lastUnresolved: unhealthy,
      lastFailed: updateFailures,
      cycleCompleted,
    });

    lockAcquired = false;

    const [
      totalCountResult,
      verifiedCountResult,
      checkedCountResult,
      failedCountResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('migration_redirects')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .in('match_level', [
          'EXACT_MATCH',
          'STRONG_MATCH',
        ])
        .eq('is_active', true),

      supabaseAdmin
        .from('migration_redirects')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .in('match_level', [
          'EXACT_MATCH',
          'STRONG_MATCH',
        ])
        .eq('is_active', true)
        .eq('verified', true),

      supabaseAdmin
        .from('migration_redirects')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .in('match_level', [
          'EXACT_MATCH',
          'STRONG_MATCH',
        ])
        .eq('is_active', true)
        .not('verify_checked_at', 'is', null),

      supabaseAdmin
        .from('migration_redirects')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .in('match_level', [
          'EXACT_MATCH',
          'STRONG_MATCH',
        ])
        .eq('is_active', true)
        .eq('verified', false)
        .not('verify_checked_at', 'is', null),
    ]);

    const countErrors = [
      totalCountResult.error,
      verifiedCountResult.error,
      checkedCountResult.error,
      failedCountResult.error,
    ].filter(Boolean);

    if (countErrors.length > 0) {
      throw countErrors[0];
    }

    const totalRows = totalCountResult.count ?? 0;
    const totalChecked =
      checkedCountResult.count ?? 0;
    const totalVerified =
      verifiedCountResult.count ?? 0;
    const totalFailed =
      failedCountResult.count ?? 0;

    const remaining = Math.max(
      0,
      totalRows - totalChecked
    );

    const progressPercent =
      totalRows > 0
        ? Number(
            (
              (totalChecked / totalRows) *
              100
            ).toFixed(2)
          )
        : 0;

    return NextResponse.json({
      success: true,
      routeVersion: ROUTE_VERSION,
      status: cycleCompleted
        ? 'BRIDGE_HEALTH_CYCLE_COMPLETE'
        : 'BRIDGE_HEALTH_BATCH_COMPLETE',

      mode:
        'locked-cursor-safe-redirect-health-no-auto-enable',

      job: JOB_KEY,
      siteUrl,
      lockTimeoutMinutes: LOCK_TIMEOUT_MINUTES,

      batch: {
        batchSize,
        currentOffset,
        nextOffset,
        cycleCompleted,
        checked,
        databaseUpdates: updatedRows,
        databaseUpdateFailures: updateFailures,
      },

      health: {
        verified,
        unhealthy,
        notFound,
        unexpectedRedirects: redirects,
        timeouts,
        fetchErrors,
        serverErrors,
      },

      totals: {
        safeRedirectRows: totalRows,
        checkedRows: totalChecked,
        verifiedRows: totalVerified,
        failedRows: totalFailed,
        remainingRows: remaining,
        progressPercent,
      },

      /*
       * This route intentionally never enables redirects.
       */
      redirects: {
        automaticallyEnabled: false,
        redirectEnabledChanged: false,
      },
    });
  } catch (error) {
    if (lockAcquired) {
      await releaseLock();
    }

    console.error('BRIDGE HEALTH V1 ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        routeVersion: ROUTE_VERSION,
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
