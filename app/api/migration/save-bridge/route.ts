import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ROUTE_VERSION = 'SAVE-MIGRATION-BRIDGE-V2-CURSOR';
const OLD_SITE = 'https://www.orbit-surplus.com';
const MATCHER_PATH = '/api/migration/match-old-new';
const JOB_KEY = 'migration-save-bridge';
const BATCH_SIZE = 50;

type MatcherResult = {
  oldUrl?: string;
  matchLevel?: string;
  score?: number;
  scoreGap?: number | null;
  reasons?: string[];
  matchedProductId?: number | string | null;
  ebayItemId?: string | null;
  brand?: string | null;
  partNumber?: string | null;
  productName?: string | null;
  newUrl?: string | null;
};

function getOldPath(oldUrl: string): string {
  try {
    return new URL(oldUrl).pathname;
  } catch {
    return '';
  }
}

function isSafeMatch(matchLevel?: string): boolean {
  return matchLevel === 'EXACT_MATCH' || matchLevel === 'STRONG_MATCH';
}

export async function GET(req: Request) {
  try {
    const requestUrl = new URL(req.url);
    const requestedOffset = requestUrl.searchParams.get('offset');

    const { data: job, error: jobError } = await supabaseAdmin
      .from('catalog_jobs')
      .select('*')
      .eq('job_key', JOB_KEY)
      .single();

    if (jobError) throw jobError;

    const storedOffset = Math.max(0, Number(job?.cursor_offset || 0));
    const currentOffset =
      requestedOffset === null
        ? storedOffset
        : Math.max(0, Number(requestedOffset || 0));

    const matcherUrl =
      `${requestUrl.origin}${MATCHER_PATH}?offset=${currentOffset}`;

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
        `Migration matcher failed. status=${matcherResponse.status} body=${matcherText.slice(0, 1000)}`
      );
    }

    const results: MatcherResult[] = Array.isArray(matcherResult.results)
      ? matcherResult.results
      : [];

    const safeMatches = results.filter((item) =>
      isSafeMatch(item.matchLevel)
    );

    const rows = safeMatches
      .map((item) => {
        const oldUrl = String(item.oldUrl || '').trim();
        const oldPath = getOldPath(oldUrl);
        const newUrl = String(item.newUrl || '').trim();

        if (!oldUrl || !oldPath || !newUrl) return null;

        return {
          old_url: oldUrl,
          old_path: oldPath,
          new_url: newUrl,
          match_level: String(item.matchLevel || ''),
          match_score: Number(item.score || 0),
          score_gap:
            item.scoreGap === null || item.scoreGap === undefined
              ? null
              : Number(item.scoreGap),
          product_id:
            item.matchedProductId === null ||
            item.matchedProductId === undefined
              ? null
              : Number(item.matchedProductId),
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
          redirect_enabled: false,
          updated_at: new Date().toISOString(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    let saved = 0;

    if (rows.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('migration_redirects')
        .upsert(rows, { onConflict: 'old_url' })
        .select('id');

      if (error) throw error;
      saved = data?.length || 0;
    }

    const matcherNextOffset =
      matcherResult.nextOffset === null ||
      matcherResult.nextOffset === undefined
        ? null
        : Number(matcherResult.nextOffset);

    const nextOffset = matcherNextOffset === null ? 0 : matcherNextOffset;

    const { error: updateJobError } = await supabaseAdmin
      .from('catalog_jobs')
      .update({
        cursor_offset: nextOffset,
        last_processed: Number(matcherResult.oldUrlsScanned || 0),
        last_updated: saved,
        last_unresolved:
          Number(matcherResult.reviewMatches || 0) +
          Number(matcherResult.noMatches || 0),
        last_failed: Number(matcherResult.oldPageFetchFailed || 0),
        last_rate_limited: false,
        updated_at: new Date().toISOString(),
      })
      .eq('job_key', JOB_KEY);

    if (updateJobError) throw updateJobError;

    const { count: totalSavedCount } = await supabaseAdmin
      .from('migration_redirects')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      routeVersion: ROUTE_VERSION,
      mode: 'cursor-save-safe-matches-no-redirect',
      oldSite: OLD_SITE,
      job: JOB_KEY,
      currentOffset,
      batchSize: Number(matcherResult.batchSize) || BATCH_SIZE,
      scanned: Number(matcherResult.oldUrlsScanned || 0),
      matcher: {
        exactMatches: Number(matcherResult.exactMatches || 0),
        strongMatches: Number(matcherResult.strongMatches || 0),
        reviewMatches: Number(matcherResult.reviewMatches || 0),
        noMatches: Number(matcherResult.noMatches || 0),
        oldPageFetchFailed: Number(matcherResult.oldPageFetchFailed || 0),
      },
      safeMatchesFound: safeMatches.length,
      rowsPrepared: rows.length,
      saved,
      totalSavedBridgeRows: totalSavedCount ?? 0,
      nextOffset,
      cycleCompleted: matcherNextOffset === null,
      redirectEnabled: false,
      savedMatches: rows.slice(0, 25).map((row) => ({
        oldPath: row.old_path,
        newUrl: row.new_url,
        matchLevel: row.match_level,
        score: row.match_score,
        scoreGap: row.score_gap,
        partNumber: row.part_number,
      })),
    });
  } catch (error) {
    console.error('SAVE MIGRATION BRIDGE V2 ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        routeVersion: ROUTE_VERSION,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
