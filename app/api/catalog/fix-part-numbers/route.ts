import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MARKETPLACE = 'EBAY_US';
const SELLER = 'orbitcontrol';

const PROCESS_LIMIT = 25;
const SCAN_LIMIT = 500;

type CandidateSource =
  | 'mpn'
  | 'manufacturer_part_number'
  | 'part_number'
  | 'model_number'
  | 'title';

type Candidate = {
  value: string;
  source: CandidateSource;
  score: number;
};

const GENERIC_VALUES = new Set([
  'UNKNOWN',
  'N/A',
  'NA',
  'NONE',
  'NOT-APPLICABLE',
  'DOES-NOT-APPLY',
  'SIMATIC',
  'SIMATIC-S7',
  'SIMATIC-S5',
  'S7',
  'S5',
  'SIRIUS',
  'SINAMICS',
  'SITOP',
  'MICROMASTER',
  'PLC',
  'HMI',
  'VFD',
  'DRIVE',
  'MODULE',
  'CONTROLLER',
  'RELAY',
  'SWITCH',
  'BOARD',
  'CARD',
  'UNIT',
  'SYSTEM',
  'TYPE',
  'MODEL',
  'POWER-SUPPLY',
]);

function normalizePartNumber(value: unknown): string {
  return String(value || '')
    .toUpperCase()
    .trim()
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'`([{<]+|[\s"'`\])}>.,;:]+$/g, '')
    .trim();
}

function canonicalCompare(value: unknown): string {
  return normalizePartNumber(value).replace(/[^A-Z0-9]/g, '');
}

function isEbayItemId(value: string, ebayItemId: string): boolean {
  return canonicalCompare(value) === canonicalCompare(ebayItemId);
}

function isElectricalRating(value: string): boolean {
  const v = normalizePartNumber(value).replace(/\s+/g, '');

  return (
    /^\d+(?:\.\d+)?(?:V|VAC|VDC|AC|DC|HZ|A|MA|AMP|AMPS|KW|W)$/i.test(v) ||
    /^\d+(?:\.\d+)?-\d+(?:\.\d+)?(?:V|VAC|VDC|AC|DC|HZ|A|MA|KW|W)$/i.test(v) ||
    /^\d+X\d+(?:V|VAC|VDC|A|MA|KW|W)$/i.test(v)
  );
}

function isNoise(value: string): boolean {
  const v = normalizePartNumber(value);

  if (!v) return true;
  if (GENERIC_VALUES.has(v)) return true;
  if (isElectricalRating(v)) return true;

  if (
    /\b(?:LOT|QTY|QUANTITY|PCS?|PIECES?|PACKS?|SETS?)\b/i.test(v)
  ) {
    return true;
  }

  if (/^(?:NEW|USED|OPEN BOX|REFURBISHED|TESTED)$/i.test(v)) {
    return true;
  }

  return false;
}

function isWeakExistingPartNumber(
  value: unknown,
  ebayItemId: unknown
): boolean {
  const v = normalizePartNumber(value);
  const itemId = String(ebayItemId || '').trim();

  if (!v) return true;
  if (isEbayItemId(v, itemId)) return true;
  if (isNoise(v)) return true;

  // Weak family-only labels such as CM-104, EM-222, CPU-315, SM-1231.
  if (
    /^(?:CM|EM|CPU|CP|FM|SM|PS|IM|PM|PLC|HMI|VFD|AI|AO|DI|DO|IO)-?\d{1,4}$/i.test(
      v
    )
  ) {
    return true;
  }

  return false;
}

function getAspectValue(item: any, names: string[]): string {
  const aspects = Array.isArray(item?.localizedAspects)
    ? item.localizedAspects
    : [];

  for (const expectedName of names) {
    const found = aspects.find(
      (aspect: any) =>
        String(aspect?.name || '').trim().toLowerCase() ===
        expectedName.toLowerCase()
    );

    const value = String(found?.value || '').trim();

    if (value) return value;
  }

  return '';
}

function cleanAuthoritativeValue(value: unknown): string {
  let v = normalizePartNumber(value);

  if (!v) return '';

  // Remove only explicit field labels, never arbitrary letters/numbers.
  v = v
    .replace(
      /^(?:MFR\.?\s*)?(?:PART\s*(?:NO|NUMBER)|P\/N|PN|MPN|MODEL\s*(?:NO|NUMBER)?|TYPE)\s*[:#-]?\s*/i,
      ''
    )
    .trim();

  return normalizePartNumber(v);
}

function isValidAuthoritativeCandidate(
  value: string,
  ebayItemId: string
): boolean {
  const v = cleanAuthoritativeValue(value);

  if (!v) return false;
  if (v.length < 2 || v.length > 80) return false;
  if (isEbayItemId(v, ebayItemId)) return false;
  if (isNoise(v)) return false;

  // Reject obvious descriptive sentences.
  if (v.split(/\s+/).length > 5) return false;

  // Must contain at least one letter or digit.
  if (!/[A-Z0-9]/i.test(v)) return false;

  return true;
}

function scoreAuthoritativeSource(source: CandidateSource): number {
  switch (source) {
    case 'mpn':
      return 10000;
    case 'manufacturer_part_number':
      return 9500;
    case 'part_number':
      return 9000;
    case 'model_number':
      return 8000;
    default:
      return 0;
  }
}

function titleCandidates(title: string): string[] {
  const patterns: RegExp[] = [
    // Siemens full industrial numbers.
    /\b6ES\d[\s-]?[A-Z0-9][A-Z0-9 -]{5,30}\b/gi,
    /\b6AV\d[A-Z0-9 -]{5,30}\b/gi,
    /\b6DP\d[A-Z0-9 -]{5,30}\b/gi,
    /\b6GK\d[A-Z0-9 -]{5,30}\b/gi,
    /\b6EP\d[A-Z0-9 -]{5,30}\b/gi,
    /\b7[A-Z]{1,3}\s?\d{3,5}(?:-\d+)?(?:\/[A-Z0-9-]+)?\b/gi,

    // GE Fanuc / industrial codes.
    /\bIC\d{3}[A-Z]{2,}\d{2,8}\b/gi,

    // Fanuc.
    /\bA\d{2}B-\d{4}-[A-Z0-9]{3,15}\b/gi,
    /\bA\d{2}B-\d{4}-[A-Z0-9]{3,15}\/[A-Z0-9]+\b/gi,

    // Allen-Bradley common catalog forms.
    /\b\d{3,4}-[A-Z]{1,5}\d{1,6}[A-Z0-9-]*\b/gi,

    // Strong slash/hyphen code such as P8AX09-T/MF.
    /\b[A-Z][A-Z0-9]{3,20}-[A-Z0-9]{1,15}\/[A-Z0-9]{1,15}\b/gi,

    // Strong multi-group industrial code.
    /\b[A-Z0-9]{2,15}(?:-[A-Z0-9]{2,15}){2,5}\b/gi,
  ];

  const found: string[] = [];

  for (const pattern of patterns) {
    const matches = title.match(pattern) || [];
    found.push(...matches);
  }

  return Array.from(
    new Set(found.map((value) => normalizePartNumber(value)))
  );
}

function isHighConfidenceTitleCandidate(
  value: string,
  ebayItemId: string
): boolean {
  const v = normalizePartNumber(value);

  if (!v) return false;
  if (v.length < 5 || v.length > 50) return false;
  if (isEbayItemId(v, ebayItemId)) return false;
  if (isNoise(v)) return false;

  // Title fallback MUST look structured. We intentionally do not accept
  // loose values such as "10-2A" or "026593" from a title alone.
  const strongPatterns = [
    /^6ES\d[A-Z0-9 -]{6,}$/i,
    /^6AV\d[A-Z0-9 -]{6,}$/i,
    /^6DP\d[A-Z0-9 -]{6,}$/i,
    /^6GK\d[A-Z0-9 -]{6,}$/i,
    /^6EP\d[A-Z0-9 -]{6,}$/i,
    /^7[A-Z]{1,3}\s?\d{3,5}(?:-\d+)?(?:\/[A-Z0-9-]+)?$/i,
    /^IC\d{3}[A-Z]{2,}\d{2,8}$/i,
    /^A\d{2}B-\d{4}-[A-Z0-9]{3,15}(?:\/[A-Z0-9]+)?$/i,
    /^\d{3,4}-[A-Z]{1,5}\d{1,6}[A-Z0-9-]*$/i,
    /^[A-Z][A-Z0-9]{3,20}-[A-Z0-9]{1,15}\/[A-Z0-9]{1,15}$/i,
    /^[A-Z0-9]{2,15}(?:-[A-Z0-9]{2,15}){2,5}$/i,
  ];

  return strongPatterns.some((pattern) => pattern.test(v));
}

function getBestPartNumber(
  item: any,
  title: string,
  ebayItemId: string
): Candidate | null {
  const authoritative: Array<{
    source: Exclude<CandidateSource, 'title'>;
    value: string;
  }> = [
    {
      source: 'mpn',
      value: getAspectValue(item, ['MPN']),
    },
    {
      source: 'manufacturer_part_number',
      value: getAspectValue(item, ['Manufacturer Part Number']),
    },
    {
      source: 'part_number',
      value: getAspectValue(item, ['Part Number']),
    },
    {
      source: 'model_number',
      value: getAspectValue(item, ['Model Number']),
    },
  ];

  const authoritativeCandidates: Candidate[] = authoritative
    .map(({ source, value }) => ({
      source,
      value: cleanAuthoritativeValue(value),
      score: scoreAuthoritativeSource(source),
    }))
    .filter((candidate) =>
      isValidAuthoritativeCandidate(candidate.value, ebayItemId)
    );

  authoritativeCandidates.sort((a, b) => b.score - a.score);

  if (authoritativeCandidates[0]) {
    return authoritativeCandidates[0];
  }

  const strongTitleCandidates: Candidate[] = titleCandidates(title)
    .filter((value) =>
      isHighConfidenceTitleCandidate(value, ebayItemId)
    )
    .map((value) => ({
      source: 'title' as const,
      value,
      score: 1000 + value.length,
    }))
    .sort((a, b) => b.score - a.score);

  return strongTitleCandidates[0] || null;
}

async function fetchEbayItem(
  ebayItemId: string,
  accessToken: string
): Promise<any | null> {
  const params = new URLSearchParams({
    q: ebayItemId,
    limit: '1',
    filter: `sellers:{${SELLER}}`,
  });

  const searchResponse = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
        'Accept-Language': 'en-US',
      },
      cache: 'no-store',
    }
  );

  if (searchResponse.status === 429) {
    throw new Error('EBAY_RATE_LIMIT_429');
  }

  const searchData = await searchResponse.json().catch(() => null);

  if (!searchResponse.ok) {
    throw new Error(
      `EBAY_SEARCH_${searchResponse.status}: ${JSON.stringify(
        searchData || {}
      ).slice(0, 300)}`
    );
  }

  const summary = searchData?.itemSummaries?.[0];

  if (!summary) return null;

  const browseItemId = String(summary.itemId || '').trim();

  if (!browseItemId) return summary;

  const detailResponse = await fetch(
    `https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(
      browseItemId
    )}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
        'Accept-Language': 'en-US',
      },
      cache: 'no-store',
    }
  );

  if (detailResponse.status === 429) {
    throw new Error('EBAY_RATE_LIMIT_429');
  }

  if (!detailResponse.ok) {
    return summary;
  }

  const detail = await detailResponse.json().catch(() => null);

  return detail || summary;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const offset = Math.max(
      0,
      Number(url.searchParams.get('offset') || 0)
    );

    const { data: rows, error: productsError } = await supabaseAdmin
      .from('products')
      .select(
        'id, ebay_item_id, part_number, model_number, name, marketplace'
      )
      .eq('marketplace', MARKETPLACE)
      .not('ebay_item_id', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + SCAN_LIMIT - 1);

    if (productsError) throw productsError;

    const suspiciousProducts = (rows || [])
      .filter((product) =>
        isWeakExistingPartNumber(
          product.part_number,
          product.ebay_item_id
        )
      )
      .slice(0, PROCESS_LIMIT);

    if (suspiciousProducts.length === 0) {
      return NextResponse.json({
        success: true,
        offset,
        scanned: rows?.length ?? 0,
        suspiciousFound: 0,
        processed: 0,
        updated: 0,
        unchanged: 0,
        unresolved: 0,
        failed: 0,
        rateLimited: false,
        message: 'No suspicious part numbers in this scan window.',
        nextOffset:
          (rows?.length ?? 0) === SCAN_LIMIT
            ? offset + SCAN_LIMIT
            : null,
      });
    }

    const token = await getEbayToken();
    const accessToken = String(token.access_token || '').trim();

    if (!accessToken) {
      throw new Error('Missing eBay access token');
    }

    let updated = 0;
    let unchanged = 0;
    let unresolved = 0;
    let failed = 0;
    let rateLimited = false;

    const results: Array<Record<string, unknown>> = [];

    for (const product of suspiciousProducts) {
      const ebayItemId = String(product.ebay_item_id || '').trim();

      try {
        const item = await fetchEbayItem(
          ebayItemId,
          accessToken
        );

        if (!item) {
          unresolved++;

          results.push({
            id: product.id,
            ebay_item_id: ebayItemId,
            old_part_number: product.part_number,
            status: 'unresolved_no_ebay_item',
          });

          continue;
        }

        const title = String(
          item.title || product.name || ''
        ).trim();

        const best = getBestPartNumber(
          item,
          title,
          ebayItemId
        );

        if (!best) {
          unresolved++;

          results.push({
            id: product.id,
            ebay_item_id: ebayItemId,
            old_part_number: product.part_number,
            status: 'unresolved_no_high_confidence_part_number',
            title,
          });

          continue;
        }

        const oldCanonical = canonicalCompare(
          product.part_number
        );
        const newCanonical = canonicalCompare(best.value);

        if (oldCanonical === newCanonical) {
          unchanged++;

          results.push({
            id: product.id,
            ebay_item_id: ebayItemId,
            old_part_number: product.part_number,
            candidate: best.value,
            source: best.source,
            status: 'unchanged_same_part_number',
          });

          continue;
        }

        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update({
            part_number: best.value,
            model_number: best.value,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateError) throw updateError;

        updated++;

        results.push({
          id: product.id,
          ebay_item_id: ebayItemId,
          old_part_number: product.part_number,
          new_part_number: best.value,
          source: best.source,
          status: 'updated_high_confidence',
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        if (message === 'EBAY_RATE_LIMIT_429') {
          rateLimited = true;

          results.push({
            id: product.id,
            ebay_item_id: ebayItemId,
            status: 'rate_limited',
          });

          break;
        }

        failed++;

        results.push({
          id: product.id,
          ebay_item_id: ebayItemId,
          old_part_number: product.part_number,
          status: 'failed',
          error: message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'high-confidence-only',
      offset,
      scanned: rows?.length ?? 0,
      suspiciousFound: suspiciousProducts.length,
      processed: results.length,
      updated,
      unchanged,
      unresolved,
      failed,
      rateLimited,
      nextOffset:
        (rows?.length ?? 0) === SCAN_LIMIT
          ? offset + SCAN_LIMIT
          : null,
      results,
    });
  } catch (error) {
    console.error('FIX PART NUMBERS ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
