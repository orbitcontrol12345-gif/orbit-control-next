import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { extractPartNumber } from '@/lib/part-number';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const BAD_EXACT_VALUES = new Set([
  '',
  'UNKNOWN',
  'UNBRANDED',
  'DOES NOT APPLY',
  'DOES NOT APPLY.',
  'NOT APPLICABLE',
  'N/A',
  'NA',
  'NONE',
  'NO',
  'OTHER',
  'NEW',
  'USED',
  'OPEN BOX',
  'LOT',
  'PCS',
  'PC',
  'QTY',
  'PART NUMBER',
  'MODEL',
  'MODEL NUMBER',
  'TYPE',
  'REV',
  'REVISION',
]);

function normalize(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function isEbayItemId(value: string): boolean {
  return (
    /^27\d{10}$/.test(value) ||
    /^\d{12,13}$/.test(value)
  );
}

function isElectricalValue(value: string): boolean {
  const compact = value.replace(/\s+/g, '');

  return (
    /^\d+(?:\.\d+)?(?:VAC|VDC|V|HZ|KHZ|MHZ|KW|W|A|AMP|AMPS|MA)$/i.test(
      compact
    ) ||
    /^\d+(?:-\d+)?(?:VAC|VDC|V|HZ)$/i.test(compact)
  );
}

function isClearlyWrongPartNumber(
  currentValue: unknown,
  ebayItemId: unknown
): boolean {
  const current = normalize(currentValue);
  const ebayId = normalize(ebayItemId);

  if (BAD_EXACT_VALUES.has(current)) return true;

  if (current === ebayId && current) return true;
  if (isEbayItemId(current)) return true;
  if (isElectricalValue(current)) return true;

  if (
    /^(REV|REVISION|VER|VERSION)[- /.]?[A-Z0-9.]*$/i.test(current)
  ) {
    return true;
  }

  if (
    /^(NO|NUMBER|MODEL|TYPE|ART|ARTICLE|CAT|CATALOG|REF|REFERENCE|ORDER|SERIAL|SN)[- /.]+[A-Z0-9]+$/i.test(
      current
    )
  ) {
    return true;
  }

  if (
    /^\d+[- ]?(CHANNELS?|PORTS?|WAYS?|FOLDS?|PHASES?|POLES?)$/i.test(
      current
    )
  ) {
    return true;
  }

  if (
    /^(CHANNELS?|PORTS?|WAYS?|FOLDS?|PHASES?|POLES?)[- ]?\d+$/i.test(
      current
    )
  ) {
    return true;
  }

  return false;
}

function getProposedPartNumber(
  name: unknown,
  description: unknown
): string {
  const descriptionText = String(description || '').trim();
  const nameText = String(name || '').trim();

  const fromDescription = descriptionText
    ? extractPartNumber(descriptionText)
    : '';

  const fromName = nameText
    ? extractPartNumber(nameText)
    : '';

  return normalize(fromDescription || fromName);
}

async function loadCandidates(limit: number) {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select(
      'id, ebay_item_id, brand, part_number, model_number, name, description'
    )
    .eq('is_active', true)
    .order('id', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data || [])
    .map((item) => {
      const currentPartNumber = normalize(item.part_number);

      const proposedPartNumber = getProposedPartNumber(
        item.name,
        item.description
      );

      const currentIsWrong = isClearlyWrongPartNumber(
        currentPartNumber,
        item.ebay_item_id
      );

      const isShortNumericOnly = /^\d{1,4}$/.test(proposedPartNumber);

const canUpdate =
  currentIsWrong &&
  Boolean(proposedPartNumber) &&
  proposedPartNumber !== 'UNKNOWN' &&
  proposedPartNumber !== currentPartNumber &&
  !isEbayItemId(proposedPartNumber) &&
  !isElectricalValue(proposedPartNumber) &&
  !isShortNumericOnly;

      return {
        id: item.id,
        ebay_item_id: item.ebay_item_id,
        brand: item.brand,
        name: item.name,
        current_part_number: item.part_number,
        proposed_part_number: proposedPartNumber || 'UNKNOWN',
        current_is_clearly_wrong: currentIsWrong,
        can_update: canUpdate,
      };
    })
    .filter((item) => item.current_is_clearly_wrong);
}

/**
 * GET = فحص فقط، لا يعدّل قاعدة البيانات.
 *
 * مثال:
 * /api/fix-part-number-safe?limit=200
 */
export async function GET(req: NextRequest) {
  try {
    const requestedLimit = Number(
      req.nextUrl.searchParams.get('limit') || DEFAULT_LIMIT
    );

    const limit = Math.min(
      Math.max(requestedLimit, 1),
      MAX_LIMIT
    );

    const candidates = await loadCandidates(limit);
    const safeUpdates = candidates.filter((item) => item.can_update);
const apply =
  req.nextUrl.searchParams.get('apply') === '1';

if (apply) {
  let updated = 0;
  let failed = 0;

  const results: Array<{
    id: string | number;
    ebay_item_id: unknown;
    old_part_number: unknown;
    new_part_number: string;
    success: boolean;
    error?: string;
  }> = [];

  for (const item of safeUpdates) {
    const { error } = await supabaseAdmin
      .from('products')
      .update({
        part_number: item.proposed_part_number,
        model_number: item.proposed_part_number,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    if (error) {
      failed++;

      results.push({
        id: item.id,
        ebay_item_id: item.ebay_item_id,
        old_part_number: item.current_part_number,
        new_part_number: item.proposed_part_number,
        success: false,
        error: error.message,
      });

      continue;
    }

    updated++;

    results.push({
      id: item.id,
      ebay_item_id: item.ebay_item_id,
      old_part_number: item.current_part_number,
      new_part_number: item.proposed_part_number,
      success: true,
    });
  }

  return NextResponse.json({
    success: true,
    mode: 'apply',
    checked: limit,
    eligible_for_safe_update: safeUpdates.length,
    updated,
    failed,
    results,
  });
}
    return NextResponse.json({
      success: true,
      mode: 'dry-run',
      database_changed: false,
      checked: limit,
      clearly_wrong_found: candidates.length,
      safe_updates_found: safeUpdates.length,
      skipped: candidates.length - safeUpdates.length,
      safe_updates: safeUpdates,
      all_clearly_wrong: candidates,
    });
  } catch (error) {
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

/**
 * POST = تنفيذ التحديث الآمن.
 *
 * يجب إرسال:
 * {
 *   "confirm": "FIX_SAFE_PART_NUMBERS",
 *   "limit": 200
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    if (body?.confirm !== 'FIX_SAFE_PART_NUMBERS') {
      return NextResponse.json(
        {
          success: false,
          error: 'Confirmation value is incorrect.',
          required_confirm: 'FIX_SAFE_PART_NUMBERS',
        },
        { status: 400 }
      );
    }

    const requestedLimit = Number(
      body?.limit || DEFAULT_LIMIT
    );

    const limit = Math.min(
      Math.max(requestedLimit, 1),
      MAX_LIMIT
    );

    const candidates = await loadCandidates(limit);
    const safeUpdates = candidates.filter((item) => item.can_update);

    let updated = 0;
    let failed = 0;

    const results: Array<{
      id: string | number;
      ebay_item_id: unknown;
      old_part_number: unknown;
      new_part_number: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const item of safeUpdates) {
      const { error } = await supabaseAdmin
        .from('products')
        .update({
          part_number: item.proposed_part_number,
          model_number: item.proposed_part_number,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      if (error) {
        failed++;

        results.push({
          id: item.id,
          ebay_item_id: item.ebay_item_id,
          old_part_number: item.current_part_number,
          new_part_number: item.proposed_part_number,
          success: false,
          error: error.message,
        });

        continue;
      }

      updated++;

      results.push({
        id: item.id,
        ebay_item_id: item.ebay_item_id,
        old_part_number: item.current_part_number,
        new_part_number: item.proposed_part_number,
        success: true,
      });
    }

    return NextResponse.json({
      success: true,
      mode: 'apply',
      checked: limit,
      clearly_wrong_found: candidates.length,
      eligible_for_safe_update: safeUpdates.length,
      updated,
      failed,
      results,
    });
  } catch (error) {
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
