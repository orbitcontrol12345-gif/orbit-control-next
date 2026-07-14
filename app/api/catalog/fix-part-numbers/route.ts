import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { extractPartNumber } from '@/lib/part-number';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MARKETPLACE = 'EBAY_US';
const SELLER = 'orbitcontrol';
const PROCESS_LIMIT = 25;
const SCAN_LIMIT = 500;

const WEAK_PREFIXES = [
  'EM', 'CM', 'CPU', 'CP', 'FM', 'SM', 'PS', 'IM', 'PM',
  'PLC', 'HMI', 'VFD', 'AI', 'AO', 'DI', 'DO', 'IO',
];

const GENERIC_VALUES = new Set([
  'UNKNOWN', 'SIMATIC', 'SIMATIC-S7', 'SIMATIC-S5', 'S7', 'S5',
  'SIRIUS', 'SINAMICS', 'SITOP', 'MICROMASTER', 'PLC', 'HMI',
  'VFD', 'DRIVE', 'MODULE', 'CONTROLLER', 'RELAY', 'SWITCH',
  'BOARD', 'CARD', 'POWER-SUPPLY', 'POWER SUPPLY', 'UNIT',
  'SYSTEM', 'TYPE', 'MODEL',
]);

function normalizePartNumber(value: unknown): string {
  return String(value || '')
    .toUpperCase()
    .trim()
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9./-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[./-]+|[./-]+$/g, '');
}

function isElectricalRating(value: string): boolean {
  const v = normalizePartNumber(value);

  return (
    /^\d+(?:\.\d+)?(?:V|VAC|VDC|AC|DC|HZ|A|MA|AMP|AMPS|KW|W)$/i.test(v) ||
    /^\d+(?:\.\d+)?-\d+(?:\.\d+)?(?:V|VAC|VDC|AC|DC|HZ|A|MA)$/i.test(v) ||
    /^\d+X\d+(?:V|VAC|VDC|A|MA)$/i.test(v)
  );
}

function isWeakFamilyModel(value: string): boolean {
  const v = normalizePartNumber(value);
  const prefixPattern = WEAK_PREFIXES.join('|');

  return new RegExp(`^(?:${prefixPattern})-?\\d{1,4}$`, 'i').test(v);
}

function isSuspiciousPartNumber(value: unknown, ebayItemId: unknown): boolean {
  const v = normalizePartNumber(value);
  const itemId = String(ebayItemId || '').trim().toUpperCase();

  if (!v) return true;
  if (v === itemId) return true;
  if (GENERIC_VALUES.has(v)) return true;
  if (isWeakFamilyModel(v)) return true;
  if (isElectricalRating(v)) return true;
  if (/\b(?:LOT|QTY|PCS?|PIECES?|PACKS?|SETS?)\b/i.test(v)) return true;
  if (/^(?:P\/?N|PN|REV|VER|VERSION|TYPE|MODEL)-?[A-Z0-9]*$/i.test(v)) return true;

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

function splitRawCandidates(value: unknown): string[] {
  const raw = String(value || '').trim();
  if (!raw) return [];

  return [
    raw,
    ...raw
      .split(/\s*[|;,]\s*|\s{2,}/)
      .map((part) => part.trim())
      .filter(Boolean),
  ];
}

function isBadCandidate(value: string, ebayItemId: string): boolean {
  const v = normalizePartNumber(value);

  if (!v || v.length < 3 || v.length > 60) return true;
  if (v === ebayItemId.toUpperCase()) return true;
  if (GENERIC_VALUES.has(v)) return true;
  if (isWeakFamilyModel(v)) return true;
  if (isElectricalRating(v)) return true;
  if (/\b(?:LOT|QTY|PCS?|PIECES?|PACKS?|SETS?)\b/i.test(v)) return true;

  return false;
}

type CandidateSource =
  | 'mpn'
  | 'manufacturerPartNumber'
  | 'partNumber'
  | 'model'
  | 'title';

function scoreCandidate(value: string, source: CandidateSource): number {
  const v = normalizePartNumber(value);
  let score = 0;

  if (source === 'mpn') score += 1000;
  if (source === 'manufacturerPartNumber') score += 950;
  if (source === 'partNumber') score += 900;
  if (source === 'model') score += 700;
  if (source === 'title') score += 100;

  if (/^6ES\d/i.test(v)) score += 700;
  if (/^6AV\d/i.test(v)) score += 690;
  if (/^6DP\d/i.test(v)) score += 680;
  if (/^6GK\d/i.test(v)) score += 670;
  if (/^6EP\d/i.test(v)) score += 670;
  if (/^IC\d{3}[A-Z]{2,}\d+/i.test(v)) score += 650;
  if (/^A\d{2}B-\d{4}-[A-Z0-9]+$/i.test(v)) score += 640;
  if (/^\d{3}-\d[A-Z]{2}\d{2}-\d[A-Z]{2}\d$/i.test(v)) score += 620;

  const groups = v.split('-').filter(Boolean).length;
  if (groups >= 3) score += 180;
  if (groups >= 4) score += 60;
  if (/[A-Z]/.test(v)) score += 50;
  if (/\d/.test(v)) score += 50;
  if (/[-/.]/.test(v)) score += 40;
  if (v.length >= 6 && v.length <= 35) score += 40;

  if (/^\d{5,18}$/.test(v)) {
    if (
      source === 'mpn' ||
      source === 'manufacturerPartNumber' ||
      source === 'partNumber'
    ) {
      score += 350;
    } else {
      score -= 250;
    }
  }

  return score;
}

function addCandidate(
  target: Array<{ value: string; source: CandidateSource }>,
  value: unknown,
  source: CandidateSource
): void {
  for (const raw of splitRawCandidates(value)) {
    target.push({ value: raw, source });

    const extracted = extractPartNumber(raw);
    if (extracted) target.push({ value: extracted, source });
  }
}

function extractBestPartNumber(item: any, title: string, ebayItemId: string): string {
  const candidates: Array<{ value: string; source: CandidateSource }> = [];

  addCandidate(candidates, getAspectValue(item, ['MPN']), 'mpn');
  addCandidate(
    candidates,
    getAspectValue(item, ['Manufacturer Part Number']),
    'manufacturerPartNumber'
  );
  addCandidate(candidates, getAspectValue(item, ['Part Number']), 'partNumber');
  addCandidate(candidates, getAspectValue(item, ['Model Number']), 'model');

  const titlePatterns = [
    /\b6ES\d[\s-]?[A-Z0-9-]+\b/gi,
    /\b6AV\d[A-Z0-9-]+\b/gi,
    /\b6DP\d[A-Z0-9-]+\b/gi,
    /\b6GK\d[A-Z0-9-]+\b/gi,
    /\b6EP\d[A-Z0-9-]+\b/gi,
    /\bIC\d{3}[A-Z]{2,}\d{2,6}\b/gi,
    /\bA\d{2}B-\d{4}-[A-Z0-9]{3,12}\b/gi,
    /\b\d{3}-\d[A-Z]{2}\d{2}-\d[A-Z]{2}\d\b/gi,
    /\b[A-Z0-9]{2,15}(?:[-/][A-Z0-9]{2,15}){2,6}\b/gi,
  ];

  for (const pattern of titlePatterns) {
    for (const match of title.match(pattern) || []) {
      addCandidate(candidates, match, 'title');
    }
  }

  const extractedFromTitle = extractPartNumber(title);
  if (extractedFromTitle) {
    addCandidate(candidates, extractedFromTitle, 'title');
  }

  const ranked = candidates
    .map((candidate) => ({
      value: normalizePartNumber(candidate.value),
      source: candidate.source,
    }))
    .filter((candidate) => !isBadCandidate(candidate.value, ebayItemId))
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate.value, candidate.source),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.value.length - a.value.length;
    });

  return ranked[0]?.value || '';
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
    `https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(browseItemId)}`,
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

  if (!detailResponse.ok) return summary;

  const detail = await detailResponse.json().catch(() => null);
  return detail || summary;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));

    const { data: rows, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, ebay_item_id, part_number, model_number, name, marketplace')
      .eq('marketplace', MARKETPLACE)
      .not('ebay_item_id', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + SCAN_LIMIT - 1);

    if (productsError) throw productsError;

    const suspiciousProducts = (rows || [])
      .filter((product) =>
        isSuspiciousPartNumber(product.part_number, product.ebay_item_id)
      )
      .slice(0, PROCESS_LIMIT);

    if (suspiciousProducts.length === 0) {
      return NextResponse.json({
        success: true,
        offset,
        scanned: rows?.length ?? 0,
        processed: 0,
        updated: 0,
        failed: 0,
        message: 'No suspicious part numbers in this scan window.',
        nextOffset:
          (rows?.length ?? 0) === SCAN_LIMIT ? offset + SCAN_LIMIT : null,
      });
    }

    const token = await getEbayToken();
    const accessToken = String(token.access_token || '').trim();

    if (!accessToken) throw new Error('Missing eBay access token');

    let updated = 0;
    let failed = 0;
    let rateLimited = false;
    const results: Array<Record<string, unknown>> = [];

    for (const product of suspiciousProducts) {
      const ebayItemId = String(product.ebay_item_id || '').trim();

      try {
        const item = await fetchEbayItem(ebayItemId, accessToken);

        if (!item) {
          failed++;
          results.push({
            id: product.id,
            ebay_item_id: ebayItemId,
            old_part_number: product.part_number,
            status: 'no_ebay_item',
          });
          continue;
        }

        const title = String(item.title || product.name || '').trim();
        const newPartNumber = extractBestPartNumber(item, title, ebayItemId);

        if (!newPartNumber) {
          failed++;
          results.push({
            id: product.id,
            ebay_item_id: ebayItemId,
            old_part_number: product.part_number,
            status: 'no_valid_part_number_found',
            title,
          });
          continue;
        }

        if (
          normalizePartNumber(product.part_number) ===
          normalizePartNumber(newPartNumber)
        ) {
          results.push({
            id: product.id,
            ebay_item_id: ebayItemId,
            old_part_number: product.part_number,
            new_part_number: newPartNumber,
            status: 'already_same',
          });
          continue;
        }

        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update({
            part_number: newPartNumber,
            model_number: newPartNumber,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateError) throw updateError;

        updated++;
        results.push({
          id: product.id,
          ebay_item_id: ebayItemId,
          old_part_number: product.part_number,
          new_part_number: newPartNumber,
          status: 'updated',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

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
      offset,
      scanned: rows?.length ?? 0,
      suspiciousFound: suspiciousProducts.length,
      processed: results.length,
      updated,
      failed,
      rateLimited,
      nextOffset:
        (rows?.length ?? 0) === SCAN_LIMIT ? offset + SCAN_LIMIT : null,
      results,
    });
  } catch (error) {
    console.error('FIX PART NUMBERS ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
