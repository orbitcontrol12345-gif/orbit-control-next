import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ROUTE_VERSION = 'BRIDGE-HEALTH-V2-CONTENT';
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
  part_number: string | null;
  redirect_enabled: boolean | null;
};

type PageChecks = {
  hasTitle: boolean;
  hasH1: boolean;
  hasCanonical: boolean;
  hasCorrectCanonical: boolean; 
  hasMetaDescription: boolean;
  hasImage: boolean;
  hasPartNumber: boolean;
  soft404Detected: boolean;
};

type VerificationResult = {
  id: number;
  verified: boolean;
  verifyStatus: string;
  verifyHttp: number | null;
  verifyError: string | null;
  checkedUrl: string | null;
  pageChecks: PageChecks;
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
    const parsed = new URL(value, siteUrl);

    return `${siteUrl}${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value: string): string {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

function getFirstMatch(
  html: string,
  patterns: RegExp[]
): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return decodeHtml(match[1]);
    }
  }

  return null;
}

function getPageTitle(html: string): string | null {
  return getFirstMatch(html, [
    /<title[^>]*>([\s\S]*?)<\/title>/i,
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i,
  ]);
}

function getPageH1(html: string): string | null {
  const rawH1 = getFirstMatch(html, [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
  ]);

  return rawH1 ? stripHtml(rawH1) : null;
}

function getCanonical(html: string): string | null {
  return getFirstMatch(html, [
    /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["'][^>]*>/i,
  ]);
}

function getMetaDescription(html: string): string | null {
  return getFirstMatch(html, [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["'][^>]*>/i,
  ]);
}

function getMainImage(html: string): string | null {
  return getFirstMatch(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i,
    /<img[^>]+src=["']([^"']+)["'][^>]*>/i,
  ]);
}

function normalizeComparableUrl(
  value: string,
  siteUrl: string
): string | null {
  try {
    const parsed = new URL(value, siteUrl);

    const pathname =
      parsed.pathname.length > 1
        ? parsed.pathname.replace(/\/+$/, '')
        : parsed.pathname;

    return `${parsed.origin.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function canonicalMatchesUrl(
  canonical: string | null,
  checkedUrl: string | null
): boolean {
  if (!canonical || !checkedUrl) {
    return false;
  }

  try {
    const canonicalUrl = new URL(canonical);
    const checkedUrlObject = new URL(checkedUrl);

    const canonicalPath =
      canonicalUrl.pathname.replace(/\/+$/, '') || '/';

    const checkedPath =
      checkedUrlObject.pathname.replace(/\/+$/, '') || '/';

    return canonicalPath === checkedPath;
  } catch {
    return false;
  }
}

function detectSoft404(params: {
  html: string;
  title: string | null;
  h1: string | null;
}): boolean {
  const visibleText = stripHtml(params.html)
    .toLowerCase()
    .slice(0, 80_000);

  const title = String(params.title || '').toLowerCase();
  const h1 = String(params.h1 || '').toLowerCase();

  const phrases = [
    'product not found',
    'page not found',
    'this page could not be found',
    '404 not found',
    '404 - not found',
    'the requested product was not found',
    'this product is unavailable',
    'no product found',
    'هذا المنتج غير موجود',
    'المنتج غير موجود',
    'الصفحة غير موجودة',
  ];

  return phrases.some(
    (phrase) =>
      title.includes(phrase) ||
      h1.includes(phrase) ||
      visibleText.includes(phrase)
  );
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&nbsp;/gi, ' ')
    .replace(/[^a-z0-9]+/gi, '')
    .trim();
}

function containsPartNumber(
  html: string,
  partNumber: string | null | undefined
): boolean {
  const value = String(partNumber || '').trim();

  if (!value) {
    return false;
  }

  const visibleText = stripHtml(html);

  if (
    visibleText
      .toLowerCase()
      .includes(value.toLowerCase())
  ) {
    return true;
  }

  const normalizedPage =
    normalizeSearchText(visibleText);

  const normalizedPart =
    normalizeSearchText(value);

  return (
    normalizedPart.length > 0 &&
    normalizedPage.includes(normalizedPart)
  );
}

function emptyPageChecks(): PageChecks {
  return {
    hasTitle: false,
    hasH1: false,
    hasCanonical: false,
    hasCorrectCanonical: false,
    hasMetaDescription: false,
    hasImage: false,
    hasPartNumber: false,
    soft404Detected: false,
  };
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
          'Orbit-Control-Migration-Bridge-Health/2.0',
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
  const checkedUrl = normalizeNewUrl(
    row.new_url,
    siteUrl
  );

  if (!checkedUrl) {
    return {
      id: row.id,
      verified: false,
      verifyStatus: 'INVALID_NEW_URL',
      verifyHttp: null,
      verifyError: 'new_url is empty or invalid',
      checkedUrl: null,
      pageChecks: emptyPageChecks(),
    };
  }

  try {
    const response = await fetchWithTimeout(
      checkedUrl,
      'GET'
    );

    const httpStatus = response.status;

    if (
      httpStatus === 301 ||
      httpStatus === 302 ||
      httpStatus === 303 ||
      httpStatus === 307 ||
      httpStatus === 308
    ) {
      const location =
        response.headers.get('location');

      return {
        id: row.id,
        verified: false,
        verifyStatus: 'UNEXPECTED_REDIRECT',
        verifyHttp: httpStatus,
        verifyError: location
          ? `Redirected to: ${location}`
          : 'Redirect response without location',
        checkedUrl,
        pageChecks: emptyPageChecks(),
      };
    }

    if (httpStatus === 404) {
      return {
        id: row.id,
        verified: false,
        verifyStatus: 'NOT_FOUND',
        verifyHttp: 404,
        verifyError:
          'Destination product page returned 404',
        checkedUrl,
        pageChecks: emptyPageChecks(),
      };
    }

    if (httpStatus === 410) {
      return {
        id: row.id,
        verified: false,
        verifyStatus: 'GONE',
        verifyHttp: 410,
        verifyError:
          'Destination product page returned 410',
        checkedUrl,
        pageChecks: emptyPageChecks(),
      };
    }

    if (httpStatus >= 500) {
      return {
        id: row.id,
        verified: false,
        verifyStatus: 'SERVER_ERROR',
        verifyHttp: httpStatus,
        verifyError:
          `Destination returned HTTP ${httpStatus}`,
        checkedUrl,
        pageChecks: emptyPageChecks(),
      };
    }

    if (httpStatus < 200 || httpStatus >= 300) {
      return {
        id: row.id,
        verified: false,
        verifyStatus: 'HTTP_ERROR',
        verifyHttp: httpStatus,
        verifyError:
          `Unexpected HTTP status ${httpStatus}`,
        checkedUrl,
        pageChecks: emptyPageChecks(),
      };
    }

    const contentType =
      response.headers.get('content-type') || '';

    if (
      !contentType
        .toLowerCase()
        .includes('text/html')
    ) {
      return {
        id: row.id,
        verified: false,
        verifyStatus: 'INVALID_CONTENT_TYPE',
        verifyHttp: httpStatus,
        verifyError:
          `Expected HTML but received ${contentType || 'unknown'}`,
        checkedUrl,
        pageChecks: emptyPageChecks(),
      };
    }

    const html = await response.text();

    const title = getPageTitle(html);
    const h1 = getPageH1(html);
    const canonical = getCanonical(html);
    const metaDescription =
      getMetaDescription(html);
    const mainImage = getMainImage(html);
    
    console.log(`CHECKED_URL=${checkedUrl}`);
console.log(`CANONICAL_URL=${canonical}`);
    
    const soft404Detected = detectSoft404({
      html,
      title,
      h1,
    });

    const pageChecks: PageChecks = {
  hasTitle: Boolean(title?.trim()),
  hasH1: Boolean(h1?.trim()),
  hasCanonical: Boolean(canonical),

  hasCorrectCanonical: canonicalMatchesUrl(
    canonical,
    checkedUrl
  ),

  hasMetaDescription: Boolean(metaDescription?.trim()),

  hasImage: Boolean(mainImage),

  hasPartNumber: containsPartNumber(
    html,
    row.part_number
  ),

  soft404Detected,
};

    if (soft404Detected) {
      return {
        id: row.id,
        verified: false,
        verifyStatus: 'SOFT_404',
        verifyHttp: httpStatus,
        verifyError:
          'HTTP 200 page contains not-found content',
        checkedUrl,
        pageChecks,
      };
    }

    if (!pageChecks.hasTitle) {
      return {
        id: row.id,
        verified: false,
        verifyStatus: 'MISSING_TITLE',
        verifyHttp: httpStatus,
        verifyError:
          'Product page has no usable title',
        checkedUrl,
        pageChecks,
      };
    }

    if (!pageChecks.hasH1) {
      return {
        id: row.id,
        verified: false,
        verifyStatus: 'MISSING_H1',
        verifyHttp: httpStatus,
        verifyError:
          'Product page has no H1 heading',
        checkedUrl,
        pageChecks,
      };
    }

    const warnings: string[] = [];

    if (!pageChecks.hasCanonical) {
      warnings.push('MISSING_CANONICAL');
    } else if (!pageChecks.hasCorrectCanonical) {
      warnings.push('WRONG_CANONICAL');
    }

    if (!pageChecks.hasMetaDescription) {
      warnings.push('MISSING_META_DESCRIPTION');
    }

    if (!pageChecks.hasImage) {
      warnings.push('MISSING_IMAGE');
    }

    if (
      row.part_number &&
      !pageChecks.hasPartNumber
    ) {
      warnings.push('PART_NUMBER_NOT_VISIBLE');
    }

    return {
      id: row.id,
      verified: true,
      verifyStatus:
        warnings.length > 0
          ? 'OK_WITH_WARNINGS'
          : 'OK',
      verifyHttp: httpStatus,
      verifyError:
        warnings.length > 0
          ? JSON.stringify({
              warnings,
              title,
              h1,
              canonical,
              checkedUrl,
            })
          : null,
      checkedUrl,
      pageChecks,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    const aborted =
      error instanceof Error &&
      (
        error.name === 'AbortError' ||
        message.toLowerCase().includes('aborted')
      );

    return {
      id: row.id,
      verified: false,
      verifyStatus: aborted
        ? 'TIMEOUT'
        : 'FETCH_ERROR',
      verifyHttp: null,
      verifyError: aborted
        ? `Request exceeded ${FETCH_TIMEOUT_MS}ms`
        : message,
      checkedUrl,
      pageChecks: emptyPageChecks(),
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  handler: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] =
    new Array(items.length);

  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= items.length) {
        return;
      }

      results[index] =
        await handler(items[index]);
    }
  }

  const workers = Array.from(
    {
      length: Math.min(
        concurrency,
        items.length
      ),
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

  const { error: insertError } =
    await supabaseAdmin
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

  if (
    insertError &&
    insertError.code !== '23505'
  ) {
    throw insertError;
  }
}

async function releaseLock(params?: {
  cursorOffset?: number;
  lastProcessed?: number;
  lastUpdated?: number;
  lastUnresolved?: number;
  lastFailed?: number;
}) {
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    is_running: false,
    heartbeat_at: now,
    finished_at: now,
    updated_at: now,
    last_rate_limited: false,
  };

  if (params?.cursorOffset !== undefined) {
    update.cursor_offset =
      params.cursorOffset;
  }

  if (params?.lastProcessed !== undefined) {
    update.last_processed =
      params.lastProcessed;
  }

  if (params?.lastUpdated !== undefined) {
    update.last_updated =
      params.lastUpdated;
  }

  if (
    params?.lastUnresolved !== undefined
  ) {
    update.last_unresolved =
      params.lastUnresolved;
  }

  if (params?.lastFailed !== undefined) {
    update.last_failed =
      params.lastFailed;
  }

  const { error } = await supabaseAdmin
    .from('catalog_jobs')
    .update(update)
    .eq('job_key', JOB_KEY);

  if (error) {
    console.error(
      'FAILED TO RELEASE BRIDGE HEALTH LOCK:',
      error
    );
  }
}

export async function GET(req: Request) {
  let lockAcquired = false;

  try {
    const requestUrl = new URL(req.url);
    const batchSize =
      getBatchSize(requestUrl);

    const requestedOffsetRaw =
      requestUrl.searchParams.get('offset');

    const resetRequested =
      requestUrl.searchParams.get('reset') ===
      '1';

    await ensureJobExists();

    if (resetRequested) {
      const now =
        new Date().toISOString();

      const { error: resetJobError } =
        await supabaseAdmin
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
            started_at: null,
            finished_at: null,
            updated_at: now,
          })
          .eq('job_key', JOB_KEY);

      if (resetJobError) {
        throw resetJobError;
      }

      const { error: resetRowsError } =
        await supabaseAdmin
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
          ])
          .eq('is_active', true);

      if (resetRowsError) {
        throw resetRowsError;
      }

      return NextResponse.json({
        success: true,
        routeVersion: ROUTE_VERSION,
        status:
          'BRIDGE_HEALTH_RESET',
        job: JOB_KEY,
        cursorOffset: 0,
        redirectEnabledChanged: false,
      });
    }

    const {
      data: currentJob,
      error: currentJobError,
    } = await supabaseAdmin
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

    if (
      requestedOffsetRaw === null &&
      Number(currentJob?.cursor_offset) === -1
    ) {
      const [
        totalResult,
        verifiedResult,
        failedResult,
        warningResult,
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
          .eq('verified', false)
          .not(
            'verify_checked_at',
            'is',
            null
          ),

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
          .eq(
            'verify_status',
            'OK_WITH_WARNINGS'
          ),
      ]);

      const cycleErrors = [
        totalResult.error,
        verifiedResult.error,
        failedResult.error,
        warningResult.error,
      ].filter(Boolean);

      if (cycleErrors.length > 0) {
        throw cycleErrors[0];
      }

      return NextResponse.json({
        success: true,
        routeVersion: ROUTE_VERSION,
        status:
          'BRIDGE_HEALTH_CYCLE_ALREADY_COMPLETE',
        job: JOB_KEY,
        cursorOffset: -1,
        totals: {
          safeRedirectRows:
            totalResult.count ?? 0,
          verifiedRows:
            verifiedResult.count ?? 0,
          failedRows:
            failedResult.count ?? 0,
          warningRows:
            warningResult.count ?? 0,
        },
        redirectEnabledChanged: false,
      });
    }

    const staleBefore = new Date(
      Date.now() -
        LOCK_TIMEOUT_MINUTES *
          60 *
          1000
    ).toISOString();

    const now =
      new Date().toISOString();

    const {
      data: lockedJob,
      error: lockError,
    } = await supabaseAdmin
      .from('catalog_jobs')
      .update({
        is_running: true,
        started_at: now,
        heartbeat_at: now,
        updated_at: now,
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
        lockTimeoutMinutes:
          LOCK_TIMEOUT_MINUTES,
        redirectEnabledChanged: false,
      });
    }

    lockAcquired = true;

    const storedOffset = Math.max(
      0,
      Number(
        lockedJob.cursor_offset || 0
      )
    );

    const requestedOffset =
      Number(requestedOffsetRaw);

    const currentOffset =
      requestedOffsetRaw === null
        ? storedOffset
        : Number.isFinite(
              requestedOffset
            ) &&
            requestedOffset >= 0
          ? Math.floor(
              requestedOffset
            )
          : 0;

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      'https://orbit-control-next.vercel.app'
    ).replace(/\/$/, '');

    const {
      data: rows,
      error: rowsError,
    } = await supabaseAdmin
      .from('migration_redirects')
      .select(`
        id,
        old_url,
        old_path,
        new_url,
        match_level,
        product_id,
        part_number,
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
        currentOffset +
          batchSize -
          1
      );

    if (rowsError) {
      throw rowsError;
    }

    const bridgeRows =
      (rows ||
        []) as MigrationRedirect[];

    const results =
      await mapWithConcurrency(
        bridgeRows,
        CONCURRENCY,
        (row) =>
          verifyRedirect(
            row,
            siteUrl
          )
      );

    await supabaseAdmin
      .from('catalog_jobs')
      .update({
        heartbeat_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .eq('job_key', JOB_KEY);

    let updatedRows = 0;
    let updateFailures = 0;

    const checkedAt =
      new Date().toISOString();

    for (const result of results) {
      const { error: updateError } =
        await supabaseAdmin
          .from('migration_redirects')
          .update({
            verified:
              result.verified,
            verify_status:
              result.verifyStatus,
            verify_http:
              result.verifyHttp,
            verify_error:
              result.verifyError,
            verify_checked_at:
              checkedAt,
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

    const checked =
      results.length;

    const verified =
      results.filter(
        (item) => item.verified
      ).length;

    const unhealthy =
      results.filter(
        (item) => !item.verified
      ).length;

    const notFound =
      results.filter(
        (item) =>
          item.verifyStatus ===
          'NOT_FOUND'
      ).length;

    const unexpectedRedirects =
      results.filter(
        (item) =>
          item.verifyStatus ===
          'UNEXPECTED_REDIRECT'
      ).length;

    const timeouts =
      results.filter(
        (item) =>
          item.verifyStatus ===
          'TIMEOUT'
      ).length;

    const fetchErrors =
      results.filter(
        (item) =>
          item.verifyStatus ===
          'FETCH_ERROR'
      ).length;

    const serverErrors =
      results.filter(
        (item) =>
          item.verifyStatus ===
          'SERVER_ERROR'
      ).length;

    const okWithWarnings =
      results.filter(
        (item) =>
          item.verifyStatus ===
          'OK_WITH_WARNINGS'
      ).length;

    const soft404 =
      results.filter(
        (item) =>
          item.verifyStatus ===
          'SOFT_404'
      ).length;

    const missingTitle =
      results.filter(
        (item) =>
          item.verifyStatus ===
          'MISSING_TITLE'
      ).length;

    const missingH1 =
      results.filter(
        (item) =>
          item.verifyStatus ===
          'MISSING_H1'
      ).length;

    const missingCanonical =
      results.filter(
        (item) =>
          item.verifyHttp !== null &&
          item.verifyHttp >= 200 &&
          item.verifyHttp < 300 &&
          !item.pageChecks
            .hasCanonical
      ).length;

    const wrongCanonical =
      results.filter(
        (item) =>
          item.pageChecks
            .hasCanonical &&
          !item.pageChecks
            .hasCorrectCanonical
      ).length;

    const missingMetaDescription =
      results.filter(
        (item) =>
          item.verifyHttp !== null &&
          item.verifyHttp >= 200 &&
          item.verifyHttp < 300 &&
          !item.pageChecks
            .hasMetaDescription
      ).length;

    const missingImage =
      results.filter(
        (item) =>
          item.verifyHttp !== null &&
          item.verifyHttp >= 200 &&
          item.verifyHttp < 300 &&
          !item.pageChecks.hasImage
      ).length;

    const rowById = new Map(
      bridgeRows.map((row) => [
        row.id,
        row,
      ])
    );

    const partNumberNotVisible =
      results.filter((item) => {
        const row =
          rowById.get(item.id);

        return (
          Boolean(
            row?.part_number
          ) &&
          item.verifyHttp !== null &&
          item.verifyHttp >= 200 &&
          item.verifyHttp < 300 &&
          !item.pageChecks
            .hasPartNumber
        );
      }).length;

    const cycleCompleted =
      bridgeRows.length <
      batchSize;

    const nextOffset =
      cycleCompleted
        ? -1
        : currentOffset +
          bridgeRows.length;

    await releaseLock({
      cursorOffset:
        nextOffset,
      lastProcessed: checked,
      lastUpdated:
        updatedRows,
      lastUnresolved:
        unhealthy,
      lastFailed:
        updateFailures,
    });

    lockAcquired = false;

    const [
      totalCountResult,
      verifiedCountResult,
      checkedCountResult,
      failedCountResult,
      warningCountResult,
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
        .not(
          'verify_checked_at',
          'is',
          null
        ),

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
        .not(
          'verify_checked_at',
          'is',
          null
        ),

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
        .eq(
          'verify_status',
          'OK_WITH_WARNINGS'
        ),
    ]);

    const countErrors = [
      totalCountResult.error,
      verifiedCountResult.error,
      checkedCountResult.error,
      failedCountResult.error,
      warningCountResult.error,
    ].filter(Boolean);

    if (countErrors.length > 0) {
      throw countErrors[0];
    }

    const totalRows =
      totalCountResult.count ?? 0;

    const totalChecked =
      checkedCountResult.count ?? 0;

    const totalVerified =
      verifiedCountResult.count ?? 0;

    const totalFailed =
      failedCountResult.count ?? 0;

    const totalWarnings =
      warningCountResult.count ?? 0;

    const remaining = Math.max(
      0,
      totalRows -
        totalChecked
    );

    const progressPercent =
      totalRows > 0
        ? Number(
            (
              (totalChecked /
                totalRows) *
              100
            ).toFixed(2)
          )
        : 0;

    return NextResponse.json({
      success: true,
      routeVersion:
        ROUTE_VERSION,
      status: cycleCompleted
        ? 'BRIDGE_HEALTH_CYCLE_COMPLETE'
        : 'BRIDGE_HEALTH_BATCH_COMPLETE',

      mode:
        'locked-cursor-content-health-no-auto-enable',

      job: JOB_KEY,
      siteUrl,
      lockTimeoutMinutes:
        LOCK_TIMEOUT_MINUTES,

      batch: {
        batchSize,
        currentOffset,
        nextOffset,
        cycleCompleted,
        checked,
        databaseUpdates:
          updatedRows,
        databaseUpdateFailures:
          updateFailures,
      },

      health: {
        verified,
        unhealthy,
        okWithWarnings,
        notFound,
        unexpectedRedirects,
        timeouts,
        fetchErrors,
        serverErrors,
        soft404,
        missingTitle,
        missingH1,
        missingCanonical,
        wrongCanonical,
        missingMetaDescription,
        missingImage,
        partNumberNotVisible,
      },

      totals: {
        safeRedirectRows:
          totalRows,
        checkedRows:
          totalChecked,
        verifiedRows:
          totalVerified,
        failedRows:
          totalFailed,
        warningRows:
          totalWarnings,
        remainingRows:
          remaining,
        progressPercent,
      },

      redirects: {
        automaticallyEnabled:
          false,
        redirectEnabledChanged:
          false,
      },
    });
  } catch (error) {
    if (lockAcquired) {
      await releaseLock();
    }

    console.error(
      'BRIDGE HEALTH V2 ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        routeVersion:
          ROUTE_VERSION,
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
