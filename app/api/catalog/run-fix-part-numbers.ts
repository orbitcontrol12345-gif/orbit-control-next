
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MARKETPLACE = 'EBAY_US';
const SELLER = 'orbitcontrol';

const PROCESS_LIMIT = 25;
const SCAN_LIMIT = 500;
const ROUTE_VERSION = 'V6-RATING-FIX';

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
  'NOT APPLICABLE',
  'NOT-APPLICABLE',
  'DOES NOT APPLY',
  'DOES-NOT-APPLY',
  'SIMATIC',
  'SIMATIC S7',
  'SIMATIC-S7',
  'SIMATIC S5',
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
  'POWER SUPPLY',
  'POWER-SUPPLY',
]);

const DESCRIPTION_WORDS = [
  'CONTROLLER',
  'CONTROL',
  'POWER',
  'SUPPLY',
  'SOURCE',
  'BOARD',
  'CARD',
  'MODULE',
  'CONVERTER',
  'INVERTER',
  'SENSOR',
  'SWITCH',
  'RELAY',
  'PROCESSOR',
  'PANEL',
  'DISPLAY',
  'MONITOR',
  'MOTOR',
  'DRIVE',
  'AMPLIFIER',
  'TRANSFORMER',
  'CONTACTOR',
  'BREAKER',
  'TERMINAL',
  'CIRCUIT',
  'AUTOMATIC',
  'SAFETY',
  'PRINTED',
  'CURRENT',
  'VOLTAGE',
  'SOURCE',
  'KONSTANTSTROMQUELLE',
];

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

  // Important:
  // Do not treat long digit-leading industrial codes such as 393151A
  // as "393151 amps". Typical standalone ratings use a much shorter
  // numeric portion. This prevents valid part numbers ending in A/V/W
  // from being rejected as electrical ratings.
  return (
    /^\d{1,5}(?:\.\d+)?(?:V|VAC|VDC|AC|DC|HZ|A|MA|AMP|AMPS|KW|W)$/i.test(v) ||
    /^\d{1,5}(?:\.\d+)?-\d{1,5}(?:\.\d+)?(?:V|VAC|VDC|AC|DC|HZ|A|MA|KW|W)$/i.test(v) ||
    /^\d{1,4}X\d{1,5}(?:V|VAC|VDC|A|MA|KW|W)$/i.test(v)
  );
}

function containsDescriptionWords(value: string): boolean {
  const v = normalizePartNumber(value);

  return DESCRIPTION_WORDS.some((word) =>
    new RegExp(`\\b${word}\\b`, 'i').test(v)
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

  if (
    /^(?:CM|EM|CPU|CP|FM|SM|PS|IM|PM|PLC|HMI|VFD|AI|AO|DI|DO|IO)-?\d{1,4}$/i.test(
      v
    )
  ) {
    return true;
  }

  if (/^WITH[-\s]/i.test(v)) return true;

  if (containsDescriptionWords(v) && v.split(/\s+/).length >= 2) {
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

  v = v
    .replace(
      /^(?:MFR\.?\s*)?(?:PART\s*(?:NO|NUMBER)|P\/N|PN|MPN|MODEL\s*(?:NO|NUMBER)?|TYPE)\s*[:#-]?\s*/i,
      ''
    )
    .trim();

  return normalizePartNumber(v);
}

function appearsInTitle(candidate: string, title: string): boolean {
  const candidateCanonical = canonicalCompare(candidate);
  const titleCanonical = canonicalCompare(title);

  if (!candidateCanonical) return false;

  return titleCanonical.includes(candidateCanonical);
}

function isKnownIndustrialPattern(value: string): boolean {
  const v = normalizePartNumber(value);

  const patterns = [
    /^6ES\d\s*\d{3}-\d[A-Z]{2}\d{2}(?:-\d[A-Z]{2}\d)?$/i,
    /^6ES\d\d{3}-\d[A-Z]{2}\d{2}(?:-\d[A-Z]{2}\d)?$/i,
    /^6AV\d\s*\d{3,4}-[A-Z0-9-]{4,20}$/i,
    /^6DP\d\s*\d{3,4}-[A-Z0-9-]{4,20}$/i,
    /^6GK\d\s*\d{3,4}-[A-Z0-9-]{4,20}$/i,
    /^6EP\d\s*\d{3,4}-[A-Z0-9-]{4,20}$/i,
    /^7[A-Z]{1,3}\s?\d{3,5}(?:-\d+)?(?:\/[A-Z0-9-]+)?$/i,
    /^IC\d{3}[A-Z]{2,}\d{2,8}$/i,
    /^A\d{2}B-\d{4}-[A-Z0-9]{3,15}(?:\/[A-Z0-9]+)?$/i,
    /^\d{3,4}-[A-Z]{1,5}\d{1,6}[A-Z0-9-]*$/i,
    /^[A-Z][A-Z0-9]{3,20}-[A-Z0-9]{1,15}\/[A-Z0-9]{1,15}$/i,
    /^[A-Z0-9]{2,15}(?:-[A-Z0-9]{2,15}){2,5}$/i,
    /^[A-Z]{1,6}\d{3,10}[A-Z]{0,4}$/i,
    /^\d{4,12}[A-Z]{1,4}$/i,
  ];

  return patterns.some((pattern) => pattern.test(v));
}

function isValidMixedCompactCode(
  value: string,
  title: string,
  ebayItemId: string
): boolean {
  const v = normalizePartNumber(value);

  if (!v) return false;
  if (v.length < 6 || v.length > 18) return false;
  if (isEbayItemId(v, ebayItemId)) return false;
  if (isNoise(v)) return false;
  if (containsDescriptionWords(v)) return false;
  if (!appearsInTitle(v, title)) return false;

  // Example: 393151A. Must contain both letters and digits.
  if (!/[A-Z]/i.test(v) || !/\d/.test(v)) return false;

  return /^[A-Z0-9]+$/i.test(v);
}

function isValidAuthoritativeCandidate(
  value: string,
  source: Exclude<CandidateSource, 'title'>,
  title: string,
  ebayItemId: string
): boolean {
  const v = cleanAuthoritativeValue(value);

  if (!v) return false;
  if (v.length < 2 || v.length > 80) return false;
  if (isEbayItemId(v, ebayItemId)) return false;
  if (isNoise(v)) return false;
  if (v.split(/\s+/).length > 4) return false;
  if (!/[A-Z0-9]/i.test(v)) return false;
  if (/^WITH[-\s]/i.test(v)) return false;

  if (containsDescriptionWords(v) && !isKnownIndustrialPattern(v)) {
    return false;
  }

  if (/^\d{8,18}$/.test(v) && !appearsInTitle(v, title)) {
    return false;
  }

  if (
    !isKnownIndustrialPattern(v) &&
    v.length < 6 &&
    !appearsInTitle(v, title)
  ) {
    return false;
  }

  if (
    (source === 'mpn' || source === 'model_number') &&
    /\s/.test(v) &&
    !appearsInTitle(v, title) &&
    !isKnownIndustrialPattern(v)
  ) {
    return false;
  }

  return true;
}

function scoreAuthoritativeCandidate(
  value: string,
  source: Exclude<CandidateSource, 'title'>,
  title: string
): number {
  let score = 0;

  switch (source) {
    case 'mpn':
      score += 5000;
      break;
    case 'manufacturer_part_number':
      score += 4800;
      break;
    case 'part_number':
      score += 4600;
      break;
    case 'model_number':
      score += 4000;
      break;
  }

  if (appearsInTitle(value, title)) score += 2500;
  if (isKnownIndustrialPattern(value)) score += 3000;

  return score;
}

function titleCandidates(title: string, ebayItemId: string): Candidate[] {
  const candidates: Candidate[] = [];

  const addMatches = (pattern: RegExp, score: number) => {
    const matches = title.match(pattern) || [];

    for (const match of matches) {
      const value = normalizePartNumber(match);

      if (!value) continue;
      if (isEbayItemId(value, ebayItemId)) continue;
      if (isNoise(value)) continue;
      if (/^WITH[-\s]/i.test(value)) continue;

      candidates.push({
        source: 'title',
        value,
        score,
      });
    }
  };

  // Siemens S5 / S7.
  addMatches(
    /\b6ES\d\s*\d{3}-\d[A-Z]{2}\d{2}(?:-\d[A-Z]{2}\d)?\b/gi,
    12000
  );

  addMatches(
    /\b6ES\d\d{3}-\d[A-Z]{2}\d{2}(?:-\d[A-Z]{2}\d)?\b/gi,
    12000
  );

  // Siemens HMI / process / communications / power.
  addMatches(
    /\b6AV\d\s*\d{3,4}-[A-Z0-9-]{4,20}\b/gi,
    11500
  );

  addMatches(
    /\b6DP\d\s*\d{3,4}-[A-Z0-9-]{4,20}\b/gi,
    11500
  );

  addMatches(
    /\b6GK\d\s*\d{3,4}-[A-Z0-9-]{4,20}\b/gi,
    11500
  );

  addMatches(
    /\b6EP\d\s*\d{3,4}-[A-Z0-9-]{4,20}\b/gi,
    11500
  );

  // Other Siemens structured numbers.
  addMatches(
    /\b7[A-Z]{1,3}\s?\d{3,5}(?:-\d+)?(?:\/[A-Z0-9-]+)?\b/gi,
    10800
  );

  // GE Fanuc.
  addMatches(
    /\bIC\d{3}[A-Z]{2,}\d{2,8}\b/gi,
    11000
  );

  // Fanuc.
  addMatches(
    /\bA\d{2}B-\d{4}-[A-Z0-9]{3,15}(?:\/[A-Z0-9]+)?\b/gi,
    11000
  );

  // Allen-Bradley.
  addMatches(
    /\b\d{3,4}-[A-Z]{1,5}\d{1,6}[A-Z0-9-]*\b/gi,
    10500
  );

  // Strong slash code, e.g. P8AX09-T/MF.
  addMatches(
    /\b[A-Z][A-Z0-9]{3,20}-[A-Z0-9]{1,15}\/[A-Z0-9]{1,15}\b/gi,
    10000
  );

  // Digit-leading alphanumeric industrial code.
  // Example: 393151A
  addMatches(
    /\b\d{4,12}[A-Z]{1,4}\b/gi,
    9000
  );

  // Compact alphanumeric code inside title.
  addMatches(
    /\b[A-Z0-9]{6,18}\b/gi,
    5000
  );

  // Generic structured code: low-confidence fallback.
  addMatches(
    /\b[A-Z0-9]{2,15}(?:-[A-Z0-9]{2,15}){2,5}\b/gi,
    3000
  );

  return candidates
    .filter((candidate) => {
      if (
        /^[A-Z0-9]{6,18}$/i.test(candidate.value) &&
        !isKnownIndustrialPattern(candidate.value)
      ) {
        return isValidMixedCompactCode(
          candidate.value,
          title,
          ebayItemId
        );
      }

      if (containsDescriptionWords(candidate.value)) {
        return isKnownIndustrialPattern(candidate.value);
      }

      return isKnownIndustrialPattern(candidate.value);
    })
    .sort((a, b) => b.score - a.score);
}

function getBestPartNumber(
  item: any,
  title: string,
  ebayItemId: string
): Candidate | null {
  // Absolute high-confidence title rules.
  // These run BEFORE eBay MPN/model fields because old eBay listings can
  // contain descriptive or dirty Item Specific values.
  const strictTitleRules: Array<{
    pattern: RegExp;
    score: number;
  }> = [
    {
      pattern:
        /\b6ES\d\s*\d{3}-\d[A-Z]{2}\d{2}(?:-\d[A-Z]{2}\d)?\b/i,
      score: 20000,
    },
    {
      pattern:
        /\b6ES\d\d{3}-\d[A-Z]{2}\d{2}(?:-\d[A-Z]{2}\d)?\b/i,
      score: 20000,
    },
    {
      pattern: /\b6AV\d\s*\d{3,4}-[A-Z0-9-]{4,20}\b/i,
      score: 19500,
    },
    {
      pattern: /\b6DP\d\s*\d{3,4}-[A-Z0-9-]{4,20}\b/i,
      score: 19500,
    },
    {
      pattern: /\b6GK\d\s*\d{3,4}-[A-Z0-9-]{4,20}\b/i,
      score: 19500,
    },
    {
      pattern: /\b6EP\d\s*\d{3,4}-[A-Z0-9-]{4,20}\b/i,
      score: 19500,
    },
    {
      pattern: /\bIC\d{3}[A-Z]{2,}\d{2,8}\b/i,
      score: 19000,
    },
    {
      pattern:
        /\bA\d{2}B-\d{4}-[A-Z0-9]{3,15}(?:\/[A-Z0-9]+)?\b/i,
      score: 19000,
    },
    {
      pattern:
        /\b[A-Z][A-Z0-9]{3,20}-[A-Z0-9]{1,15}\/[A-Z0-9]{1,15}\b/i,
      score: 18500,
    },
  ];

  for (const rule of strictTitleRules) {
    const match = title.match(rule.pattern)?.[0];

    if (match) {
      const value = normalizePartNumber(match);

      if (
        value &&
        !isEbayItemId(value, ebayItemId) &&
        !isNoise(value) &&
        !containsDescriptionWords(value)
      ) {
        return {
          source: 'title',
          value,
          score: rule.score,
        };
      }
    }
  }

  // Strict digit-leading alphanumeric code from the title.
  // Example: KONGSBERG 393151A POWER SUPPLY -> 393151A
  // It must contain both digits and letters, be visible verbatim in the title,
  // and must not be a rating, quantity, eBay item ID, or description.
  const digitLeadingMatches =
    title.match(/\b\d{4,12}[A-Z]{1,4}\b/gi) || [];

  for (const rawMatch of digitLeadingMatches) {
    const value = normalizePartNumber(rawMatch);

    if (
      value &&
      /[A-Z]/i.test(value) &&
      /\d/.test(value) &&
      appearsInTitle(value, title) &&
      !isEbayItemId(value, ebayItemId) &&
      !isNoise(value) &&
      !containsDescriptionWords(value)
    ) {
      return {
        source: 'title',
        value,
        score: 18000,
      };
    }
  }

  const titleList = titleCandidates(title, ebayItemId);

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
    .map(({ source, value }) => {
      const cleaned = cleanAuthoritativeValue(value);

      return {
        source,
        value: cleaned,
        score: scoreAuthoritativeCandidate(cleaned, source, title),
      };
    })
    .filter((candidate) =>
      isValidAuthoritativeCandidate(
        candidate.value,
        candidate.source,
        title,
        ebayItemId
      )
    );

  const allCandidates = [
    ...titleList,
    ...authoritativeCandidates,
  ].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const aInTitle = appearsInTitle(a.value, title) ? 1 : 0;
    const bInTitle = appearsInTitle(b.value, title) ? 1 : 0;

    if (bInTitle !== aInTitle) return bInTitle - aInTitle;

    return b.value.length - a.value.length;
  });

  return allCandidates[0] || null;
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

export async function runFixPartNumbers(params: {
  offset?: number;
  ebayItemId?: string;
}) {
  try {
    const url = new URL(req.url);

    const requestedItemId = String(
  params.ebayItemId || ''
).trim();

const offset = Math.max(
  0,
  Number(params.offset || 0)
);

    let query = supabaseAdmin
      .from('products')
      .select(
        'id, ebay_item_id, part_number, model_number, name, marketplace'
      )
      .eq('marketplace', MARKETPLACE)
      .not('ebay_item_id', 'is', null)
      .order('id', { ascending: true });

    if (requestedItemId) {
      query = query.eq('ebay_item_id', requestedItemId).limit(1);
    } else {
      query = query.range(offset, offset + SCAN_LIMIT - 1);
    }

    const { data: rows, error: productsError } = await query;

    if (productsError) throw productsError;

    const suspiciousProducts = requestedItemId
      ? rows || []
      : (rows || [])
          .filter((product) =>
            isWeakExistingPartNumber(
              product.part_number,
              product.ebay_item_id
            )
          )
          .slice(0, PROCESS_LIMIT);

    if (suspiciousProducts.length === 0) {
      return {
        success: true,
        routeVersion: ROUTE_VERSION,
        mode: requestedItemId
          ? 'single-item-verified'
          : 'strict-cross-check-v2',
        offset,
        ebay_item_id: requestedItemId || null,
        scanned: rows?.length ?? 0,
        suspiciousFound: 0,
        processed: 0,
        updated: 0,
        unchanged: 0,
        unresolved: 0,
        failed: 0,
        rateLimited: false,
        message: requestedItemId
          ? 'Product not found.'
          : 'No suspicious part numbers in this scan window.',
        nextOffset:
          !requestedItemId &&
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

        // Absolute direct rule for titles shaped like:
        // BRAND 393151A POWER SUPPLY
        // Example: KONGSBERG 393151A POWER SUPPLY
        const brandPrefixCodeMatch = title.match(
          /^[A-Z][A-Z0-9&.'-]{2,30}\s+(\d{4,12}[A-Z]{1,4})\b/i
        );

        let best: Candidate | null = null;

        if (brandPrefixCodeMatch?.[1]) {
          const directValue = normalizePartNumber(
            brandPrefixCodeMatch[1]
          );

          if (
            directValue &&
            appearsInTitle(directValue, title) &&
            !isEbayItemId(directValue, ebayItemId) &&
            !isNoise(directValue) &&
            !containsDescriptionWords(directValue)
          ) {
            best = {
              source: 'title',
              value: directValue,
              score: 30000,
            };
          }
        }

        if (!best) {
          best = getBestPartNumber(
            item,
            title,
            ebayItemId
          );
        }

        if (!best) {
          unresolved++;

          results.push({
            id: product.id,
            ebay_item_id: ebayItemId,
            old_part_number: product.part_number,
            status: 'unresolved_no_verified_part_number',
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
            score: best.score,
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
          score: best.score,
          status: 'updated_verified',
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
      routeVersion: ROUTE_VERSION,
      mode: requestedItemId
        ? 'single-item-verified'
        : 'strict-cross-check-v2',
      offset,
      ebay_item_id: requestedItemId || null,
      scanned: rows?.length ?? 0,
      suspiciousFound: suspiciousProducts.length,
      processed: results.length,
      updated,
      unchanged,
      unresolved,
      failed,
      rateLimited,
      nextOffset:
        !requestedItemId &&
        (rows?.length ?? 0) === SCAN_LIMIT
          ? offset + SCAN_LIMIT
          : null,
      results,
    };
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
