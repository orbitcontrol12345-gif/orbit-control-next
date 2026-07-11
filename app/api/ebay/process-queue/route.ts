import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { extractPartNumber } from '@/lib/part-number';
import { detectIndustrialBrand } from '@/lib/industrial-brand';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIMIT = 250;
const MARKETPLACE = 'EBAY_US';
const SELLER = 'orbitcontrol';

function slugify(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180);
}

function cleanTitle(title: string): string {
  return String(title || '')
    // Remove quantity/lot prefixes and suffixes without touching real part numbers.
    .replace(/^\s*LOT\s+(?:OF\s+)?\d+(?:\.\d+)?\s*(?:PCS?|PIECES?)?\s*/i, '')
    .replace(/^\s*\d+(?:\.\d+)?\s*(?:PCS?|PIECES?)\s*/i, '')
    .replace(/\bLOT\s*#?\s*(?:OF\s+)?\d+(?:\.\d+)?\b/gi, '')
    .replace(/\bQTY\s*[:#-]?\s*\d+(?:\.\d+)?\b/gi, '')
    .replace(/\b\d+(?:\.\d+)?\s*(?:PCS?|PIECES?)\b/gi, '')
    .replace(/\b(?:PCS?|PIECES?)\s*\d+(?:\.\d+)?\b/gi, '')

    // Condition and packaging noise.
    .replace(/\bNEW\s+OPEN\s+BOX\b/gi, '')
    .replace(/\bOPEN\s+BOX\b/gi, '')
    .replace(/\bNEW\s+OLD\s+STOCK\b/gi, '')
    .replace(/\bNEW\s+SEALED\b/gi, '')
    .replace(/\bREFURBISHED\b/gi, '')
    .replace(/\bNEW\b/gi, '')
    .replace(/\bUSED\b/gi, '')
    .replace(/\bW\/O\s+BOX\b/gi, '')
    .replace(/\bWITHOUT\s+BOX\b/gi, '')
    .replace(/\bNO\s+BOX\b/gi, '')
    .replace(/\bWITH\s+NO\s+ORIGINAL\s+BOX\b/gi, '')
    .replace(/\bNO\s+ORIGINAL\s+BOX\b/gi, '')
    .replace(/\bWITH\s+DAMAGED\s+BOX\b/gi, '')
    .replace(/\bDAMAGED\s+BOX\b/gi, '')
    .replace(/\bWITH\s+BROKEN\s+BOX\b/gi, '')
    .replace(/\bBROKEN\s+BOX\b/gi, '')
    .replace(/\bWITH\s+OLD\s+BOX\b/gi, '')
    .replace(/\bOLD\s+BOX\b/gi, '')
    .replace(/\bWITH\s+OLD\s+PACKAGING\b/gi, '')
    .replace(/\bOLD\s+PACKAGING\b/gi, '')

    // Accessory/parts noise.
    .replace(/\bWITHOUT\s+ANY\s+ACCESSORIES\b/gi, '')
    .replace(/\bWITHOUT\s+ACCESSORIES\b/gi, '')
    .replace(/\bW\/O\s+ACCESSORIES\b/gi, '')
    .replace(/\bNO\s+ACCESSORIES\b/gi, '')
    .replace(/\bTRIED\s*(?:&|AND)\s*TESTED\b/gi, '')
    .replace(/\bFOR\s+PARTS\b/gi, '')
    .replace(/\bPARTS\s+ONLY\b/gi, '')
    .replace(/\bWITH\s+BROKEN\s+PARTS?\b/gi, '')
    .replace(/\bBROKEN\s+PARTS?\b/gi, '')
    .replace(/\bW\/\s*BROKEN\s+PART\b/gi, '')
    .replace(/\bWITH\s+MISSING\s+PART\b/gi, '')
    .replace(/\bMISSING\s+PART\b/gi, '')
    .replace(/\(?\bWITHOUT\s+COVER\s+FOR\s+BATTERY\b\)?/gi, '')
    .replace(/\bWITH\s+BROKEN\s+BACK\s+PLATE\b/gi, '')
    .replace(/\bBROKEN\s+BACK\s+PLATE\b/gi, '')

    // Final whitespace/punctuation normalization.
    .replace(/\s+-\s*$/g, '')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function normalizePartNumber(value: string): string {
  return String(value || '')
    .toUpperCase()
    .trim()
    .replace(/\bLOT\s*#?\s*(?:OF\s+)?\d+(?:\.\d+)?\b/gi, '')
    .replace(/\bQTY\s*[:#-]?\s*\d+(?:\.\d+)?\b/gi, '')
    .replace(/\b\d+(?:\.\d+)?\s*(?:PCS?|PIECES?|SETS?|PACKS?)\b/gi, '')
    .replace(/\b(?:PCS?|PIECES?|SETS?|PACKS?)\s*\d+(?:\.\d+)?\b/gi, '')
    .replace(/\b(?:LOT|LOT#|QTY|PCS?|PIECES?|SETS?|PACKS?)\b/gi, '')
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

  return /^(?:EM|CM|CPU|CP|FM|SM|PS|IM|PM|PLC|HMI|VFD|AI|AO|DI|DO|IO)-?\d{1,4}$/i.test(
    v
  );
}
function isValidPartNumber(
  value: string,
  ebayItemId: string,
  realItemId: string
): boolean {
  const v = normalizePartNumber(value);

  if (!v || v.length < 4 || v.length > 50) return false;
  if (v === String(ebayItemId).toUpperCase()) return false;
  if (v === String(realItemId).toUpperCase()) return false;
  if (/^\d{10,14}$/.test(v)) return false;
  if (/^(?:LOT|QTY|PCS?|PIECES?|SETS?|PACKS?)$/i.test(v)) return false;
  if (isElectricalRating(v)) return false;
  if (isWeakFamilyModel(v)) return false;

  return /[A-Z]/.test(v) && /\d/.test(v);
}

function scorePartNumber(value: string): number {
  const v = normalizePartNumber(value);
  let score = 0;

  // High-confidence industrial formats.
  if (/^6ES\d/i.test(v)) score += 600;
  if (/^6AV\d/i.test(v)) score += 590;
  if (/^6GK\d/i.test(v)) score += 580;
  if (/^6EP\d/i.test(v)) score += 580;
  if (/^IC\d{3}[A-Z]{2,}\d+/i.test(v)) score += 560;
  if (/^A\d{2}B-\d{4}-[A-Z0-9]+$/i.test(v)) score += 550;

  // Siemens shortened format such as 222-1BF22-0XA8.
  if (/^\d{3}-\d[A-Z]{2}\d{2}-\d[A-Z]{2}\d$/i.test(v)) {
    score += 540;
  }

  // Structured codes are preferred over simple family labels.
  const groups = v.split('-').filter(Boolean).length;
  if (groups >= 3) score += 120;
  if (groups >= 4) score += 40;
  if (/[A-Z]/.test(v)) score += 40;
  if (/\d/.test(v)) score += 40;
  if (/[-/.]/.test(v)) score += 30;
  if (v.length >= 6 && v.length <= 30) score += 30;

  return score;
}

function extractBestPartNumber(
  item: any,
  title: string,
  ebayItemId: string,
  realItemId: string
): string {
  const candidates: string[] = [];

  const addCandidate = (value: string) => {
    const raw = String(value || '').trim();
    if (!raw) return;

    // أضف القيمة كما هي
    candidates.push(raw);

    // قسم القيم المركبة إلى أجزاء منفصلة
    const parts = raw
      .split(/\s*[|;,]\s*|\s{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);

    for (const part of parts) {
      candidates.push(part);

      const extracted = extractPartNumber(part);
      if (extracted) {
        candidates.push(extracted);
      }
    }
  };

  const aspectCandidates = [
    getAspectValue(item, ['MPN']),
    getAspectValue(item, ['Manufacturer Part Number']),
    getAspectValue(item, ['Part Number']),
    getAspectValue(item, ['Model Number']),
  ];

  for (const candidate of aspectCandidates) {
    addCandidate(candidate);
  }

  // استخراج من العنوان
  const extractedFromTitle = extractPartNumber(title);
  if (extractedFromTitle) {
    candidates.push(extractedFromTitle);
  }

  // Siemens: 222-1BF22-0XA8
  const siemensShort = title.match(
    /\b\d{3}-\d[A-Z]{2}\d{2}-\d[A-Z]{2}\d\b/i
  )?.[0];

  if (siemensShort) {
    candidates.push(siemensShort);
  }

  // Siemens / Siemens legacy: 6DP2658-7PC55-0AA0
  const siemens6DP = title.match(
    /\b6DP\d[\dA-Z-]+\b/i
  )?.[0];

  if (siemens6DP) {
    candidates.push(siemens6DP);
  }

  // Generic structured industrial codes
  const structuredCodes =
    title.match(
      /\b[A-Z0-9]{2,12}(?:[-/][A-Z0-9]{2,12}){1,5}\b/gi
    ) || [];

  candidates.push(...structuredCodes);

  const ranked = [...new Set(candidates.map(normalizePartNumber))]
    .filter((candidate) =>
      isValidPartNumber(candidate, ebayItemId, realItemId)
    )
    .map((candidate) => ({
      candidate,
      score: scorePartNumber(candidate),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return b.candidate.length - a.candidate.length;
    });

  return ranked[0]?.candidate || '';
}

function isExistingPartNumberBad(
  value: unknown,
  ebayItemId: string
): boolean {
  const partNumber = normalizePartNumber(String(value || ''));

  if (!partNumber) return true;
  if (partNumber === String(ebayItemId).toUpperCase()) return true;
  if (/^\d{10,14}$/.test(partNumber)) return true;
  if (/\b(?:LOT|QTY|PCS?|PIECES?)\b/i.test(partNumber)) return true;
  if (isElectricalRating(partNumber)) return true;
  if (isWeakFamilyModel(partNumber)) return true;

  return false;
}

async function markQueue(
  ebayItemId: string,
  status: string,
  errorMessage: string | null = null
): Promise<void> {
  await supabaseAdmin
    .from('ebay_import_queue')
    .update({
      status,
      error_message: errorMessage,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('ebay_item_id', ebayItemId);
}

export async function GET() {
  const now = new Date().toISOString();

  try {
    const { data: queueRows, error: queueError } = await supabaseAdmin
      .from('ebay_import_queue')
      .select('ebay_item_id, attempts')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(LIMIT);

    if (queueError) {
      return NextResponse.json(
        { success: false, error: queueError.message },
        { status: 500 }
      );
    }

    if (!queueRows?.length) {
      return NextResponse.json({
        success: true,
        message: 'No pending items in queue.',
        processed: 0,
      });
    }

    const token = await getEbayToken();
    const accessToken = String(token.access_token || '').trim();

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Missing eBay access token.' },
        { status: 500 }
      );
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let rateLimited = false;

    const results: Array<Record<string, unknown>> = [];

    for (const row of queueRows) {
      const ebayItemId = String(row.ebay_item_id || '').trim();

      if (!ebayItemId) {
        failed++;
        results.push({
          status: 'failed_invalid_queue_item',
          error: 'Missing ebay_item_id',
        });
        continue;
      }

      await supabaseAdmin
        .from('ebay_import_queue')
        .update({
          status: 'processing',
          attempts: Number(row.attempts || 0) + 1,
          updated_at: now,
        })
        .eq('ebay_item_id', ebayItemId);

      const { data: existingProduct, error: existingError } =
        await supabaseAdmin
          .from('products')
          .select('id, part_number, model_number, brand')
          .eq('ebay_item_id', ebayItemId)
          .maybeSingle();

      if (existingError) {
        await markQueue(ebayItemId, 'failed', existingError.message);
        failed++;
        results.push({
          ebayItemId,
          status: 'failed_existing_lookup',
          error: existingError.message,
        });
        continue;
      }

      const existingPartBad = isExistingPartNumberBad(
        existingProduct?.part_number,
        ebayItemId
      );

      const existingBrand = String(existingProduct?.brand || '').trim();
      const existingBrandBad =
        !existingBrand || existingBrand.toUpperCase() === 'UNKNOWN';

      // Keep valid existing products fast: refresh only.
      // Bad part numbers or UNKNOWN brands continue to eBay and get repaired.
      if (existingProduct?.id && !existingPartBad && !existingBrandBad) {
        const { error: refreshError } = await supabaseAdmin
          .from('products')
          .update({
            last_seen_at: now,
            updated_at: now,
            is_active: true,
          })
          .eq('id', existingProduct.id);

        if (refreshError) {
          await markQueue(ebayItemId, 'failed', refreshError.message);
          failed++;
          results.push({
            ebayItemId,
            status: 'failed_refresh_existing',
            error: refreshError.message,
          });
          continue;
        }

        await markQueue(
          ebayItemId,
          'completed',
          'Existing product already has valid part number and brand'
        );

        skipped++;
        results.push({
          ebayItemId,
          status: 'existing_valid',
        });
        continue;
      }

      const params = new URLSearchParams({
        q: ebayItemId,
        limit: '1',
        filter: `sellers:{${SELLER}}`,
      });

      const response = await fetch(
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

      if (response.status === 429) {
        await markQueue(ebayItemId, 'pending', 'EBAY_RATE_LIMIT_429');
        rateLimited = true;
        results.push({
          ebayItemId,
          status: 'rate_limited',
        });
        break;
      }

      const ebayData = await response.json().catch(() => null);

      if (!response.ok) {
        const message = JSON.stringify(ebayData || {}).slice(0, 500);
        await markQueue(ebayItemId, 'failed', message);
        failed++;
        results.push({
          ebayItemId,
          status: 'failed_fetch',
          error: message,
        });
        continue;
      }

      const item = ebayData?.itemSummaries?.[0];

      if (!item) {
        await markQueue(
          ebayItemId,
          'failed',
          'No item returned from Browse API'
        );
        failed++;
        results.push({
          ebayItemId,
          status: 'no_item',
        });
        continue;
      }

      const title = String(item.title || '').trim();
      const imageUrl = String(
        item.image?.imageUrl ||
          item.thumbnailImages?.[0]?.imageUrl ||
          ''
      ).trim();

      const realItemId = String(
        item.legacyItemId ||
          item.itemId?.split('|')?.[1] ||
          ebayItemId
      ).trim();

      if (
        !title ||
        !imageUrl ||
        title.includes('Orbit Control Industrial Item')
      ) {
        await markQueue(
          ebayItemId,
          'failed',
          'Missing valid title or image'
        );
        failed++;
        results.push({
          ebayItemId,
          status: 'failed_missing_data',
        });
        continue;
      }

      const cleanedName = cleanTitle(title);

      if (!cleanedName) {
        await markQueue(ebayItemId, 'failed', 'Missing clean name');
        failed++;
        results.push({
          ebayItemId,
          status: 'failed_missing_name',
        });
        continue;
      }

      const finalPartNumber = extractBestPartNumber(
        item,
        title,
        ebayItemId,
        realItemId
      );

      const detectedBrand = detectIndustrialBrand(
        [
          item.brand,
          getAspectValue(item, ['Brand']),
          getAspectValue(item, ['Manufacturer']),
          getAspectValue(item, ['MPN']),
          getAspectValue(item, ['Manufacturer Part Number']),
          title,
          cleanedName,
          finalPartNumber,
          item.shortDescription,
          item.description,
        ]
          .filter(Boolean)
          .join(' ')
      );

      const finalBrand =
        detectedBrand && detectedBrand !== 'UNKNOWN'
          ? detectedBrand
          : existingBrand && existingBrand.toUpperCase() !== 'UNKNOWN'
            ? existingBrand
            : 'UNKNOWN';

      const product = {
        ebay_item_id: realItemId,
        sku: realItemId,
        part_number: finalPartNumber || null,
        model_number: finalPartNumber || null,
        brand: finalBrand,
        category:
          item.categories?.[0]?.categoryName ||
          'Industrial Automation',
        name: cleanedName,
        condition: item.condition || 'Used',
        image_url: imageUrl,
        description: title,
        slug: slugify(`${realItemId}-${cleanedName}`),
        marketplace: MARKETPLACE,
        seller: SELLER,
        source: 'ebay-browse-queue',
        source_type: 'ebay',
        quantity: 1,
        price: item.price?.value
          ? Number(item.price.value)
          : null,
        currency: item.price?.currency || 'USD',
        is_active: true,
        last_seen_at: now,
        updated_at: now,
      };

      const { error: upsertError } = await supabaseAdmin
        .from('products')
        .upsert(product, {
          onConflict: 'ebay_item_id',
        });

      if (upsertError) {
        await markQueue(ebayItemId, 'failed', upsertError.message);
        failed++;
        results.push({
          ebayItemId,
          status: 'failed_upsert',
          error: upsertError.message,
        });
        continue;
      }

      await markQueue(ebayItemId, 'completed', null);

      if (existingProduct?.id) {
        updated++;
        results.push({
          ebayItemId,
          status: 'repaired_existing',
          partNumber: finalPartNumber || null,
          brand: finalBrand,
        });
      } else {
        imported++;
        results.push({
          ebayItemId,
          status: 'imported',
          name: cleanedName,
          partNumber: finalPartNumber || null,
          brand: finalBrand,
        });
      }
    }

    return NextResponse.json({
      success: true,
      limit: LIMIT,
      imported,
      updated,
      skipped,
      failed,
      rateLimited,
      results,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unexpected process-queue error';

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
