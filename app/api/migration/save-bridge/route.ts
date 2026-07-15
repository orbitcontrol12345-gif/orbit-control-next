import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const OLD_SITE = 'https://www.orbit-surplus.com';
const MATCHER_PATH = '/api/migration/matcher-v4';
const BATCH_SIZE = 50;

type MatcherResult = {
  oldUrl?: string;
  oldSlug?: string;
  matchLevel?: string;
  score?: number;
  scoreGap?: number;
  reasons?: string[];
  matchedProductId?: number;
  ebayItemId?: string;
  brand?: string;
  partNumber?: string;
  productName?: string;
  newUrl?: string;
};

function getOldPath(oldUrl: string) {
  try {
    const url = new URL(oldUrl);
    return url.pathname;
  } catch {
    return '';
  }
}

function isSafeMatch(matchLevel: string | undefined) {
  return (
    matchLevel === 'EXACT_MATCH' ||
    matchLevel === 'STRONG_MATCH'
  );
}

export async function GET(req: Request) {
  try {
    const requestUrl = new URL(req.url);

    const offset = Math.max(
      0,
      Number(requestUrl.searchParams.get('offset') || 0)
    );

    const baseUrl = requestUrl.origin;

    const matcherUrl =
      `${baseUrl}${MATCHER_PATH}` +
      `?offset=${offset}`;

    const matcherResponse = await fetch(matcherUrl, {
      method: 'GET',
      cache: 'no-store',
    });

    const matcherResult = await matcherResponse
      .json()
      .catch(() => null);

    if (!matcherResponse.ok || !matcherResult?.success) {
      throw new Error(
        `Migration matcher failed: ${JSON.stringify(
          matcherResult
        )}`
      );
    }

    const results: MatcherResult[] = Array.isArray(
      matcherResult.results
    )
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

        if (!oldUrl || !oldPath || !newUrl) {
          return null;
        }

        return {
          old_url: oldUrl,
          old_path: oldPath,
          new_url: newUrl,

          match_level: String(
            item.matchLevel || ''
          ),

          match_score: Number(item.score || 0),

          score_gap:
            item.scoreGap === null ||
            item.scoreGap === undefined
              ? null
              : Number(item.scoreGap),

          product_id:
            item.matchedProductId === null ||
            item.matchedProductId === undefined
              ? null
              : Number(item.matchedProductId),

          ebay_item_id:
            item.ebayItemId
              ? String(item.ebayItemId)
              : null,

          brand:
            item.brand
              ? String(item.brand)
              : null,

          part_number:
            item.partNumber
              ? String(item.partNumber)
              : null,

          product_name:
            item.productName
              ? String(item.productName)
              : null,

          match_reasons: Array.isArray(item.reasons)
            ? item.reasons
            : [],

          is_active: true,

          // مهم جداً:
          // نحفظ الجسر فقط.
          // لا نشغل Redirect الآن.
          redirect_enabled: false,

          updated_at: new Date().toISOString(),
        };
      })
      .filter(
        (
          row
        ): row is NonNullable<typeof row> =>
          row !== null
      );

    let saved = 0;

    if (rows.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('migration_redirects')
        .upsert(rows, {
          onConflict: 'old_url',
        })
        .select('id');

      if (error) {
        throw error;
      }

      saved = data?.length || 0;
    }

    const nextOffset =
      matcherResult.nextOffset === null ||
      matcherResult.nextOffset === undefined
        ? null
        : Number(matcherResult.nextOffset);

    return NextResponse.json({
      success: true,

      routeVersion:
        'SAVE-MIGRATION-BRIDGE-V1-SAFE',

      mode:
        'save-safe-matches-no-redirect',

      oldSite: OLD_SITE,

      currentOffset: offset,

      batchSize:
        Number(matcherResult.batchSize) ||
        BATCH_SIZE,

      scanned:
        Number(
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

      safeMatchesFound: safeMatches.length,

      rowsPrepared: rows.length,

      saved,

      nextOffset,

      redirectEnabled: false,

      savedMatches: rows.map((row) => ({
        oldPath: row.old_path,
        newUrl: row.new_url,
        matchLevel: row.match_level,
        score: row.match_score,
        scoreGap: row.score_gap,
        partNumber: row.part_number,
      })),
    });
  } catch (error) {
    console.error(
      'SAVE MIGRATION BRIDGE ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        routeVersion:
          'SAVE-MIGRATION-BRIDGE-V1-SAFE',

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
