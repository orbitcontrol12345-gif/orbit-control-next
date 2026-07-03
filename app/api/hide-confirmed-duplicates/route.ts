import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const badParts = new Set([
  'UNKNOWN',
  'W/O',
  'I/O',
  'SHUNT-DIODE',
  '50/60HZ',
  'SHUNT',
  'INPUT',
  'OUTPUT',
  'BOARD',
  'MODULE',
  'POWER',
  'SUPPLY',
  'SYSTEM',
  'RELAY-NEW',
]);
function normalizeName(name: string) {
  return String(name || '')
    .toUpperCase()
    .replace(/\bLOT OF\b/g, ' ')
    .replace(/\bLOT\b/g, ' ')
    .replace(/\bPIECES\b/g, ' ')
    .replace(/\bPIECE\b/g, ' ')
    .replace(/\bPCS\b/g, ' ')
    .replace(/\b3PCS\b/g, ' ')
    .replace(/\b3 PCS\b/g, ' ')
    .replace(/\bRELAYS\b/g, 'RELAY')
    .replace(/\bHEAVY[- ]?DUTY\b/g, ' ')
    .replace(/[.,()/_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function groupKey(item: any) {
  return [
    String(item.brand || '').trim().toUpperCase(),
    String(item.part_number || '').trim().toUpperCase(),
    String(item.condition || '').trim().toUpperCase(),
    normalizeName(item.name),
  ].join('::');
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dryRun') !== 'false';

    const all: any[] = [];

    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from('products')
        .select('id, ebay_item_id, brand, part_number, condition, image_url, name, catalog_visible')
        .eq('is_active', true)
        .neq('catalog_visible', false)
        .not('part_number', 'is', null)
        .order('id', { ascending: false })
        .range(from, from + 999);

      if (error) throw error;
      if (!data || data.length === 0) break;

      all.push(...data);

      if (data.length < 1000) break;
    }

    const groups = new Map<string, any[]>();

    for (const item of all) {
      const part = String(item.part_number || '').trim().toUpperCase();

      if (!part) continue;
      if (badParts.has(part)) continue;

      const key = groupKey(item);

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    const toHide: any[] = [];

    for (const items of groups.values()) {
      if (items.length <= 1) continue;

      const sorted = [...items].sort((a, b) => Number(b.id) - Number(a.id));
      const keep = sorted[0];

      for (const item of sorted.slice(1)) {
        toHide.push({
          id: item.id,
          ebay_item_id: item.ebay_item_id,
          part_number: item.part_number,
          keep_id: keep.id,
          name: item.name,
        });
      }
    }

    if (!dryRun && toHide.length > 0) {
      const ids = toHide.map((x) => x.id);

      const { error: updateError } = await supabaseAdmin
        .from('products')
        .update({
          catalog_visible: false,
          updated_at: new Date().toISOString(),
        })
        .in('id', ids);

      if (updateError) throw updateError;
    }

    return NextResponse.json({
      success: true,
      dryRun,
      checked: all.length,
      duplicatesFound: toHide.length,
      sample: toHide.slice(0, 50),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || String(error) },
      { status: 500 }
    );
  }
}
