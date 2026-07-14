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
const ROUTE_VERSION = 'BRAND-V1-STRICT';

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

function normalizeKnownBrand(value: string): string {
  const key = brandKey(value);

  const aliases: Record<string, string> = {
    'ALLEN BRADLEY': 'Allen-Bradley',
    'ALLEN-BRADLEY': 'Allen-Bradley',
    'SCHNEIDER ELECTRIC': 'Schneider Electric',
    SCHNEIDER: 'Schneider Electric',
    SIEMENS: 'Siemens',
    ABB: 'ABB',
    OMRON: 'Omron',
    YOKOGAWA: 'Yokogawa',
    HONEYWELL: 'Honeywell',
    EMERSON: 'Emerson',
    'PHOENIX CONTACT': 'Phoenix Contact',
    PHOENIX: 'Phoenix Contact',
    MITSUBISHI: 'Mitsubishi',
    'MITSUBISHI ELECTRIC': 'Mitsubishi Electric',
    EATON: 'Eaton',
    'CUTLER HAMMER': 'Cutler-Hammer',
    'CUTLER-HAMMER': 'Cutler-Hammer',
    'GENERAL ELECTRIC': 'GE',
    'GE FANUC': 'GE Fanuc',
    FANUC: 'Fanuc',
    BELIMO: 'Belimo',
    KONGSBERG: 'Kongsberg',
    FLENDER: 'Flender',
    BOSCH: 'Bosch',
    CEAG: 'CEAG',
    'CARLO GAVAZZI': 'Carlo Gavazzi',
    GAVAZZI: 'Carlo Gavazzi',
    'MORS SMITT': 'Mors Smitt',
    SMITT: 'Mors Smitt',
  };

  return aliases[key] || normalizeBrand(value);
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

function chooseBrand(item: any, title: string): {
  brand: string;
  source: 'brand' | 'manufacturer' | 'detector' | null;
} {
  const ebayBrand = getAspectValue(item, ['Brand']);

  if (isValidAuthoritativeBrand(ebayBrand)) {
    return {
      brand: normalizeKnownBrand(ebayBrand),
      source: 'brand',
    };
  }

  const manufacturer = getAspectValue(item, [
    'Manufacturer',
    'Manufacturer Name',
    'Make',
  ]);

  if (isValidAuthoritativeBrand(manufacturer)) {
    return {
      brand: normalizeKnownBrand(manufacturer),
      source: 'manufacturer',
    };
  }

  const detected = getTitlePrefixBrand(title);

  if (detected) {
    return {
      brand: detected,
      source: 'detector',
    };
  }

  return {
    brand: '',
    source: null,
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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const requestedItemId = String(
      url.searchParams.get('ebay_item_id') || ''
    ).trim();

    const offset = Math.max(
      0,
      Number(url.searchParams.get('offset') || 0)
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
          .filter((product) => isBadBrand(product.brand))
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
            status: 'unresolved_no_verified_brand',
          });

          continue;
        }

        if (brandKey(product.brand) === brandKey(chosen.brand)) {
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

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('FIX BRANDS ERROR:', error);

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
