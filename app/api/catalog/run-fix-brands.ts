import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { detectIndustrialBrand } from '@/lib/industrial-brand';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MARKETPLACE = 'EBAY_US';
const SELLER = 'orbitcontrol';
const PROCESS_LIMIT = 25;
const SCAN_LIMIT = 500;
const ROUTE_VERSION = 'BRAND-V6-KNOWN-EBAY-SAFE';

const BAD_BRANDS = new Set([
  '',
  'UNKNOWN',
  'N/A',
  'NA',
  'NONE',
  'NOT APPLICABLE',
  'NOT-APPLICABLE',
  'DOES NOT APPLY',
  'DOES-NOT-APPLY',
  'UNBRANDED',
  'GENERIC',
  'OTHER',
]);

const DESCRIPTION_WORDS = new Set([
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
  'POWER',
  'SUPPLY',
  'SENSOR',
  'MOTOR',
  'PANEL',
  'DISPLAY',
  'SYSTEM',
  'UNIT',
  'CIRCUIT',
  'BREAKER',
  'CONTACTOR',
  'INVERTER',
  'CONVERTER',
  'AMPLIFIER',
  'TRANSFORMER',
  'AUTOMATION',
  'INDUSTRIAL',
]);

function normalizeBrand(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'`([{<]+|[\s"'`\])}>.,;:]+$/g, '')
    .trim();
}

function brandKey(value: unknown): string {
  return normalizeBrand(value).toUpperCase();
}

function isBadBrand(value: unknown): boolean {
  const key = brandKey(value);

  if (BAD_BRANDS.has(key)) return true;
  if (!key) return true;
  if (/^\d+$/.test(key)) return true;
  if (key.length < 2 || key.length > 80) return true;

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

    const value = normalizeBrand(found?.value);

    if (value) return value;
  }

  return '';
}

function isDescriptiveBrand(value: string): boolean {
  const words = brandKey(value)
    .split(/[\s/&,+-]+/)
    .filter(Boolean);

  if (words.length === 0) return true;

  const descriptiveCount = words.filter((word) =>
    DESCRIPTION_WORDS.has(word)
  ).length;

  return descriptiveCount === words.length;
}

function isValidAuthoritativeBrand(value: unknown): boolean {
  const brand = normalizeBrand(value);

  if (isBadBrand(brand)) return false;
  if (isDescriptiveBrand(brand)) return false;

  // eBay Brand / Manufacturer should be a name, not a full sentence.
  if (brand.split(/\s+/).length > 6) return false;

  return /[A-Z]/i.test(brand);
}

function cleanRawBrandText(value: unknown): string {
  let brand = normalizeBrand(value);

  if (!brand) return '';

  brand = brand
    .replace(/\bPOWERED\s+BY\b.*$/i, '')
    .replace(/\bA\s+BRAND\s+OF\b.*$/i, '')
    .replace(/\bDIVISION\s+OF\b.*$/i, '')
    .replace(/\bPART\s+OF\b.*$/i, '')
    .replace(/\bMEMBER\s+OF\b.*$/i, '')
    .replace(/\bCOMPANY\s+OF\b.*$/i, '')
    .replace(
      /\b(?:INCORPORATED|INC\.?|CORPORATION|CORP\.?|LIMITED|LTD\.?|LLC|L\.L\.C\.|GMBH|AG|S\.A\.|SA|S\.R\.L\.|SRL|CO\.?|COMPANY)\b\.?/gi,
      ''
    )
    .replace(/[|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,./&-]+|[\s,./&-]+$/g, '')
    .trim();

  return normalizeBrand(brand);
}

function normalizeKnownBrand(value: string): string {
  const cleaned = cleanRawBrandText(value);
  const key = brandKey(cleaned);

  // Canonical contains rules first.
  // These intentionally run before exact aliases because old eBay Brand
  // values may contain marketing suffixes or legacy company wording.
  if (key.includes('TRIDIUM')) return 'Tridium';

  if (
    key.includes('HMS INDUSTRIAL NETWORKS') ||
    key.includes('HMS NETWORKS')
  ) {
    return 'HMS Networks';
  }

  if (
    key.includes('INFINITY ANDOVER') ||
    key.includes('ANDOVER CONTROLS')
  ) {
    return 'Andover Controls';
  }

  if (
    key.includes('ALLEN BRADLEY') ||
    key.includes('ALLEN-BRADLEY')
  ) {
    return 'Allen-Bradley';
  }

  if (key.includes('SCHNEIDER')) {
    return 'Schneider Electric';
  }

  if (key.includes('GE FANUC')) {
    return 'GE Fanuc';
  }

  if (
    key.includes('CUTLER HAMMER') ||
    key.includes('CUTLER-HAMMER')
  ) {
    return 'Cutler-Hammer';
  }

  if (
    key.includes('PHOENIX CONTACT') ||
    key === 'PHOENIX'
  ) {
    return 'Phoenix Contact';
  }

  if (
    key.includes('MITSUBISHI ELECTRIC') ||
    key === 'MITSUBISHI'
  ) {
    return 'Mitsubishi Electric';
  }

  if (
    key.includes('CARLO GAVAZZI') ||
    key === 'GAVAZZI'
  ) {
    return 'Carlo Gavazzi';
  }

  if (
    key.includes('MORS SMITT') ||
    key === 'SMITT'
  ) {
    return 'Mors Smitt';
  }

  if (
    key.includes('GENERAL ELECTRIC') ||
    key === 'GE'
  ) {
    return 'GE';
  }

  if (key.includes('TELEMECANIQUE')) {
    return 'Telemecanique';
  }

  const aliases: Record<string, string> = {
    'SIEMENS': 'Siemens',
    'ABB': 'ABB',
    'OMRON': 'Omron',
    'YOKOGAWA': 'Yokogawa',
    'HONEYWELL': 'Honeywell',
    'EMERSON': 'Emerson',

    'EATON': 'Eaton',
    'FANUC': 'Fanuc',
    'BELIMO': 'Belimo',
    'KONGSBERG': 'Kongsberg',
    'FLENDER': 'Flender',
    'BOSCH': 'Bosch',
    'CEAG': 'CEAG',

    'BAUMULLER': 'Baumuller',
    'BAUMÜLLER': 'Baumuller',
    'SCHMALZ': 'Schmalz',
    'FRANKE': 'Franke',
    'MOOG': 'Moog',
    'STULZ': 'Stulz',
    'CESCON': 'Cescon',
    'STATRON': 'Statron',
    'SEIRA': 'Seira',
    'ROPEX': 'ROPEX',

    'SICK': 'SICK',
    'JUKI': 'JUKI',
    'GRACO': 'Graco',
    'SUN MICROSYSTEMS': 'Sun Microsystems',
    'WINCOR NIXDORF': 'Wincor Nixdorf',
    'CEDES': 'Cedes',
    'NOVINTEC': 'Novintec',
    'BAELZ': 'Baelz',
    'IBC CONTROL': 'IBC Control',
    'KAISER': 'Kaiser',
  };

  return aliases[key] || cleaned;
}

function isCanonicalBrandSafe(value: unknown): boolean {
  const brand = normalizeKnownBrand(String(value || ''));

  if (isBadBrand(brand)) return false;
  if (isDescriptiveBrand(brand)) return false;
  if (brand.split(/\s+/).length > 5) return false;

  if (
    /\b(?:POWERED BY|A BRAND OF|DIVISION OF|PART OF|MEMBER OF)\b/i.test(
      String(value || '')
    )
  ) {
    return false;
  }

  return /[A-Z]/i.test(brand);
}

function getTitlePrefixBrand(title: string): string {
  const text = normalizeBrand(title);

  if (!text) return '';

  // Existing industrial-brand detector is our safe title fallback.
  const detected = normalizeBrand(detectIndustrialBrand(text));

  if (!isBadBrand(detected) && !isDescriptiveBrand(detected)) {
    return normalizeKnownBrand(detected);
  }

  return '';
}


function canonicalBrandKey(value: unknown): string {
  return brandKey(normalizeKnownBrand(String(value || '')));
}

function brandAppearsInTitle(brand: string, title: string): boolean {
  const brandCanonical = canonicalBrandKey(brand);
  const titleCanonical = String(title || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (!brandCanonical || brandCanonical.length < 3) {
    return false;
  }

  const compactBrand = brandCanonical.replace(/[^A-Z0-9]/g, '');

  return (
    compactBrand.length >= 3 &&
    titleCanonical.includes(compactBrand)
  );
}

function isCanonicalKnownBrand(value: string): boolean {
  const key = canonicalBrandKey(value);

  const known = new Set([
    'SIEMENS',
    'ABB',
    'ALLEN-BRADLEY',
    'SCHNEIDER ELECTRIC',
    'TELEMECANIQUE',
    'OMRON',
    'YOKOGAWA',
    'HONEYWELL',
    'EMERSON',
    'PHOENIX CONTACT',
    'MITSUBISHI ELECTRIC',
    'EATON',
    'CUTLER-HAMMER',
    'GE',
    'GE FANUC',
    'FANUC',
    'BELIMO',
    'KONGSBERG',
    'FLENDER',
    'BOSCH',
    'CEAG',
    'CARLO GAVAZZI',
    'MORS SMITT',
    'TRIDIUM',
    'HMS NETWORKS',
    'ANDOVER CONTROLS',
    'SICK',
    'MOOG',
    'STULZ',
    'ROPEX',
    'SCHMALZ',
    'GRACO',
    'BAUMULLER',
    'SUN MICROSYSTEMS',
    'WINCOR NIXDORF',
    'CEDES',
    'NOVINTEC',
    'BAELZ',
    'IBC CONTROL',
    'KAISER',
  ]);

  return known.has(key);
}

function detectBrandFromPartNumber(
  partNumber: string
): string {
  const pn = String(partNumber || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (!pn) return '';

  const rules: Array<{
    pattern: RegExp;
    brand: string;
  }> = [
    {
      pattern: /^6(?:ES|AV|EP|GK|DP)\d/i,
      brand: 'Siemens',
    },
    {
      pattern: /^IC\d{3}[A-Z]{2,}\d+/i,
      brand: 'GE Fanuc',
    },
    {
      pattern: /^A\d{2}B-\d{4}-/i,
      brand: 'Fanuc',
    },
    {
      pattern: /^\d{3,4}-[A-Z]{1,5}\d+/i,
      brand: 'Allen-Bradley',
    },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(pn)) {
      return rule.brand;
    }
  }

  return '';
}

function collectBrandEvidence(item: any, title: string) {
  const ebayBrandRaw = getAspectValue(item, ['Brand']);
  const manufacturerRaw = getAspectValue(item, [
    'Manufacturer',
    'Manufacturer Name',
    'Make',
  ]);

  const mpn = getAspectValue(item, ['MPN']);
  const manufacturerPartNumber = getAspectValue(item, [
    'Manufacturer Part Number',
  ]);
  const partNumber = getAspectValue(item, ['Part Number']);
  const modelNumber = getAspectValue(item, ['Model Number']);

  const ebayBrand = normalizeKnownBrand(ebayBrandRaw);
  const manufacturer = normalizeKnownBrand(manufacturerRaw);
  const detected = normalizeKnownBrand(
    getTitlePrefixBrand(title)
  );

  const partNumberBrand = normalizeKnownBrand(
    detectBrandFromPartNumber(
      mpn ||
      manufacturerPartNumber ||
      partNumber ||
      modelNumber
    )
  );

  return {
    ebayBrandRaw,
    manufacturerRaw,
    mpn,
    manufacturerPartNumber,
    partNumber,
    modelNumber,
    ebayBrand,
    manufacturer,
    detected,
    partNumberBrand,
  };
}

function chooseBrand(item: any, title: string): {
  brand: string;
  source:
    | 'brand+manufacturer'
    | 'manufacturer+part-number'
    | 'brand+part-number'
    | 'detector+part-number'
    | 'known-detector'
    | 'known-manufacturer'
    | 'known-ebay-brand'
    | null;
  evidence?: Record<string, unknown>;
} {
  const evidence = collectBrandEvidence(item, title);

  const {
    ebayBrand,
    manufacturer,
    detected,
    partNumberBrand,
  } = evidence;

  const brandValid =
    ebayBrand &&
    !isBadBrand(ebayBrand) &&
    isCanonicalBrandSafe(ebayBrand);

  const manufacturerValid =
    manufacturer &&
    !isBadBrand(manufacturer) &&
    isCanonicalBrandSafe(manufacturer);

  const detectedValid =
    detected &&
    !isBadBrand(detected) &&
    isCanonicalBrandSafe(detected);

  const partNumberBrandValid =
    partNumberBrand &&
    !isBadBrand(partNumberBrand) &&
    isCanonicalBrandSafe(partNumberBrand);

  const brandKeyValue = canonicalBrandKey(ebayBrand);
  const manufacturerKey = canonicalBrandKey(manufacturer);
  const detectedKey = canonicalBrandKey(detected);
  const partNumberBrandKey =
    canonicalBrandKey(partNumberBrand);

  // Strongest: eBay Brand and Manufacturer agree.
  if (
    brandValid &&
    manufacturerValid &&
    brandKeyValue === manufacturerKey
  ) {
    return {
      brand: ebayBrand,
      source: 'brand+manufacturer',
      evidence,
    };
  }

  // Manufacturer agrees with a brand family derived from the part number.
  if (
    manufacturerValid &&
    partNumberBrandValid &&
    manufacturerKey === partNumberBrandKey
  ) {
    return {
      brand: manufacturer,
      source: 'manufacturer+part-number',
      evidence,
    };
  }

  // eBay Brand agrees with a brand family derived from the part number.
  if (
    brandValid &&
    partNumberBrandValid &&
    brandKeyValue === partNumberBrandKey
  ) {
    return {
      brand: ebayBrand,
      source: 'brand+part-number',
      evidence,
    };
  }

  // Our known industrial detector agrees with part-number family.
  if (
    detectedValid &&
    partNumberBrandValid &&
    detectedKey === partNumberBrandKey
  ) {
    return {
      brand: detected,
      source: 'detector+part-number',
      evidence,
    };
  }

  // A normalized eBay Brand is safe only when it exists in our
  // explicit industrial brand dictionary.
  if (
    brandValid &&
    isCanonicalKnownBrand(ebayBrand)
  ) {
    return {
      brand: ebayBrand,
      source: 'known-ebay-brand',
      evidence,
    };
  }

  // Known manufacturer is accepted.
  if (
    manufacturerValid &&
    isCanonicalKnownBrand(manufacturer)
  ) {
    return {
      brand: manufacturer,
      source: 'known-manufacturer',
      evidence,
    };
  }

  // Known industrial detector result is accepted.
  if (
    detectedValid &&
    isCanonicalKnownBrand(detected)
  ) {
    return {
      brand: detected,
      source: 'known-detector',
      evidence,
    };
  }

  return {
    brand: '',
    source: null,
    evidence,
  };
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

export async function runFixBrands(params: {
  offset?: number;
  ebayItemId?: string;
}) {
  try {
    const requestedItemId = String(
  params.ebayItemId || ''
).trim();

const offset = Math.max(
  0,
  Number(params.offset || 0)
);

    let query = supabaseAdmin
      .from('products')
      .select('id, ebay_item_id, brand, name, marketplace')
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
          .filter((product) => {
            const current = normalizeBrand(product.brand);
            const canonical = normalizeKnownBrand(current);

            return (
              isBadBrand(current) ||
              !isCanonicalBrandSafe(current) ||
              brandKey(current) !== brandKey(canonical)
            );
          })
          .slice(0, PROCESS_LIMIT);

    if (suspiciousProducts.length === 0) {
      return NextResponse.json({
        success: true,
        routeVersion: ROUTE_VERSION,
        mode: requestedItemId
          ? 'single-item-brand'
          : 'strict-brand-cleaner',
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
          : 'No UNKNOWN or invalid brands in this scan window.',
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
            old_brand: product.brand,
            status: 'unresolved_no_ebay_item',
          });

          continue;
        }

        const title = String(
          item.title || product.name || ''
        ).trim();

        const chosen = chooseBrand(item, title);

        if (!chosen.brand || !chosen.source) {
          unresolved++;

          results.push({
            id: product.id,
            ebay_item_id: ebayItemId,
            old_brand: product.brand,
            title,
            evidence: chosen.evidence,
            status: 'unresolved_no_verified_brand',
          });

          continue;
        }

        if (
          brandKey(product.brand) === brandKey(chosen.brand) &&
          normalizeBrand(product.brand) === chosen.brand
        ) {
          unchanged++;

          results.push({
            id: product.id,
            ebay_item_id: ebayItemId,
            old_brand: product.brand,
            candidate: chosen.brand,
            source: chosen.source,
            status: 'unchanged_same_brand',
          });

          continue;
        }

        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update({
            brand: chosen.brand,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateError) throw updateError;

        updated++;

        results.push({
          id: product.id,
          ebay_item_id: ebayItemId,
          old_brand: product.brand,
          new_brand: chosen.brand,
          source: chosen.source,
          evidence: chosen.evidence,
          status: 'updated_verified_brand',
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
          old_brand: product.brand,
          status: 'failed',
          error: message,
        });
      }
    }

    return {
    success: true,
    routeVersion: ROUTE_VERSION,
    mode: requestedItemId
      ? 'single-item-brand'
      : 'strict-brand-cleaner',
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
  console.error('FIX BRANDS ERROR:', error);
  throw error;
}
}
