import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ROUTE_VERSION = 'SAVE-MIGRATION-BRIDGE-V3-AUDIT-CURSOR';
const OLD_SITE = 'https://www.orbit-surplus.com';
const MATCHER_PATH = '/api/migration/match-old-new';
const JOB_KEY = 'migration-save-bridge';
const BATCH_SIZE = 50;

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

type MatcherResult = {
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
  return matchLevel === 'EXACT_MATCH' || matchLevel === 'STRONG_MATCH';
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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

    const matcherUrl = `${requestUrl.origin}${MATCHER_PATH}?offset=${currentOffset}`;
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

    const auditRows = results
      .map((item) => {
        const oldUrl = String(item.oldUrl || '').trim();
        const oldPath = getOldPath(oldUrl);
        if (!oldUrl || !oldPath) return null;

        const oldPage = item.oldPage || {};
        const matchLevel = String(item.matchLevel || 'NO_MATCH');

        return {
          old_url: oldUrl,
          old_path: oldPath,
          old_slug: item.oldSlug ? String(item.oldSlug) : null,
          match_level: matchLevel,
          match_score: Number(item.score || 0),
          score_gap: toNullableNumber(item.scoreGap),
          title_similarity: toNullableNumber(item.titleSimilarity),
          matched_product_id: toNullableNumber(item.matchedProductId),
          ebay_item_id: item.ebayItemId ? String(item.ebayItemId) : null,
          brand: item.brand ? String(item.brand) : null,
          part_number: item.partNumber ? String(item.partNumber) : null,
          model_number: item.modelNumber ? String(item.modelNumber) : null,
          sku: item.sku ? String(item.sku) : null,
          product_name: item.productName ? String(item.productName) : null,
          new_url: item.newUrl ? String(item.newUrl) : null,
          match_reasons: Array.isArray(item.reasons) ? item.reasons : [],
          review_candidates: Array.isArray(item.reviewCandidates)
            ? item.reviewCandidates
            : [],
          old_page_status: toNullableNumber(oldPage.status ?? item.oldPageStatus),
          old_page_final_url: oldPage.finalUrl ? String(oldPage.finalUrl) : null,
          old_page_title: oldPage.title ? String(oldPage.title) : null,
          old_page_h1: oldPage.h1 ? String(oldPage.h1) : null,
          old_schema_name: oldPage.schemaName ? String(oldPage.schemaName) : null,
          old_schema_sku: oldPage.schemaSku ? String(oldPage.schemaSku) : null,
          old_schema_mpn: oldPage.schemaMpn ? String(oldPage.schemaMpn) : null,
          old_schema_brand: oldPage.schemaBrand ? String(oldPage.schemaBrand) : null,
          old_visible_sku: oldPage.visibleSku ? String(oldPage.visibleSku) : null,
          old_visible_mpn: oldPage.visibleMpn ? String(oldPage.visibleMpn) : null,
          old_identifier_candidates: Array.isArray(oldPage.identifierCandidates)
            ? oldPage.identifierCandidates
            : [],
          fetch_failed: matchLevel === 'OLD_PAGE_FETCH_FAILED',
          fetch_error: item.oldPageError ? String(item.oldPageError) : null,
          audited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    let auditSaved = 0;

    if (auditRows.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('migration_audit')
        .upsert(auditRows, { onConflict: 'old_url' })
        .select('id');

      if (error) throw error;
      auditSaved = data?.length || 0;
    }

    const safeMatches = results.filter((item) => isSafeMatch(item.matchLevel));

    const bridgeRows = safeMatches
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
          score_gap: toNullableNumber(item.scoreGap),
          product_id: toNullableNumber(item.matchedProductId),
          ebay_item_id: item.ebayItemId ? String(item.ebayItemId) : null,
          brand: item.brand ? String(item.brand) : null,
          part_number: item.partNumber ? String(item.partNumber) : null,
          product_name: item.productName ? String(item.productName) : null,
          match_reasons: Array.isArray(item.reasons) ? item.reasons : [],
          is_active: true,
          redirect_enabled: false,
          updated_at: new Date().toISOString(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    let bridgeSaved = 0;

    if (bridgeRows.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('migration_redirects')
        .upsert(bridgeRows, { onConflict: 'old_url' })
        .select('id');

      if (error) throw error;
      bridgeSaved = data?.length || 0;
    }

    const matcherNextOffset =
      matcherResult.nextOffset === null || matcherResult.nextOffset === undefined
        ? null
        : Number(matcherResult.nextOffset);

    const nextOffset = matcherNextOffset === null ? 0 : matcherNextOffset;
    const unresolved =
      Number(matcherResult.reviewMatches || 0) +
      Number(matcherResult.noMatches || 0);

    const { error: updateJobError } = await supabaseAdmin
      .from('catalog_jobs')
      .update({
        cursor_offset: nextOffset,
        last_processed: Number(matcherResult.oldUrlsScanned || 0),
        last_updated: bridgeSaved,
        last_unresolved: unresolved,
        last_failed: Number(matcherResult.oldPageFetchFailed || 0),
        last_rate_limited: false,
        updated_at: new Date().toISOString(),
      })
      .eq('job_key', JOB_KEY);

    if (updateJobError) throw updateJobError;

    const [auditCountResult, bridgeCountResult, enabledCountResult] =
      await Promise.all([
        supabaseAdmin
          .from('migration_audit')
          .select('*', { count: 'exact', head: true }),
        supabaseAdmin
          .from('migration_redirects')
          .select('*', { count: 'exact', head: true }),
        supabaseAdmin
          .from('migration_redirects')
          .select('*', { count: 'exact', head: true })
          .eq('redirect_enabled', true),
      ]);

    if (auditCountResult.error) throw auditCountResult.error;
    if (bridgeCountResult.error) throw bridgeCountResult.error;
    if (enabledCountResult.error) throw enabledCountResult.error;

    return NextResponse.json({
      success: true,
      routeVersion: ROUTE_VERSION,
      mode: 'cursor-save-full-audit-and-safe-bridge-no-auto-redirect',
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
      audit: {
        rowsPrepared: auditRows.length,
        saved: auditSaved,
        totalAuditRows: auditCountResult.count ?? 0,
      },
      bridge: {
        safeMatchesFound: safeMatches.length,
        rowsPrepared: bridgeRows.length,
        saved: bridgeSaved,
        totalBridgeRows: bridgeCountResult.count ?? 0,
      },
      nextOffset,
      cycleCompleted: matcherNextOffset === null,
      redirects: {
        automaticallyEnabled: false,
        enabledRows: enabledCountResult.count ?? 0,
      },
      sampleAuditRows: auditRows.slice(0, 10).map((row) => ({
        oldPath: row.old_path,
        matchLevel: row.match_level,
        newUrl: row.new_url,
        score: row.match_score,
      })),
    });
  } catch (error) {
    console.error('SAVE MIGRATION BRIDGE V3 AUDIT ERROR:', error);

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
