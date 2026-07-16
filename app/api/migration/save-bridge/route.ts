import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ROUTE_VERSION = 'SAVE-MIGRATION-BRIDGE-V4-LOCKED';
const OLD_SITE = 'https://www.orbit-surplus.com';
const MATCHER_PATH = '/api/migration/match-old-new';
const JOB_KEY = 'migration-save-bridge';
const BATCH_SIZE = 50;
const LOCK_TIMEOUT_MINUTES = 10;

type OldPageData = {
  status?: number;
  finalUrl?: string;
  title?: string;
  h1?: string;
  schemaName?: string;
  schemaSku?: string;
  schemaMpn?: string;
  schemaBrand?: string;
  visibleSku?: string;
  visibleMpn?: string;
  identifierCandidates?: string[];
};

type MatcherItem = {
  oldUrl?: string;
  oldSlug?: string;
  oldPage?: OldPageData;
  matchLevel?: string;
  score?: number;
  scoreGap?: number | null;
  titleSimilarity?: number;
  reasons?: string[];
  reviewCandidates?: unknown[];
  matchedProductId?: number | string | null;
  ebayItemId?: string | null;
  brand?: string | null;
  partNumber?: string | null;
  modelNumber?: string | null;
  sku?: string | null;
  productName?: string | null;
  newUrl?: string | null;
  oldPageStatus?: number;
  oldPageError?: string | null;
};

function getOldPath(oldUrl: string): string {
  try {
    return new URL(oldUrl).pathname;
  } catch {
    return '';
  }
}

function isSafeMatch(matchLevel?: string): boolean {
  return (
    matchLevel === 'EXACT_MATCH' ||
    matchLevel === 'STRONG_MATCH'
  );
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function releaseLock(params?: {
  finished?: boolean;
  cursorOffset?: number;
  lastProcessed?: number;
  lastUpdated?: number;
  lastUnresolved?: number;
  lastFailed?: number;
}) {
  const update: Record<string, unknown> = {
    is_running: false,
    heartbeat_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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

  const { error } = await supabaseAdmin
    .from('catalog_jobs')
    .update(update)
    .eq('job_key', JOB_KEY);

  if (error) {
    console.error('FAILED TO RELEASE MIGRATION LOCK:', error);
  }
}

export async function GET(req: Request) {
  let lockAcquired = false;

  try {
    const requestUrl = new URL(req.url);
    const requestedOffset = requestUrl.searchParams.get('offset');

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
     * cursor_offset = -1 means the first complete audit cycle finished.
     * It prevents Cron from restarting the entire migration indefinitely.
     */
    if (
      requestedOffset === null &&
      Number(currentJob?.cursor_offset) === -1
    ) {
      return NextResponse.json({
        success: true,
        routeVersion: ROUTE_VERSION,
        status: 'MIGRATION_CYCLE_ALREADY_COMPLETE',
        job: JOB_KEY,
        cursorOffset: -1,
        redirectEnabledAutomatically: false,
      });
    }

    const staleBefore = new Date(
      Date.now() - LOCK_TIMEOUT_MINUTES * 60 * 1000
    ).toISOString();

    /*
     * Atomic lock acquisition:
     * - acquire when not running
     * - or when heartbeat is missing
     * - or when the old lock is stale
     */
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
        redirectEnabledAutomatically: false,
      });
    }

    lockAcquired = true;

    const storedOffset = Math.max(
      0,
      Number(lockedJob.cursor_offset || 0)
    );

    const currentOffset =
      requestedOffset === null
        ? storedOffset
        : Math.max(0, Number(requestedOffset || 0));

    const matcherUrl =
      `${requestUrl.origin}${MATCHER_PATH}` +
      `?offset=${currentOffset}`;

    const matcherResponse = await fetch(matcherUrl, {
      method: 'GET',
      cache: 'no-store',
    });

    const matcherText = await matcherResponse.text();

    let matcherResult: any = null;

    try {
      matcherResult = JSON.parse(matcherText);
    } catch {
      matcherResult = null;
    }

    if (!matcherResponse.ok || !matcherResult?.success) {
      throw new Error(
        `Migration matcher failed. status=${matcherResponse.status} body=${matcherText.slice(
          0,
          1000
        )}`
      );
    }

    await supabaseAdmin
      .from('catalog_jobs')
      .update({
        heartbeat_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('job_key', JOB_KEY);

    const results: MatcherItem[] = Array.isArray(
      matcherResult.results
    )
      ? matcherResult.results
      : [];

    /*
     * Save every scanned URL to migration_audit.
     */
    const auditRows = results
      .map((item) => {
        const oldUrl = String(item.oldUrl || '').trim();
        const oldPath = getOldPath(oldUrl);

        if (!oldUrl || !oldPath) {
          return null;
        }

        const oldPage = item.oldPage || {};
        const matchLevel = String(
          item.matchLevel || 'NO_MATCH'
        );

        return {
          old_url: oldUrl,
          old_path: oldPath,
          old_slug: item.oldSlug
            ? String(item.oldSlug)
            : null,

          match_level: matchLevel,
          match_score: Number(item.score || 0),
          score_gap: toNullableNumber(item.scoreGap),
          title_similarity: toNullableNumber(
            item.titleSimilarity
          ),

          matched_product_id: toNullableNumber(
            item.matchedProductId
          ),
          ebay_item_id: item.ebayItemId
            ? String(item.ebayItemId)
            : null,

          brand: item.brand ? String(item.brand) : null,
          part_number: item.partNumber
            ? String(item.partNumber)
            : null,
          model_number: item.modelNumber
            ? String(item.modelNumber)
            : null,
          sku: item.sku ? String(item.sku) : null,
          product_name: item.productName
            ? String(item.productName)
            : null,
          new_url: item.newUrl
            ? String(item.newUrl)
            : null,

          match_reasons: Array.isArray(item.reasons)
            ? item.reasons
            : [],
          review_candidates: Array.isArray(
            item.reviewCandidates
          )
            ? item.reviewCandidates
            : [],

          old_page_status: toNullableNumber(
            oldPage.status ?? item.oldPageStatus
          ),
          old_page_final_url: oldPage.finalUrl
            ? String(oldPage.finalUrl)
            : null,
          old_page_title: oldPage.title
            ? String(oldPage.title)
            : null,
          old_page_h1: oldPage.h1
            ? String(oldPage.h1)
            : null,
          old_schema_name: oldPage.schemaName
            ? String(oldPage.schemaName)
            : null,
          old_schema_sku: oldPage.schemaSku
            ? String(oldPage.schemaSku)
            : null,
          old_schema_mpn: oldPage.schemaMpn
            ? String(oldPage.schemaMpn)
            : null,
          old_schema_brand: oldPage.schemaBrand
            ? String(oldPage.schemaBrand)
            : null,
          old_visible_sku: oldPage.visibleSku
            ? String(oldPage.visibleSku)
            : null,
          old_visible_mpn: oldPage.visibleMpn
            ? String(oldPage.visibleMpn)
            : null,
          old_identifier_candidates: Array.isArray(
            oldPage.identifierCandidates
          )
            ? oldPage.identifierCandidates
            : [],

          fetch_failed:
            matchLevel === 'OLD_PAGE_FETCH_FAILED',
          fetch_error: item.oldPageError
            ? String(item.oldPageError)
            : null,

          audited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      })
      .filter(
        (
          row
        ): row is NonNullable<typeof row> => row !== null
      );

    let auditSaved = 0;

    if (auditRows.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('migration_audit')
        .upsert(auditRows, {
          onConflict: 'old_url',
        })
        .select('id');

      if (error) {
        throw error;
      }

      auditSaved = data?.length || 0;
    }

    await supabaseAdmin
      .from('catalog_jobs')
      .update({
        heartbeat_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('job_key', JOB_KEY);

    /*
     * Save only safe matches to migration_redirects.
     * redirect_enabled is intentionally omitted:
     * - new rows use the database default false
     * - existing manually enabled rows remain enabled
     */
    const safeMatches = results.filter((item) =>
      isSafeMatch(item.matchLevel)
    );

    const bridgeRows = safeMatches
      .map((item) => {
        const oldUrl = String(item.oldUrl || '').trim();
        const oldPath = getOldPath(oldUrl);
        const newUrl = String(item.newUrl || '').trim();

        if (!oldUrl || !oldPath || !newUrl) {
          return null;
        }

        return {
          old_url: oldUrl,
          old_path: oldPath,
          new_url: newUrl,
          match_level: String(item.matchLevel || ''),
          match_score: Number(item.score || 0),
          score_gap: toNullableNumber(item.scoreGap),
          product_id: toNullableNumber(
            item.matchedProductId
          ),
          ebay_item_id: item.ebayItemId
            ? String(item.ebayItemId)
            : null,
          brand: item.brand ? String(item.brand) : null,
          part_number: item.partNumber
            ? String(item.partNumber)
            : null,
          product_name: item.productName
            ? String(item.productName)
            : null,
          match_reasons: Array.isArray(item.reasons)
            ? item.reasons
            : [],
          is_active: true,
          updated_at: new Date().toISOString(),
        };
      })
      .filter(
        (
          row
        ): row is NonNullable<typeof row> => row !== null
      );

    let bridgeSaved = 0;

    if (bridgeRows.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('migration_redirects')
        .upsert(bridgeRows, {
          onConflict: 'old_url',
        })
        .select('id');

      if (error) {
        throw error;
      }

      bridgeSaved = data?.length || 0;
    }

    const matcherNextOffset =
      matcherResult.nextOffset === null ||
      matcherResult.nextOffset === undefined
        ? null
        : Number(matcherResult.nextOffset);

    const cycleCompleted = matcherNextOffset === null;

    /*
     * -1 is the completion sentinel.
     * Cron calls after completion return immediately.
     */
    const nextOffset = cycleCompleted
      ? -1
      : Number(matcherNextOffset);

    const unresolved =
      Number(matcherResult.reviewMatches || 0) +
      Number(matcherResult.noMatches || 0);

    await releaseLock({
      cursorOffset: nextOffset,
      lastProcessed: Number(
        matcherResult.oldUrlsScanned || 0
      ),
      lastUpdated: bridgeSaved,
      lastUnresolved: unresolved,
      lastFailed: Number(
        matcherResult.oldPageFetchFailed || 0
      ),
    });

    lockAcquired = false;

    const [
      auditCountResult,
      bridgeCountResult,
      enabledCountResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('migration_audit')
        .select('*', {
          count: 'exact',
          head: true,
        }),

      supabaseAdmin
        .from('migration_redirects')
        .select('*', {
          count: 'exact',
          head: true,
        }),

      supabaseAdmin
        .from('migration_redirects')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('redirect_enabled', true),
    ]);

    if (auditCountResult.error) {
      throw auditCountResult.error;
    }

    if (bridgeCountResult.error) {
      throw bridgeCountResult.error;
    }

    if (enabledCountResult.error) {
      throw enabledCountResult.error;
    }

    return NextResponse.json({
      success: true,
      routeVersion: ROUTE_VERSION,
      status: cycleCompleted
        ? 'MIGRATION_CYCLE_COMPLETE'
        : 'BATCH_COMPLETE',
      mode:
        'locked-cursor-full-audit-safe-bridge-no-auto-redirect',

      job: JOB_KEY,
      oldSite: OLD_SITE,
      lockTimeoutMinutes: LOCK_TIMEOUT_MINUTES,

      currentOffset,
      nextOffset,
      cycleCompleted,

      batchSize:
        Number(matcherResult.batchSize) || BATCH_SIZE,
      scanned: Number(
        matcherResult.oldUrlsScanned || 0
      ),

      matcher: {
        exactMatches: Number(
          matcherResult.exactMatches || 0
        ),
        strongMatches: Number(
          matcherResult.strongMatches || 0
        ),
        reviewMatches: Number(
          matcherResult.reviewMatches || 0
        ),
        noMatches: Number(
          matcherResult.noMatches || 0
        ),
        oldPageFetchFailed: Number(
          matcherResult.oldPageFetchFailed || 0
        ),
      },

      audit: {
        saved: auditSaved,
        totalRows: auditCountResult.count ?? 0,
      },

      bridge: {
        saved: bridgeSaved,
        totalRows: bridgeCountResult.count ?? 0,
      },

      redirects: {
        automaticallyEnabled: false,
        enabledRows: enabledCountResult.count ?? 0,
      },
    });
  } catch (error) {
    if (lockAcquired) {
      await releaseLock();
    }

    console.error(
      'SAVE MIGRATION BRIDGE V4 LOCKED ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        routeVersion: ROUTE_VERSION,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
